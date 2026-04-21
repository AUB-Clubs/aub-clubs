import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  SUPABASE_UPLOADS_BUCKET,
  uploadFileToSupabase,
} from "@/lib/supabase-storage";
import type { AgentState } from "../../types";
import { generateTextWithOpenAI } from "../../openai";
import {
  POSTER_GENERATION_PROMPT,
  buildPosterUserMessage,
} from "../../prompts/image/poster-prompt";

const EVENT_IMAGES_BUCKET =
  process.env.EVENT_IMAGES_SUPABASE_BUCKET ?? SUPABASE_UPLOADS_BUCKET;

async function uploadToSupabase(imageBase64: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, "base64");

  const uploaded = await uploadFileToSupabase({
    file: new Blob([buffer], { type: "image/png" }),
    userId: "event-generator",
    fileName: `poster-${Date.now()}.png`,
    folder: "posters",
    bucket: EVENT_IMAGES_BUCKET,
    useServiceRole: true,
    upsert: true,
  });

  return uploaded.publicUrl;
}

export const generate_posts_images = createTool<AgentState>({
  name: "generate_posts_images",
  description:
    "Generates or edits the promotional poster image using OpenAI prompt generation and Gemini image rendering.",
  parameters: z.object({
    type: z
      .enum(["generate_new_post_image", "modify_existing_post_image"])
      .describe("Whether to generate a new image or modify the existing one"),
    explanation: z.string().describe("Explanation of what is being done"),
    edits_requested: z
      .string()
      .describe(
        "Requested changes for modifications. Empty for new generation.",
      )
      .default(""),
  }),
  handler: async (
    { type, explanation, edits_requested },
    { step, network },
  ) => {
    const state = network!.state.data as AgentState;
    const { fragmentId, projectId, publishers } = state;

    await step!.run("generate_posts_images:explain", () =>
      publishers.publishChunk(explanation),
    );

    return await step!.run("generate_posts_images", async () => {
      // Resolve event report and details
      const eventReport =
        state.report ||
        (
          await prisma.fragment.findFirst({
            where: { message: { projectId }, completedAt: { not: null } },
            orderBy: { createdAt: "desc" },
            include: { eventReport: true },
          })
        )?.eventReport?.markdown ||
        "";

      const eventDetails = {
        scale: state.scale,
        type: state.type,
        topic: state.topic,
        selectedIdea: state.selectedIdea,
      };

      let previousPrompt: string | undefined;
      let previousImageBase64: string | undefined;

      if (type === "modify_existing_post_image") {
        // Pull previous image prompt and image from latest completed fragment
        const prevFragment = await prisma.fragment.findFirst({
          where: { message: { projectId }, completedAt: { not: null } },
          orderBy: { createdAt: "desc" },
          include: { eventImage: true },
        });

        previousPrompt = prevFragment?.eventImage?.prompt ?? undefined;

        // Download previous image from Supabase and base64 encode it
        if (prevFragment?.eventImage?.supabaseUrl) {
          try {
            const res = await fetch(prevFragment.eventImage.supabaseUrl);
            const arrayBuffer = await res.arrayBuffer();
            previousImageBase64 = Buffer.from(arrayBuffer).toString("base64");
          } catch {
            // Non-fatal: fall back to text-only prompt if image fetch fails
          }
        }
      }

      const userMessage = buildPosterUserMessage({
        event_report: eventReport,
        event_details: eventDetails,
        previous_prompt: previousPrompt,
        edits_requested,
      });

      await publishers.publishChunk("Crafting poster prompt…");
      const imagePrompt = await generateTextWithOpenAI({
        systemPrompt: POSTER_GENERATION_PROMPT,
        userPrompt: userMessage,
      });

      await publishers.publishChunk("Generating poster with Advanced AI…");
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

      const prompt: any[] =
        type === "modify_existing_post_image" && previousImageBase64
          ? [
              { text: imagePrompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: previousImageBase64,
                },
              },
            ]
          : [{ text: imagePrompt }];

      // Hard timeout so a stuck Gemini request surfaces as a tool error
      // instead of silently hanging the whole Inngest run. 90s is generous
      // for image generation but short enough to unblock the agent.
      const GEMINI_TIMEOUT_MS = 90_000;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Gemini image generation timed out after ${GEMINI_TIMEOUT_MS}ms`,
              ),
            ),
          GEMINI_TIMEOUT_MS,
        ),
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: "gemini-3.1-flash-image-preview",
          contents: prompt,
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K",
            },
          },
        }),
        timeout,
      ]);

      let imageBase64: string | undefined;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data;
          break;
        }
      }

      if (!imageBase64) {
        return "Image generation failed: no image returned from Gemini.";
      }

      await publishers.publishChunk("Uploading poster to storage…");
      const imageUrl = await uploadToSupabase(imageBase64);

      // Save to state
      network!.state.data.postImageUrl = imageUrl;

      // Save to DB
      if (fragmentId) {
        await prisma.eventImage.upsert({
          where: { fragmentId },
          create: { fragmentId, supabaseUrl: imageUrl, prompt: imagePrompt },
          update: { supabaseUrl: imageUrl, prompt: imagePrompt },
        });
      }

      await publishers.publishFragmentUpdate("image", { url: imageUrl });

      return `Poster generated successfully: ${imageUrl}`;
    });
  },
});
