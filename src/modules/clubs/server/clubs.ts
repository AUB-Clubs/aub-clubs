import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../../../trpc/init"
import { prisma } from "@/lib/prisma"

type ClubRole = "MEMBER" | "PRESIDENT" | "VICE_PRESIDENT"

/** Post with author and upvote count (getForumPosts) */
interface ForumPostWithAuthor {
  id: string
  authorId: string
  type: "ANNOUNCEMENT" | "GENERAL"
  title: string
  content: string
  createdAt: Date
  author: { firstName: string; lastName: string }
  _count: { upvotes: number }
}

/** Membership with userId and role (author list) */
interface MembershipRoleRow {
  userId: string
  role: ClubRole
}

/** Membership with user (getMembers) */
interface MembershipWithUser {
  id: string
  userId: string
  role: ClubRole
  joinedAt: Date
  user: { firstName: string; lastName: string; email: string }
}

/** Post with author and images (getAnnouncements) */
interface AnnouncementPostWithAuthor {
  id: string
  title: string
  content: string
  createdAt: Date
  author: { id: string; firstName: string; lastName: string }
  postImages: { imageUrl: string }[]
  _count: { upvotes: number }
}

export const clubsRouter = createTRPCRouter({
  /**
   * Simple sanity check endpoint
   */
  ping: baseProcedure.query(async ({ ctx }) => {
    return {
      ok: true,
      userId: ctx.userId,
    }
  }),

  /**
   * Get overview data for a single club
   */
  getOverview: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { clubId } = input

      // 1. Check membership
      const membership = await prisma.membership.findUnique({
        where: {
          userId_clubId: {
            userId: ctx.userId,
            clubId,
          },
        },
        select: {
          role: true,
        },
      })

      if (!membership) {
        throw new Error("Not a member of this club")
      }

      // 2. Fetch club info
      const club = await prisma.club.findUnique({
        where: { id: clubId },
        select: {
          id: true,
          title: true,
          description: true,
          image_url: true,
          banner_url: true,
        },
      })

      if (!club) {
        throw new Error("Club not found")
      }

      // 3. Stats
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const [membersCount, postsThisWeek] = await Promise.all([
        prisma.membership.count({
          where: { clubId },
        }),
        prisma.post.count({
          where: {
            clubId,
            createdAt: { gte: oneWeekAgo },
          },
        }),
      ])

      return {
        club,
        stats: {
          members: membersCount,
          postsThisWeek,
          upcomingEvents: 0,
          pendingRequests: 0,
        },
        role: membership.role,
      }
    }),

  /**
   * Get forum posts for a club
   */
  getForumPosts: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input

      // 1. Ensure membership
      const myMembership = await prisma.membership.findUnique({
        where: {
          userId_clubId: {
            userId: ctx.userId,
            clubId,
          },
        },
        select: { role: true },
      })

      if (!myMembership) {
        throw new Error("Unauthorized")
      }

      // 2. Fetch posts
      const posts = await prisma.post.findMany({
        where: { clubId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { upvotes: true },
          },
        },
      })

      // 3. Fetch author roles in this club
      const authorIds = [...new Set(posts.map((post: ForumPostWithAuthor) => post.authorId))]
      const authorMemberships = await prisma.membership.findMany({
        where: {
          clubId,
          userId: { in: authorIds },
        },
        select: {
          userId: true,
          role: true,
        },
      })

      const roleByUserId = new Map<string, ClubRole>(
        authorMemberships.map((membership: MembershipRoleRow) => [membership.userId, membership.role])
      )

      // 4. Shape data for frontend (no Comment model in schema, so commentsCount is 0)
      return posts.map((post: ForumPostWithAuthor) => ({
        id: post.id,
        type: post.type === "ANNOUNCEMENT" ? "announcement" : "discussion",
        title: post.title,
        content: post.content,
        author: `${post.author.firstName} ${post.author.lastName}`,
        authorId: post.authorId,
        role: roleByUserId.get(post.authorId) ?? "MEMBER",
        commentsCount: 0,
        upvoteCount: post._count.upvotes,
        createdAt: post.createdAt.toISOString(),
      }))
    }),

  getMembers: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input

      const myMembership = await prisma.membership.findUnique({
        where: {
          userId_clubId: { userId: ctx.userId, clubId },
        },
        select: { role: true },
      })

      if (!myMembership) {
        throw new Error("Unauthorized")
      }

      const memberships = await prisma.membership.findMany({
        where: { clubId },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      })

      return memberships.map((member: MembershipWithUser) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
      }))
    }),

  getAnnouncements: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input

      const myMembership = await prisma.membership.findUnique({
        where: {
          userId_clubId: { userId: ctx.userId, clubId },
        },
        select: { role: true },
      })

      if (!myMembership) {
        throw new Error("Unauthorized")
      }

      const posts = await prisma.post.findMany({
        where: { clubId, type: "ANNOUNCEMENT" },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          postImages: {
            select: { id: true, imageUrl: true },
          },
          _count: { select: { upvotes: true } },
        },
      })

      return posts.map((announcement: AnnouncementPostWithAuthor) => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        createdAt: announcement.createdAt.toISOString(),
        author: `${announcement.author.firstName} ${announcement.author.lastName}`,
        authorId: announcement.author.id,
        imageUrls: announcement.postImages.map((img) => img.imageUrl),
        upvoteCount: announcement._count.upvotes,
      }))
    }),
})
