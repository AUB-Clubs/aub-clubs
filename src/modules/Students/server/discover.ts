import { z } from 'zod';
import { createTRPCRouter, baseProcedure } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';

/**
 * Discover page backend: personalized posts from recommended clubs
 * and trending posts across all clubs.
 */
export const discoverRouter = createTRPCRouter({
  // ── Discover Feed: Posts from recommended clubs ─────────────────────
  getDiscoverFeed: baseProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(12),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;
      const userId = ctx.userId;

      // 1. Reuse recommendation logic to get club IDs (top 20 for variety)
      const userMemberships = await prisma.membership.findMany({
        where: {
          userId,
          status: "ACCEPTED",
        },
        include: {
          club: {
            select: { types: true },
          },
        },
      });

      const joinedClubIds = userMemberships.map((m) => m.clubId);
      const allTypes = userMemberships.flatMap((m) => m.club.types);
      const preferredTypes = Array.from(new Set(allTypes));

      // If user has no clubs, return empty array
      if (preferredTypes.length === 0) {
        return { posts: [], nextCursor: null };
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Get candidate clubs based on types
      const candidateClubs = await prisma.club.findMany({
        where: {
          AND: [
            { id: { notIn: joinedClubIds } },
            { types: { hasSome: preferredTypes } },
          ],
        },
        select: {
          id: true,
          title: true,
          types: true,
          _count: {
            select: { memberships: true },
          },
          posts: {
            where: {
              createdAt: { gte: thirtyDaysAgo },
              status: "PUBLISHED",
            },
            select: {
              type: true,
            },
          },
        },
      });

      // Score clubs (simplified for performance)
      const scoredClubs = candidateClubs.map((club) => {
        const typeMatches = club.types.filter((t) => preferredTypes.includes(t)).length;
        const announcements = club.posts.filter((p) => p.type === "ANNOUNCEMENT").length;
        const posts = club.posts.filter((p) => p.type === "GENERAL").length;
        const activity = announcements * 0.8 + posts * 0.2;
        const score = typeMatches * 5 + activity * 2 + club._count.memberships * 0.1;

        return { id: club.id, score };
      });

      // Get top 20 club IDs
      const recommendedClubIds = scoredClubs
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((c) => c.id);

      if (recommendedClubIds.length === 0) {
        return { posts: [], nextCursor: null };
      }

      // 2. Fetch posts from recommended clubs
      const posts = await prisma.post.findMany({
        where: {
          clubId: { in: recommendedClubIds },
          createdAt: { gte: thirtyDaysAgo },
          status: "PUBLISHED",
        },
        orderBy: [
          { type: "desc" }, // ANNOUNCEMENT first
          { createdAt: "desc" },
        ],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        include: {
          club: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              types: true,
            },
          },
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId: ctx.userId }, select: { id: true } },
        },
      });

      let nextCursor: string | null = null;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      return { posts, nextCursor };
    }),

  // ── Trending Feed: Global trending posts ───────────────────────────
  getTrendingPosts: baseProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(12),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      // Fetch posts from last 14 days with upvote counts
      const posts = await prisma.post.findMany({
        where: {
          createdAt: { gte: fourteenDaysAgo },
          status: "PUBLISHED",
        },
        include: {
          club: {
            select: {
              id: true,
              title: true,
              imageUrl: true,
              types: true,
            },
          },
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId: ctx.userId }, select: { id: true } },
        },
      });

      // Calculate trending score and filter
      const now = Date.now();
      const scoredPosts = posts
        .map((post) => {
          const upvoteCount = post._count.upvotes;
          
          // Filter: minimum 3 upvotes
          if (upvoteCount < 3) return null;

          // Calculate trending score
          const engagement = upvoteCount * 2;
          const daysOld = (now - post.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const recency = (14 - daysOld) / 14;
          const trendingScore = engagement * (0.7 + recency * 0.3);

          return {
            ...post,
            trendingScore,
          };
        })
        .filter((p) => p !== null) as Array<typeof posts[0] & { trendingScore: number }>;

      // Sort by trending score
      scoredPosts.sort((a, b) => b.trendingScore - a.trendingScore);

      // Apply cursor pagination
      let startIndex = 0;
      if (cursor) {
        startIndex = scoredPosts.findIndex((p) => p.id === cursor);
        if (startIndex === -1) startIndex = 0;
        else startIndex += 1;
      }

      const paginatedPosts = scoredPosts.slice(startIndex, startIndex + limit + 1);

      let nextCursor: string | null = null;
      if (paginatedPosts.length > limit) {
        const nextItem = paginatedPosts.pop();
        nextCursor = nextItem!.id;
      }

      return { posts: paginatedPosts, nextCursor };
    }),
});
