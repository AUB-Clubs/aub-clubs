import { z } from "zod";
import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";

export const analyticsRouter = createTRPCRouter({
  getClubAnalytics: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify they have access to analytics
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId: input.clubId } },
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
});
