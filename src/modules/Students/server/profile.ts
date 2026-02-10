import { z } from 'zod';
import { createTRPCRouter, baseProcedure } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';

/**
 * Student profile backend.
 * - get: fetch profile by user id (from context or by id).
 * - update: update profile fields (bio, avatar_url, major, year).
 */
export const profileRouter = createTRPCRouter({
  get: baseProcedure
    .input(z.object({ userId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = input?.userId ?? ctx.userId;
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
                  image_url: true,
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
            image: m.club.image_url,
          },
        })),
      };
    }),

  update: baseProcedure
    .input(
      z.object({
        bio: z.string().max(2000).optional(),
        avatar_url: z.string().url().optional().nullable(),
        major: z.string().max(200).optional().nullable(),
        year: z.number().int().min(1).max(10).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.avatar_url !== undefined && { avatarUrl: input.avatar_url }),
          ...(input.major !== undefined && { major: input.major }),
          ...(input.year !== undefined && { year: input.year }),
        },
      });
      return updated;
    }),
});
