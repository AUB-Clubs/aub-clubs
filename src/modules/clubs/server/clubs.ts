import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../../../trpc/init"
import { prisma } from "@/lib/prisma"

export const clubsRouter = createTRPCRouter({
  ping: baseProcedure.query(({ ctx }) => ({ ok: true, userId: ctx.userId })),

  getOverview: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { clubId } = input
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId } },
        select: { role: true },
      })
      if (!membership) throw new Error("Not a member of this club")

      const club = await prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true, title: true, description: true, image_url: true, banner_url: true },
      })
      if (!club) throw new Error("Club not found")

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const [membersCount, postsThisWeek] = await Promise.all([
        prisma.membership.count({ where: { clubId } }),
        prisma.post.count({ where: { clubId, createdAt: { gte: oneWeekAgo } } }),
      ])

      return {
        club,
        stats: { members: membersCount, postsThisWeek },
        role: membership.role,
      }
    }),

  getForumPosts: baseProcedure
    .input(z.object({ clubId: z.string(), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId } },
        select: { role: true },
      })
      if (!membership) throw new Error("Unauthorized")

      const posts = await prisma.post.findMany({
        where: { clubId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { upvotes: true } },
        },
      })

      const authorIds = [...new Set(posts.map((post: typeof posts[number]) => post.authorId))]
      const authorRoles = await prisma.membership.findMany({
        where: { clubId, userId: { in: authorIds } },
        select: { userId: true, role: true },
      })
      const roleByUserId = new Map(
        authorRoles.map((r: typeof authorRoles[number]) => [r.userId, r.role])
      )

      return posts.map((post: typeof posts[number]) => ({
        id: post.id,
        type: post.type === "ANNOUNCEMENT" ? "announcement" : "discussion",
        title: post.title,
        content: post.content,
        author: `${post.author.firstName} ${post.author.lastName}`,
        authorId: post.authorId,
        role: roleByUserId.get(post.authorId) ?? "MEMBER",
        upvoteCount: post._count.upvotes,
        createdAt: post.createdAt.toISOString(),
      }))
    }),

  getMembers: baseProcedure
    .input(z.object({ clubId: z.string(), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId } },
        select: { role: true },
      })
      if (!membership) throw new Error("Unauthorized")

      const memberships = await prisma.membership.findMany({
        where: { clubId },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        take: limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      })

      return memberships.map((m: typeof memberships[number]) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
      }))
    }),

  getAnnouncements: baseProcedure
    .input(z.object({ clubId: z.string(), limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId } },
        select: { role: true },
      })
      if (!membership) throw new Error("Unauthorized")

      const posts = await prisma.post.findMany({
        where: { clubId, type: "ANNOUNCEMENT" },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          postImages: { select: { imageUrl: true } },
          _count: { select: { upvotes: true } },
        },
      })

      return posts.map((p: typeof posts[number]) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt.toISOString(),
        author: `${p.author.firstName} ${p.author.lastName}`,
        authorId: p.author.id,
        imageUrls: p.postImages.map(
          (img: typeof p.postImages[number]) => img.imageUrl
        ),
        upvoteCount: p._count.upvotes,
      }))
    }),

  createPost: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(10000),
        type: z.enum(["GENERAL", "ANNOUNCEMENT"]).default("GENERAL"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId: input.clubId } },
        select: { role: true },
      })
      if (!membership) throw new Error("Not a member of this club")
      if (input.type === "ANNOUNCEMENT" && membership.role !== "PRESIDENT" && membership.role !== "VICE_PRESIDENT") {
        throw new Error("Only presidents and vice presidents can post announcements")
      }

      const post = await prisma.post.create({
        data: {
          clubId: input.clubId,
          authorId: ctx.userId,
          title: input.title,
          content: input.content,
          type: input.type,
        },
      })
      return { id: post.id, title: post.title, content: post.content, type: post.type, createdAt: post.createdAt.toISOString() }
    }),
})
