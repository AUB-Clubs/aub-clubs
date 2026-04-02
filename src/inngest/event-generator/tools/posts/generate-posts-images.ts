import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { uploadFileToSupabase } from "@/lib/supabase-storage";
import type { AgentState } from "../../types";
import { generateTextWithOpenAI } from "../../openai";
import {
  POSTER_GENERATION_PROMPT,
  buildPosterUserMessage,
} from "../../prompts/image/poster-prompt";

async function uploadToSupabase(imageBase64: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, "base64");

  const uploaded = await uploadFileToSupabase({
    file: new Blob([buffer], { type: "image/png" }),
    userId: "event-generator",
    fileName: `poster-${Date.now()}.png`,
    folder: "posters",
    bucket: "event-images",
    upsert: true,
  });

  return uploaded.publicUrl;
}

export const generate_posts_images = createTool<AgentState>({
  name: "generate_posts_images",
  description: "Generates or edits the promotional poster image using OpenAI prompt generation and Gemini image rendering.",
  parameters: z.object({
    type: z.enum(["generate_new_post_image", "modify_existing_post_image"]).describe("Whether to generate a new image or modify the existing one"),
    explanation: z.string().describe("Explanation of what is being done"),
    edits_requested: z.string().describe("Requested changes for modifications. Empty for new generation.").default(""),
  }),
  handler: async ({ type, explanation, edits_requested }, { network }) => {
    const state = network!.state.data as AgentState;
    const { fragmentId, projectId, publishers } = state;

    await publishers.publishChunk(explanation);

    // Resolve event report and details
    const eventReport =
      state.report ||
      (await prisma.fragment.findFirst({
        where: { message: { projectId }, completedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { eventReport: true },
      }))?.eventReport?.markdown ||
      "";

    const eventDetails = {
      scale: state.scale,
      type: state.type,
      topic: state.topic,
      selectedIdea: state.selectedIdea,
    };

    // ── Stage 1: Generate image prompt via OpenAI ─────────────────────────────
    await publishers.publishChunk("Crafting poster prompt…");

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

    const imagePrompt = await generateTextWithOpenAI({
      systemPrompt: POSTER_GENERATION_PROMPT,
      userPrompt: userMessage,
    });

    // ── Stage 2: Generate image with Gemini ───────────────────────────────────
    await publishers.publishChunk("Generating poster with Gemini…");

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

    const prompt: any[] =
      type === "modify_existing_post_image" && previousImageBase64
        ? [
            { text: imagePrompt },
            { inlineData: { mimeType: "image/png", data: previousImageBase64 } },
          ]
        : [{ text: imagePrompt }];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K",
        },
      },
    });

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

    // ── Upload to Supabase ────────────────────────────────────────────────────
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
  },
});
