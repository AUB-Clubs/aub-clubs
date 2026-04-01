import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { moderateText, moderateImage, moderateBoth } from "./moderation";

// Input validation schemas
const moderateTextSchema = z.object({
  text: z.string().min(1).max(10000),
  throwOnUnsafe: z.boolean().optional().default(false),
  textThreshold: z.number().min(0).max(1).optional(),
});

const moderateImageSchema = z.object({
  base64Image: z
    .string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)"),
  throwOnUnsafe: z.boolean().optional().default(false),
  imageThreshold: z.number().min(0).max(1).optional(),
});

const moderateBothSchema = z.object({
  text: z.string().min(1).max(10000),
  base64Image: z
    .string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)"),
  throwOnUnsafe: z.boolean().optional().default(false),
  textThreshold: z.number().min(0).max(1).optional(),
  imageThreshold: z.number().min(0).max(1).optional(),
});

export const moderationRouter = createTRPCRouter({
  moderateText: baseProcedure
    .input(moderateTextSchema)
    .mutation(async ({ input }) => {
      return await moderateText(input.text, {
        throwOnUnsafe: input.throwOnUnsafe,
        textThreshold: input.textThreshold,
      });
    }),

  moderateImage: baseProcedure
    .input(moderateImageSchema)
    .mutation(async ({ input }) => {
      return await moderateImage(input.base64Image, {
        throwOnUnsafe: input.throwOnUnsafe,
        imageThreshold: input.imageThreshold,
      });
    }),

  moderateBoth: baseProcedure
    .input(moderateBothSchema)
    .mutation(async ({ input }) => {
      return await moderateBoth(input.text, input.base64Image, {
        throwOnUnsafe: input.throwOnUnsafe,
        textThreshold: input.textThreshold,
        imageThreshold: input.imageThreshold,
      });
    }),
});
