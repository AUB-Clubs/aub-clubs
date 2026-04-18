import { z } from 'zod';
import { protectedProcedure } from '@/modules/auth/server/middleware';
import { createTRPCRouter } from '@/trpc/init';
import { prisma } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';

const ClubStatusEnum = z.enum(['PENDING_REVIEW', 'ACTIVE', 'INACTIVE']);

async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  
  if (user?.email?.endsWith('@admin.aub.edu.lb')) return true;
  
  const adminEmails = ['admin@aub.edu.lb', 'superadmin@aub.edu.lb'];
  if (user?.email && adminEmails.includes(user.email)) return true;
  
  return false;
}

export const adminRouter = createTRPCRouter({
  listClubsForReview: protectedProcedure
    .input(
      z.object({
        status: ClubStatusEnum.optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const adminCheck = await isAdmin(ctx.user.id);
      if (!adminCheck) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required.',
        });
      }
      
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
            _count: {
              select: { memberships: true }
            },
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

  setClubStatus: protectedProcedure
    .input(
      z.object({
        clubId: z.string().uuid(),
        status: ClubStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminCheck = await isAdmin(ctx.user.id);
      if (!adminCheck) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required.',
        });
      }
      
      return prisma.club.update({
        where: { id: input.clubId },
        data: { status: input.status },
        select: { id: true, title: true, status: true },
      });
    }),
});