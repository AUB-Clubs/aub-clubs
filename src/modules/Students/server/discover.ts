import { z } from 'zod';
import { createTRPCRouter } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';
import { getRecommendedClubIds } from '../../Recommendations/server/algorithms';
import { protectedProcedure } from '@/modules/auth/server/middleware';

/**
 * Discover page backend: personalized posts from recommended clubs
 * and trending posts across all clubs.
 */
export const discoverRouter = createTRPCRouter({
  // ── Discover Feed: Posts from recommended clubs ─────────────────────
  getDiscoverFeed: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(12),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;
      const userId = ctx.user.id;

      try {
        // 1. Get recommended club IDs using the advanced hybrid algorithm (top 20 for post variety)
        const recommendedClubIds = await getRecommendedClubIds(userId, 20);

        if (recommendedClubIds.length === 0) {
          // No recommendations available - empty state will be handled on frontend
          return { posts: [], nextCursor: null };
        }

        // 2. Fetch posts from recommended clubs (all posts for better scrolling experience)
        const posts = await prisma.post.findMany({
          where: {
            clubId: { in: recommendedClubIds },
            status: "PUBLISHED",
          },
          orderBy: [
            { type: "desc" }, // ANNOUNCEMENT first
            { priority: "desc" }, // URGENT > IMPORTANT > GENERAL
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
            upvotes: { where: { userId }, select: { id: true } },
          },
        });

        let nextCursor: string | null = null;
        if (posts.length > limit) {
          const nextItem = posts.pop();
          nextCursor = nextItem!.id;
        }

        return { 
          posts: posts.map((post) => ({
            id: post.id,
            type: post.type,
            title: post.title,
            content: post.content,
            priority: post.priority,
            createdAt: post.createdAt,
            club: {
              id: post.club.id,
              title: post.club.title,
              imageUrl: post.club.imageUrl,
              types: post.club.types,
            },
            author: {
              id: post.author.id,
              firstName: post.author.firstName,
              lastName: post.author.lastName,
              avatarUrl: post.author.avatarUrl,
            },
            upvotesCount: post._count.upvotes,
            hasUpvoted: post.upvotes.length > 0,
          })), 
          nextCursor 
        };
      } catch (error) {
        console.error("Error in discover.getDiscoverFeed:", error);
        throw new Error(`Failed to fetch discover feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // ── Trending Feed: Global trending posts ───────────────────────────
  getTrendingPosts: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(12),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;
      const userId = ctx.user.id;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Fetch posts from last 30 days (including unpublished for now)
      const posts = await prisma.post.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
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
          upvotes: { where: { userId }, select: { id: true } },
        },
      });

      // Calculate trending score and filter
      const now = Date.now();
      const scoredPosts = posts
        .map((post) => {
          const upvoteCount = post._count.upvotes;
          
          // Filter: minimum 3 upvotes
          if (upvoteCount < 2) return null;

          // Calculate trending score
          const engagement = upvoteCount * 2;
          const daysOld = (now - post.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          const recency = Math.max(0, (30 - daysOld) / 30);
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

      return { 
        posts: paginatedPosts.map((post) => ({
          id: post.id,
          type: post.type,
          title: post.title,
          content: post.content,
          priority: post.priority,
          createdAt: post.createdAt,
          club: {
            id: post.club.id,
            title: post.club.title,
            imageUrl: post.club.imageUrl,
            types: post.club.types,
          },
          author: {
            id: post.author.id,
            firstName: post.author.firstName,
            lastName: post.author.lastName,
            avatarUrl: post.author.avatarUrl,
          },
          upvotesCount: post._count.upvotes,
          hasUpvoted: post.upvotes.length > 0,
          trendingScore: post.trendingScore,
        })), 
        nextCursor 
      };
    }),
});
