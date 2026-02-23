import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../../../trpc/init"
import { prisma } from "@/lib/prisma"

const INACTIVE_DAYS = 30

async function requireClubAdmin(ctx: { userId: string }, clubId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId: ctx.userId, clubId } },
    select: { role: true },
  })
  if (!membership) throw new Error("Not a member of this club")
  if (membership.role !== "PRESIDENT" && membership.role !== "VICE_PRESIDENT") {
    throw new Error("Only club admins can manage members")
  }
}

export const memberManagementRouter = createTRPCRouter({
  getDashboard: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)
      const { clubId } = input

      const [memberships, pendingRequests, clubPosts, clubUpvotes] = await Promise.all([
        prisma.membership.findMany({
          where: { clubId },
          orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        }),
        prisma.membershipRequest.findMany({
          where: { clubId, status: "PENDING" },
          orderBy: { requestedAt: "desc" },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        }),
        prisma.post.findMany({
          where: { clubId },
          select: { authorId: true, createdAt: true },
        }),
        prisma.upvote.findMany({
          where: { post: { clubId } },
          select: { userId: true, createdAt: true },
        }),
      ])

      const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000)
      const lastPostByUser = new Map<string, Date>()
      for (const p of clubPosts) {
        const d = p.createdAt
        if (!lastPostByUser.has(p.authorId) || lastPostByUser.get(p.authorId)! < d) {
          lastPostByUser.set(p.authorId, d)
        }
      }
      const lastUpvoteByUser = new Map<string, Date>()
      for (const u of clubUpvotes) {
        const d = u.createdAt
        if (!lastUpvoteByUser.has(u.userId) || lastUpvoteByUser.get(u.userId)! < d) {
          lastUpvoteByUser.set(u.userId, d)
        }
      }

      const members = memberships.map((m) => {
        const lastPost = lastPostByUser.get(m.userId)
        const lastUpvote = lastUpvoteByUser.get(m.userId)
        const lastActivity =
          [lastPost, lastUpvote].filter(Boolean).length > 0
            ? new Date(Math.max((lastPost?.getTime() ?? 0), (lastUpvote?.getTime() ?? 0)))
            : null
        const isActive = lastActivity ? lastActivity >= cutoff : false
        return {
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          lastActivityAt: lastActivity?.toISOString() ?? null,
          isActive,
        }
      })

      return {
        members,
        pendingRequests: pendingRequests.map((r) => ({
          id: r.id,
          userId: r.userId,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          email: r.user.email,
          requestedAt: r.requestedAt.toISOString(),
        })),
      }
    }),

  respondToRequest: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        requestId: z.string(),
        action: z.enum(["accept", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const request = await prisma.membershipRequest.findFirst({
        where: { id: input.requestId, clubId: input.clubId, status: "PENDING" },
      })
      if (!request) throw new Error("Request not found or already handled")

      if (input.action === "accept") {
        await prisma.$transaction([
          prisma.membership.create({
            data: { userId: request.userId, clubId: input.clubId, role: "MEMBER" },
          }),
          prisma.membershipRequest.update({
            where: { id: input.requestId },
            data: { status: "ACCEPTED", respondedAt: new Date(), respondedBy: ctx.userId },
          }),
        ])
      } else {
        await prisma.membershipRequest.update({
          where: { id: input.requestId },
          data: { status: "REJECTED", respondedAt: new Date(), respondedBy: ctx.userId },
        })
      }

      return { ok: true, action: input.action }
    }),

  removeRequest: baseProcedure
    .input(z.object({ clubId: z.string(), requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const request = await prisma.membershipRequest.findFirst({
        where: { id: input.requestId, clubId: input.clubId, status: "PENDING" },
      })
      if (!request) throw new Error("Request not found or already handled")

      await prisma.membershipRequest.delete({ where: { id: input.requestId } })
      return { ok: true }
    }),

  kickMember: baseProcedure
    .input(z.object({ clubId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)
      if (ctx.userId === input.userId) throw new Error("You cannot kick yourself")

      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: input.userId, clubId: input.clubId } },
      })
      if (!membership) throw new Error("Member not found")

      await prisma.membership.delete({
        where: { userId_clubId: { userId: input.userId, clubId: input.clubId } },
      })
      return { ok: true }
    }),

  requestToJoin: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId: input.clubId } },
      })
      if (existing) throw new Error("Already a member")

      const pending = await prisma.membershipRequest.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId: input.clubId } },
      })
      if (pending && pending.status === "PENDING") throw new Error("Request already pending")

      await prisma.membershipRequest.upsert({
        where: { userId_clubId: { userId: ctx.userId, clubId: input.clubId } },
        create: { userId: ctx.userId, clubId: input.clubId, status: "PENDING" },
        update: { status: "PENDING", respondedAt: null, respondedBy: null },
      })
      return { ok: true }
    }),
})