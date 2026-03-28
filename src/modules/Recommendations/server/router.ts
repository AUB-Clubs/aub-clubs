import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";

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

      // 1. Get user's memberships and extract preferred types
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

      // If user has no clubs, return empty array (will show popular clubs fallback on frontend)
      if (preferredTypes.length === 0) {
        return [];
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // 2. Content-based scoring
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
          description: true,
          imageUrl: true,
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

      // 3. Collaborative filtering - find similar users
      const similarUsers = await prisma.user.findMany({
        where: {
          id: { not: userId },
          memberships: {
            some: {
              clubId: { in: joinedClubIds },
              status: "ACCEPTED",
            },
          },
        },
        select: {
          id: true,
          memberships: {
            where: { status: "ACCEPTED" },
            select: { clubId: true },
          },
        },
      });

      // Filter users with 2+ shared clubs
      const qualifiedSimilarUsers = similarUsers.filter((user) => {
        const sharedClubs = user.memberships.filter((m) =>
          joinedClubIds.includes(m.clubId)
        );
        return sharedClubs.length >= 2;
      });

      // Build collaborative score map
      const collaborativeScores: Record<string, number> = {};
      const totalSimilarUsers = qualifiedSimilarUsers.length;

      if (totalSimilarUsers > 0) {
        qualifiedSimilarUsers.forEach((user) => {
          user.memberships.forEach((membership) => {
            if (!joinedClubIds.includes(membership.clubId)) {
              collaborativeScores[membership.clubId] =
                (collaborativeScores[membership.clubId] || 0) + 1;
            }
          });
        });

        // Normalize collaborative scores
        Object.keys(collaborativeScores).forEach((clubId) => {
          collaborativeScores[clubId] =
            (collaborativeScores[clubId] / totalSimilarUsers) * 3;
        });
      }

      // 4. Merge scores
      const scoredClubs = candidateClubs.map((club) => {
        // Content score
        const typeMatches = club.types.filter((t) => preferredTypes.includes(t)).length;
        const announcements = club.posts.filter((p) => p.type === "ANNOUNCEMENT").length;
        const posts = club.posts.filter((p) => p.type === "GENERAL").length;
        const activity = announcements * 0.8 + posts * 0.2;
        const contentScore =
          typeMatches * 5 + activity * 2 + club._count.memberships * 0.1;

        // Collaborative score
        const collaborativeScore = collaborativeScores[club.id] || 0;

        // Final score
        const finalScore = contentScore + collaborativeScore;

        return {
          id: club.id,
          title: club.title,
          description: club.description,
          imageUrl: club.imageUrl,
          types: club.types,
          memberCount: club._count.memberships,
          score: finalScore,
        };
      });

      // 5. Sort and return top N
      const topClubs = scoredClubs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return topClubs;
    }),
});
