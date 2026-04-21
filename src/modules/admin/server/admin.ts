import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { prisma } from '@/lib/prisma';

const ClubStatusEnum = z.enum(['PENDING_REVIEW', 'ACTIVE', 'INACTIVE']);

export const adminRouter = createTRPCRouter({
  listClubsForReview: baseProcedure
    .input(
      z.object({
        status: ClubStatusEnum.optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const { status, page, limit } = input;
      const skip = (page - 1) * limit;
      const where = status ? { status } : {};

      const [clubs, total] = await Promise.all([
        prisma.club.findMany({
          where,
          skip,
          take: limit,
          orderBy: { title: 'asc' },
          select: {
            id: true,
            crn: true,
            title: true,
            description: true,
            imageUrl: true,
            status: true,
            types: true,
            _count: { select: { memberships: true } },
          },
        }),
        prisma.club.count({ where }),
      ]);

      return {
        clubs,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      };
    }),

  setClubStatus: baseProcedure
    .input(
      z.object({
        clubId: z.string().uuid(),
        status: ClubStatusEnum,
      })
    )
    .mutation(async ({ input }) => {
      return prisma.club.update({
        where: { id: input.clubId },
        data: { status: input.status },
        select: { id: true, title: true, status: true },
      });
    }),
});
