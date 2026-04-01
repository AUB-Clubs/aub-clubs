import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { authProcedure } from "@/modules/auth/server/middleware";
import { onboardingSchema } from "../lib/validations";
import { moderateText, validateBioNoLinks } from "@/modules/moderation/server/moderation";

export const onboardingRouter = createTRPCRouter({
  /**
   * Complete the onboarding process
   * Requires: Authentication + Email Verified (but NOT onboarding complete)
   */
  complete: authProcedure
    .input(onboardingSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if already onboarded
      if (ctx.user.onboardingCompleted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Onboarding already completed",
        });
      }

      // Check if aubnetId is unique
      const existingAubnetId = await prisma.user.findUnique({
        where: { aubnetId: input.aubnetId },
      });

      if (existingAubnetId && existingAubnetId.id !== ctx.user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This AUB ID is already registered to another account",
        });
      }

      // Validate bio doesn't contain URLs
      try {
        validateBioNoLinks(input.bio);
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Unexpected validation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to validate bio. Please try again later.",
        });
      }

      // Moderate bio content
      try {
        await moderateText(input.bio, {
          throwOnUnsafe: true,
          textThreshold: 0.02,
        });
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Unexpected moderation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to verify content safety. Please try again later.",
        });
      }

      // Update user with onboarding data
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          aubnetId: input.aubnetId,
          dob: input.dob,
          major: input.major,
          year: input.year,
          bio: input.bio,
          avatarUrl: input.avatarUrl ?? null,
          onboardingCompleted: true,
        },
      });

      return { success: true };
    }),

  /**
   * Get current onboarding progress/data
   * Useful for resuming onboarding if user left midway
   */
  getProgress: authProcedure.query(async ({ ctx }) => {
    return {
      onboardingCompleted: ctx.user.onboardingCompleted,
      data: {
        firstName: ctx.user.firstName,
        lastName: ctx.user.lastName,
        aubnetId: ctx.user.aubnetId,
        dob: ctx.user.dob,
        major: ctx.user.major,
        year: ctx.user.year,
        bio: ctx.user.bio,
        avatarUrl: ctx.user.avatarUrl,
      },
    };
  }),
});
