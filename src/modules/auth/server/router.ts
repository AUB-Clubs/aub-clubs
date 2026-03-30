import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { authProcedure } from "./middleware";
import { aubEmailSchema, passwordSchema } from "../lib/validations";
import { createClient } from "./utils/supabase-server";

export const authRouter = createTRPCRouter({
  /**
   * Sign up a new user
   * Creates Supabase auth user and our DB user record
   */
  signUp: baseProcedure
    .input(
      z.object({
        email: aubEmailSchema,
        password: passwordSchema,
      })
    )
    .mutation(async ({ input }) => {
      const { email, password } = input;

      // Check if user already exists in our DB
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      // Create user in Supabase
      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm-verification`,
        },
      });

      if (authError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: authError.message,
        });
      }

      if (!authData.user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Create user record in our DB
      await prisma.user.create({
        data: {
          id: authData.user.id,
          email,
          emailVerified: false,
          onboardingCompleted: false,
        },
      });

      return { success: true, message: "Please check your email to verify your account" };
    }),

  /**
   * Mark email as verified
   * Called when user verifies their email through Supabase
   */
  markEmailVerified: baseProcedure.mutation(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    // Verify with Supabase that email is actually confirmed
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();

    if (!supabaseUser?.email_confirmed_at) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Email not verified in Supabase",
      });
    }

    // Update our DB record
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { emailVerified: true },
    });

    return { success: true };
  }),

  /**
   * Get current authenticated user
   * Requires: Authentication + Email Verified
   */
  getCurrentUser: authProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      emailVerified: ctx.user.emailVerified,
      onboardingCompleted: ctx.user.onboardingCompleted,
      firstName: ctx.user.firstName,
      lastName: ctx.user.lastName,
      avatarUrl: ctx.user.avatarUrl,
    };
  }),

  /**
   * Get user status (for determining redirects)
   * Public procedure - just checks the session
   */
  getStatus: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      return { authenticated: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        emailVerified: true,
        onboardingCompleted: true,
      },
    });

    if (!user) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
    };
  }),
});
