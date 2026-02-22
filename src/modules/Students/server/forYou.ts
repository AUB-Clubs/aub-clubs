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
          filter: z.enum(['ALL', 'ANNOUNCEMENT', 'GENERAL']).optional().default('ALL'),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;
      const filter = input?.filter ?? 'ALL';

      // Get club ids the current user is registered in
      const memberships = await prisma.membership.findMany({
        where: { userId: ctx.userId },
        select: { clubId: true },
      });
      const clubIds = memberships.map((m) => m.clubId);

      if (clubIds.length === 0) {
        return { items: [], nextCursor: null };
      }
      
      const posts = await prisma.post.findMany({
        where: {
           clubId: { in: clubIds },
           ...(filter !== 'ALL' ? { type: filter as 'ANNOUNCEMENT' | 'GENERAL' } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        include: {
          club: {
            select: { id: true, title: true, crn: true, image_url: true },
          },
          author: {
             select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
             }
          },
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId: ctx.userId }, select: { id: true } },
        },
      });

      let nextCursor: typeof cursor | null = null;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      const items = posts.map((p) => ({
        type: p.type === 'ANNOUNCEMENT' ? 'announcement' : 'post',
        id: p.id,
        created_at: p.createdAt,
        data: {
          ...p,
          created_at: p.createdAt,
          club: {
            id: p.club.id,
            Title: p.club.title,
            CRN: p.club.crn,
            image: p.club.image_url,
          },
          author: {
            id: p.author.id,
            first_name: p.author.firstName,
            last_name: p.author.lastName,
            avatar_url: p.author.avatarUrl,
          },
          upvotes_count: p._count.upvotes,
          has_upvoted: p.upvotes.length > 0,
        },
      }));
      
      // Sort is handled by DB order by
      // Cursor pagination is handled by DB

      return {
        items, // TS will infer the union type from the map
        nextCursor,
      };
    }),
  getRecommendedForYou: baseProcedure
    .query(async ({ ctx }) => {
      // Get clubs user is in
      const userClubs = await prisma.membership.findMany({
        where: { userId: ctx.userId },
        select: { clubId: true },
      });
      const userClubIds = userClubs.map((m) => m.clubId);

      // Get recommended clubs: NOT in user's clubs, sorted by member count
      const recommendedClubs = await prisma.club.findMany({
        where: {
          id: { notIn: userClubIds },
        },
        take: 5,
        select: {
          id: true,
          title: true,
          description: true,
          image_url: true,
          _count: {
            select: { memberships: true },
          },
          posts: {
            where: {
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
            select: { id: true, title: true, content: true, createdAt: true, type: true },
            orderBy: { createdAt: 'desc' },
            take: 2,
          },
        },
        orderBy: { memberships: { _count: 'desc' } },
      });

      return {
        clubs: recommendedClubs.map((club) => ({
          id: club.id,
          title: club.title,
          description: club.description,
          image_url: club.image_url,
          membersCount: club._count.memberships,
          recentPosts: club.posts.map((p: { id: string; title: string; type: string; createdAt: Date }) => ({
            id: p.id,
            title: p.title,
            type: p.type,
            createdAt: p.createdAt,
          })),
        })),
      };
    }),
});
