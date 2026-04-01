import { TRPCError } from "@trpc/server";
import { baseProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";

/**
 * Auth Procedure
 * Requires: Authentication + Email Verified
 * Use for: Onboarding routes and other partially protected routes
 */
export const authProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ 
      code: "UNAUTHORIZED", 
      message: "Not authenticated" 
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  if (!user.emailVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email not verified",
    });
  }

  return next({ ctx: { ...ctx, user } });
});

/**
 * Protected Procedure
 * Requires: Authentication + Email Verified + Onboarding Complete
 * Use for: All main app routes (clubs, posts, events, profile, etc.)
 */
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  if (!user.emailVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email not verified",
    });
  }

  if (!user.onboardingCompleted) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Onboarding not completed",
    });
  }

  return next({ ctx: { ...ctx, user } });
});
