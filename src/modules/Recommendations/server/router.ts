import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";
import { getRecommendedClubsWithDetails } from "./algorithms";

// ── Types & Helpers ────────────────────────────────────────────────────

type CommitmentLevel = "HIGH" | "MEDIUM" | "LOW";

function computeCommitmentLevel(latestAnnouncementDate: Date | null): CommitmentLevel {
  if (!latestAnnouncementDate) return "LOW";
  const diffMs = Date.now() - latestAnnouncementDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 10) return "HIGH";
  if (diffDays <= 30) return "MEDIUM";
  return "LOW";
}

// ── Router ────────────────────────────────────────────────────────────

export const recommendationsRouter = createTRPCRouter({
  // ── Component A: Similar Clubs ─────────────────────────────────────
  getSimilarClubs: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input;
      const userId = ctx.userId;

      // 1. Fetch current club
      const currentClub = await prisma.club.findUnique({
        where: { id: clubId },
        select: {
          id: true,
          types: true,
          _count: {
            select: { memberships: true },
          },
        },
      });

      if (!currentClub) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Club not found",
        });
      }

      // Get commitment level for current club
      const currentClubLatestAnnouncement = await prisma.post.findFirst({
        where: {
          clubId,
          type: "ANNOUNCEMENT",
          status: "PUBLISHED",
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const currentCommitmentLevel = computeCommitmentLevel(
        currentClubLatestAnnouncement?.createdAt ?? null
      );

      // 2. Get user's joined club IDs
      const userMemberships = await prisma.membership.findMany({
        where: {
          userId,
          status: "ACCEPTED",
        },
        select: { clubId: true },
      });
      const joinedClubIds = userMemberships.map((m) => m.clubId);

      // 3. Query candidate clubs with at least 1 type overlap
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const candidateClubs = await prisma.club.findMany({
        where: {
          AND: [
            { id: { not: clubId } },
            { id: { notIn: joinedClubIds } },
            { types: { hasSome: currentClub.types } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          types: true,
          _count: {
            select: {
              memberships: true,
            },
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

      // 4. Score each candidate
      const scoredClubs = await Promise.all(
        candidateClubs.map(async (club) => {
          // Type overlap count
          const typeOverlap = club.types.filter((t) =>
            currentClub.types.includes(t)
          ).length;

          // Member count similarity
          const currentMembers = currentClub._count.memberships;
          const candidateMembers = club._count.memberships;
          const memberSimilarity =
            1 - Math.abs(currentMembers - candidateMembers) / Math.max(currentMembers, candidateMembers || 1);

          // Get commitment level for candidate club
          const latestAnnouncement = await prisma.post.findFirst({
            where: {
              clubId: club.id,
              type: "ANNOUNCEMENT",
              status: "PUBLISHED",
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });

          const candidateCommitmentLevel = computeCommitmentLevel(
            latestAnnouncement?.createdAt ?? null
          );
          const commitmentMatch = currentCommitmentLevel === candidateCommitmentLevel ? 1 : 0;

          // Activity score (announcements × 0.8 + posts × 0.2)
          const announcements = club.posts.filter((p) => p.type === "ANNOUNCEMENT").length;
          const posts = club.posts.filter((p) => p.type === "GENERAL").length;
          const activityScore = announcements * 0.8 + posts * 0.2;

          // Calculate final score
          const score =
            typeOverlap * 5 +
            memberSimilarity * 3 +
            commitmentMatch * 2 +
            activityScore * 1.5;

          return {
            id: club.id,
            title: club.title,
            description: club.description,
            imageUrl: club.imageUrl,
            types: club.types,
            memberCount: club._count.memberships,
            score,
          };
        })
      );

      // 5. Sort by score and take top N
      const topClubs = scoredClubs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return topClubs;
    }),

  // ── Component B: Recommended Clubs ─────────────────────────────────
  getRecommendedClubs: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;
      const userId = ctx.userId;

      try {
        return await getRecommendedClubsWithDetails(userId, limit);
      } catch (error) {
        console.error("Error in recommendations.getRecommendedClubs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get recommended clubs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
});
