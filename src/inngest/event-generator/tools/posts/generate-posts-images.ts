import { createTool, createAgent, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";
import {
  POSTER_GENERATION_PROMPT,
  buildPosterUserMessage,
} from "../../prompts/image/poster-prompt";

async function uploadToSupabase(imageBase64: string): Promise<string> {
  const { supabase } = await import("@/lib/RAG/config");
  const filename = `posters/${Date.now()}.png`;
  const buffer = Buffer.from(imageBase64, "base64");

  const { error } = await supabase.storage
    .from("event-images")
    .upload(filename, buffer, { contentType: "image/png", upsert: true });

  if (error) throw new Error("Supabase upload failed: " + error.message);

  const { data } = supabase.storage.from("event-images").getPublicUrl(filename);
  return data.publicUrl;
}

export const generate_posts_images = createTool<AgentState>({
  name: "generate_posts_images",
  description: "Generates or edits the promotional poster image using a 2-stage pipeline: prompt agent → Gemini image generation.",
  parameters: z.object({
    type: z.enum(["generate_new_post_image", "modify_existing_post_image"]),
    explanation: z.string(),
    edits_requested: z.string().optional(),
  }),
  handler: async ({ type, explanation, edits_requested }, { network }) => {
    const { fragmentId, projectId, publishers } = network!.state.data;
    const state = network!.state.data;

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

    // ── Stage 1: Generate image prompt via sub-agent ──────────────────────────
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

    const promptAgent = createAgent({
      name: "image-prompt-generator",
      system: POSTER_GENERATION_PROMPT,
      model: openai({ model: "gpt-5.4" }),
    });

    const userMessage = buildPosterUserMessage({
      event_report: eventReport,
      event_details: eventDetails,
      previous_prompt: previousPrompt,
      edits_requested,
    });

    const { output: promptOutput } = await promptAgent.run(userMessage);
    const imagePrompt =
      promptOutput[0]?.type === "text"
        ? Array.isArray(promptOutput[0].content)
          ? promptOutput[0].content.join("")
          : promptOutput[0].content
        : "";

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
