import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "../../../trpc/init"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"

// ── helpers ──────────────────────────────────────────────────────────


async function getActorMembership(userId: string, clubId: string) {
  const m = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
    select: { role: true, status: true },
  })
  if (!m || m.status !== "ACCEPTED") return null
  return m
}

async function requireClubAdmin(ctx: { userId: string }, clubId: string) {
  const m = await getActorMembership(ctx.userId, clubId)
  if (!m) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not an active member" })
  }
  if (m.role !== "PRESIDENT" && m.role !== "VICE_PRESIDENT") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only club admins can manage members" })
  }
  return m
}

// ── router ───────────────────────────────────────────────────────────

export const memberManagementRouter = createTRPCRouter({
  // ── Members (paginated) ────────────────────────────────────────────
  getMembers: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)
      const { clubId, page, limit } = input
      const skip = (page - 1) * limit

      const [members, totalCount] = await Promise.all([
        prisma.membership.findMany({
          where: { clubId, status: "ACCEPTED" },
          orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        }),
        prisma.membership.count({ where: { clubId, status: "ACCEPTED" } }),
      ])

      return {
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          customTitle: m.customTitle,
          joinedAt: m.joinedAt.toISOString(),
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
        })),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      }
    }),

  // ── Pending Requests ───────────────────────────────────────────────
  getPendingRequests: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const pending = await prisma.membership.findMany({
        where: { clubId: input.clubId, status: "PENDING" },
        orderBy: { joinedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      })

      return pending.map((m) => ({
        id: m.id,
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        requestedAt: m.joinedAt.toISOString(),
      }))
    }),

  // ── Accept / Reject request ────────────────────────────────────────
  respondToRequest: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        membershipId: z.string(),
        action: z.enum(["accept", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const membership = await prisma.membership.findFirst({
        where: { id: input.membershipId, clubId: input.clubId, status: "PENDING" },
      })
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found or already handled" })
      }

      const newStatus = input.action === "accept" ? "ACCEPTED" : "REJECTED"

      await prisma.$transaction([
        prisma.membership.update({
          where: { id: input.membershipId },
          data: { status: newStatus },
        }),
        prisma.membershipAuditLog.create({
          data: {
            membershipId: input.membershipId,
            actorId: ctx.userId,
            action: input.action === "accept" ? "ACCEPTED" : "REJECTED",
          },
        }),
      ])

      return { ok: true, action: input.action }
    }),

  // ── Kick member ────────────────────────────────────────────────────
  kickMember: baseProcedure
    .input(z.object({ clubId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = await requireClubAdmin(ctx, input.clubId)

      if (ctx.userId === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot kick yourself" })
      }

      const target = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: input.userId, clubId: input.clubId } },
        select: { id: true, role: true },
      })
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      // Vice President cannot kick President
      if (actor.role === "VICE_PRESIDENT" && target.role === "PRESIDENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vice Presidents cannot kick the President" })
      }

      await prisma.$transaction([
        prisma.membershipAuditLog.create({
          data: {
            membershipId: target.id,
            actorId: ctx.userId,
            action: "REVOKED",
          },
        }),
        prisma.membership.delete({
          where: { userId_clubId: { userId: input.userId, clubId: input.clubId } },
        }),
      ])

      return { ok: true }
    }),

  // ── Change role ────────────────────────────────────────────────────
  changeRole: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        userId: z.string(),
        newRole: z.enum(["MEMBER", "BOARD", "VICE_PRESIDENT", "PRESIDENT"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await requireClubAdmin(ctx, input.clubId)

      const target = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: input.userId, clubId: input.clubId } },
        select: { role: true },
      })
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" })
      }

      // Only president can change roles
      if (actor.role !== "PRESIDENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the President can change roles" })
      }

      // Cannot demote yourself below president
      if (ctx.userId === input.userId && input.newRole !== "PRESIDENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot demote yourself" })
      }

      await prisma.membership.update({
        where: { userId_clubId: { userId: input.userId, clubId: input.clubId } },
        data: { role: input.newRole },
      })

      return { ok: true, newRole: input.newRole }
    }),

  // ── Admin announcements (all statuses) ─────────────────────────────
  getAdminAnnouncements: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const posts = await prisma.post.findMany({
        where: { clubId: input.clubId, type: "ANNOUNCEMENT" },
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      return posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        status: p.status,
        audience: p.audience,
        createdAt: p.createdAt.toISOString(),
        author: `${p.author.firstName} ${p.author.lastName}`,
        authorId: p.authorId,
      }))
    }),

  // ── Create announcement (always DRAFT) ─────────────────────────────
  createAnnouncement: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(10000),
        audience: z.enum(["PUBLIC", "MEMBERS_ONLY", "BOARD_ONLY"]).default("PUBLIC"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const post = await prisma.post.create({
        data: {
          clubId: input.clubId,
          authorId: ctx.userId,
          title: input.title,
          content: input.content,
          type: "ANNOUNCEMENT",
          status: "DRAFT",
          audience: input.audience,
        },
      })

      return {
        id: post.id,
        title: post.title,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
      }
    }),

  // ── Review announcement (approve / reject) ─────────────────────────
  reviewAnnouncement: baseProcedure
    .input(
      z.object({
        clubId: z.string(),
        postId: z.string(),
        action: z.enum(["approve", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx, input.clubId)

      const post = await prisma.post.findFirst({
        where: { id: input.postId, clubId: input.clubId, type: "ANNOUNCEMENT", status: "DRAFT" },
      })
      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Draft announcement not found" })
      }

      if (input.action === "approve") {
        await prisma.post.update({
          where: { id: input.postId },
          data: { status: "PUBLISHED" },
        })
      } else {
        // Reject — delete the draft
        await prisma.post.delete({ where: { id: input.postId } })
      }

      return { ok: true, action: input.action }
    }),
})