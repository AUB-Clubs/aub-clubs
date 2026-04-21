import { z } from "zod";
import { createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "@/modules/auth/server/middleware";

async function assertClubOfficer(userId: string, clubId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_clubId: { userId, clubId } },
    select: { role: true, status: true },
  });
  if (
    !membership ||
    membership.status !== "ACCEPTED" ||
    (membership.role !== "PRESIDENT" && membership.role !== "VICE_PRESIDENT")
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only club presidents and vice presidents can manage this" });
  }
}

export const analyticsRouter = createTRPCRouter({
  getClubAnalytics: protectedProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify they have access to analytics
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.user.id, clubId: input.clubId } },
        select: { role: true, status: true },
      });

      if (!membership || membership.status !== "ACCEPTED" || (membership.role !== "PRESIDENT" && membership.role !== "VICE_PRESIDENT")) {
         throw new TRPCError({ code: "FORBIDDEN", message: "Only club admins can view analytics" });
      }

      // Fetch aggregated data
      const [membersCount, eventsCount, postsCount] = await Promise.all([
        prisma.membership.count({
          where: { clubId: input.clubId, status: "ACCEPTED" },
        }),
        prisma.event.count({
          where: { clubId: input.clubId },
        }),
        prisma.post.count({
          where: { clubId: input.clubId, status: "PUBLISHED" },
        }),
      ]);

      const club = await prisma.club.findUnique({
        where: { id: input.clubId },
        select: { title: true }
      });

      return {
        clubName: club?.title || "Unknown Club",
        membersCount,
        eventsCount,
        postsCount,
      };
    }),

    getClubActivityOverTime: protectedProcedure
  .input(z.object({
    clubId: z.string(),
    interval: z.enum(["monthly", "yearly"]).default("monthly"),
  }))
  .query(async ({ ctx, input }) => {
    await assertClubOfficer(ctx.user.id, input.clubId);

    type ActivityRow = {
      period: string
      count: number
    }

    const groupByFormat =
      input.interval === "monthly"
        ? "YYYY-MM"
        : "YYYY";

    const posts = await prisma.$queryRaw<ActivityRow[]>`
      SELECT to_char(p.created_at, ${groupByFormat}) as period,
            COUNT(*)::int as count
      FROM posts p
      WHERE p.club_id = ${input.clubId}
        AND p.status = 'PUBLISHED'
      GROUP BY period
      ORDER BY period ASC;
    `;

    const events = await prisma.$queryRaw<ActivityRow[]>`
      SELECT to_char(e.starts_at, ${groupByFormat}) as period,
             COUNT(*)::int as count
      FROM events e
      WHERE e.club_id = ${input.clubId}
      GROUP BY period
      ORDER BY period ASC;
    `;

    return {
      posts,
      events,
    };
  }),

  logFinance: protectedProcedure
  .input(z.object({
    clubId: z.string(),
    amount: z.number().positive(),
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().max(500).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    await assertClubOfficer(ctx.user.id, input.clubId);

    return prisma.clubFinance.create({
      data: {
        clubId: input.clubId,
        amount: input.amount,
        type: input.type,
        description: input.description,
      },
    });
  }),

  getClubFinances: protectedProcedure
  .input(z.object({ clubId: z.string() }))
  .query(async ({ ctx, input }) => {
    await assertClubOfficer(ctx.user.id, input.clubId);

    const records = await prisma.clubFinance.findMany({
      where: { clubId: input.clubId },
      orderBy: { createdAt: "desc" },
    });

    const balance = records.reduce((acc, r) =>
      r.type === "INCOME" ? acc + r.amount : acc - r.amount
    , 0);

    return {
      records,
      balance,
    };
  }),

});
