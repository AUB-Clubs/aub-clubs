import { prisma } from "@/lib/prisma";

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

// ── Shared Recommendation Algorithm ─────────────────────────────────────

/**
 * Get recommended club IDs using hybrid algorithm (content + collaborative filtering)
 * This is shared between the recommendations UI and the discover feed
 */
export async function getRecommendedClubIds(
  userId: string, 
  limit: number = 6
): Promise<string[]> {
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

  // If user has no clubs, return empty array
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
          // should filter to only published posts, temporary fix
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

  // 5. Sort and return top N club IDs
  const topClubIds = scoredClubs
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(club => club.id);

  return topClubIds;
}

/**
 * Get recommended clubs with full details (for UI display)
 * This is what the recommendations router uses
 */
export async function getRecommendedClubsWithDetails(
  userId: string, 
  limit: number = 6
) {
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

  // If user has no clubs, return empty array
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
          // status: "PUBLISHED",
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
}