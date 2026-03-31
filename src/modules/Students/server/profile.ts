import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';
import { protectedProcedure, authProcedure } from '@/modules/auth/server/middleware';
import { moderateImage } from '@/modules/moderation/server/moderation';
import { uploadFileToSupabase } from '@/lib/supabase-storage';

function base64ToBlob(base64: string): Blob {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  const mimeTypeMatch = base64.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
  
  return new Blob([arrayBuffer], { type: mimeType });
}

/**
 * Student profile backend.
 * - get: fetch profile by user id (from context or by id).
 * - update: update profile fields (bio, avatar_url, major, year).
 */
export const profileRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ userId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = input?.userId ?? ctx.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          aubnetId: true,
          email: true,
          firstName: true,
          lastName: true,
          dob: true,
          bio: true,
          avatarUrl: true,
          major: true,
          year: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            select: {
              role: true,
              club: {
                select: {
                  id: true,
                  title: true,
                  crn: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
      if (!user) return null;
      return {
        ...user,
        registered_clubs: user.memberships.map((m) => ({
          role: m.role,
          club: {
            id: m.club.id,
            Title: m.club.title,
            CRN: m.club.crn,
            image: m.club.imageUrl,
          },
        })),
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        aubnetId: z.number().int().positive("Must be a positive number").optional(),
        bio: z.string().max(2000).optional(),
        avatar_url: z.string().url().optional().nullable(),
        major: z.string().max(200).optional().nullable(),
        year: z.number().int().min(1).max(10).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      
      // Check if aubnetId is being updated and if it's already taken
      if (input.aubnetId !== undefined) {
        const existingUser = await prisma.user.findFirst({
          where: {
            aubnetId: input.aubnetId,
            NOT: { id: userId },
          },
        });
        
        if (existingUser) {
          throw new Error("This AUBnet ID is already taken");
        }
      }
      
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.aubnetId !== undefined && { aubnetId: input.aubnetId }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.avatar_url !== undefined && { avatarUrl: input.avatar_url }),
          ...(input.major !== undefined && { major: input.major }),
          ...(input.year !== undefined && { year: input.year }),
        },
      });
      return updated;
    }),

  getJoinRequests: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;
      const skip = (page - 1) * limit;
      const userId = ctx.user.id;

      const [requests, totalCount] = await Promise.all([
        prisma.membership.findMany({
          where: { userId },
          take: limit,
          skip,
          include: {
            club: {
              select: {
                id: true,
                title: true,
                crn: true,
                imageUrl: true,
              },
            },
          },
          orderBy: { joinedAt: "desc" },
        }),
        prisma.membership.count({ where: { userId } }),
      ]);

      return {
        requests,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    }),

  /**
   * Update avatar URL
   * Dedicated endpoint for profile picture updates
   */
  updateAvatar: protectedProcedure
    .input(
      z.object({
        avatarUrl: z.string().url().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: input.avatarUrl,
        },
        select: {
          id: true,
          avatarUrl: true,
        },
      });
      return updated;
    }),

  uploadProfileImage: authProcedure
    .input(
      z.object({
        base64Image: z.string(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Moderate image
      try {
        await moderateImage(input.base64Image, {
          throwOnUnsafe: true,
          imageThreshold: 0.3,
        });
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Unexpected moderation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to verify image safety. Please try again later.",
        });
      }

      // Convert base64 to Blob
      const blob = base64ToBlob(input.base64Image);

      // Upload to Supabase using ctx.supabase
      const result = await uploadFileToSupabase({
        file: blob,
        userId: ctx.user.id,
        folder: "avatars",
        fileName: input.fileName,
        supabaseClient: ctx.supabase,
      });

      return {
        imageUrl: result.publicUrl,
      };
    }),
});
