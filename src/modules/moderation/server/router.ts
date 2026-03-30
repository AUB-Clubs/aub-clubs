import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";

const INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:8080";

// Input validation schemas
const moderateTextSchema = z.object({
  text: z.string().min(1).max(10000),
});

const moderateImageSchema = z.object({
  base64Image: z
    .string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)"),
});

const moderateBothSchema = z.object({
  text: z.string().min(1).max(10000),
  base64Image: z
    .string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)"),
});

// Helper to strip data URI prefix
const cleanBase64 = (base64: string): string => {
  return base64.replace(/^data:image\/[a-z]+;base64,/, "");
};

// Helper to call inference service
const callInferenceService = async (payload: {
  text?: string;
  image?: string;
}): Promise<{
  text_flags?: Array<{ label: string; score: number }>;
  image_flags?: Array<{ label: string; score: number }>;
}> => {
  try {
    const response = await fetch(`${INFERENCE_URL}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inference service returned ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Moderation service unavailable:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Moderation service is currently unavailable",
      cause: error,
    });
  }
};

export const moderationRouter = createTRPCRouter({
  moderateText: baseProcedure
    .input(moderateTextSchema)
    .mutation(async ({ input }) => {
      return await callInferenceService({ text: input.text });
    }),

  moderateImage: baseProcedure
    .input(moderateImageSchema)
    .mutation(async ({ input }) => {
      const cleanedBase64 = cleanBase64(input.base64Image);
      return await callInferenceService({ image: cleanedBase64 });
    }),

  moderateBoth: baseProcedure
    .input(moderateBothSchema)
    .mutation(async ({ input }) => {
      const cleanedBase64 = cleanBase64(input.base64Image);
      return await callInferenceService({
        text: input.text,
        image: cleanedBase64,
      });
    }),
});
