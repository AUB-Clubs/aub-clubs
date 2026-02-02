import { z } from 'zod';
import { createTRPCRouter, baseProcedure } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';

/**
 * For You page backend: announcements and new posts from clubs
 * the user is registered in. Feed items are merged and sorted by created_at.
 */
export const forYouRouter = createTRPCRouter({
  getFeed: baseProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;

      // Get club ids the current user is registered in
      const registrations = await prisma.registeredClubs.findMany({
        where: { user_id: ctx.userId },
        select: { club_id: true },
      });
      const clubIds = registrations.map((r) => r.club_id);
      if (clubIds.length === 0) {
        return { items: [], nextCursor: null };
      }

      // Fetch announcements from those clubs
      const [announcements, posts] = await Promise.all([
        prisma.announcement.findMany({
          where: { club_id: { in: clubIds } },
          orderBy: { created_at: 'desc' },
          take: limit * 2, // fetch extra to merge with posts
          include: {
            club: {
              select: { id: true, Title: true, CRN: true, image: true },
            },
          },
        }),
        prisma.post.findMany({
          where: { club_id: { in: clubIds } },
          orderBy: { created_at: 'desc' },
          take: limit * 2,
          include: {
            club: {
              select: { id: true, Title: true, CRN: true, image: true },
            },
            author: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                avatar_url: true,
              },
            },
          },
        }),
      ]);

      // Merge and sort by created_at desc
      type FeedItem =
        | { type: 'announcement'; id: string; created_at: Date; data: (typeof announcements)[0] }
        | { type: 'post'; id: string; created_at: Date; data: (typeof posts)[0] };
      const items: FeedItem[] = [
        ...announcements.map((a) => ({
          type: 'announcement' as const,
          id: a.id,
          created_at: a.created_at,
          data: a,
        })),
        ...posts.map((p) => ({
          type: 'post' as const,
          id: p.id,
          created_at: p.created_at,
          data: p,
        })),
      ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      // Apply cursor pagination: if cursor provided, skip until we pass it
      let start = 0;
      if (cursor) {
        const idx = items.findIndex((i) => i.id === cursor);
        start = idx === -1 ? 0 : idx + 1;
      }
      const page = items.slice(start, start + limit);
      const nextCursor =
        items.length > start + limit ? page[page.length - 1]?.id ?? null : null;

      return {
        items: page,
        nextCursor,
      };
    }),
});
