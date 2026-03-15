import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { prisma } from '@/lib/prisma';

const GetAnnouncementsInput = z.object({
  page:  z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(10),
});

const AnnouncementSchema = z.object({
  id:        z.string(),
  title:     z.string(),
  content:   z.string(),
  createdAt: z.date(),
  club: z.object({
    id:       z.string(),
    title:    z.string(),
    imageUrl: z.string().nullable(),
  }),
});

const GetAnnouncementsOutput = z.object({
  announcements: z.array(AnnouncementSchema),
  totalPages:    z.number(),
  currentPage:   z.number(),
});

export const forumRouter = createTRPCRouter({
  getAnnouncements: baseProcedure
    .input(GetAnnouncementsInput)
    .output(GetAnnouncementsOutput)
    .query(async function ({ input }) {
      const { page, limit } = input;
      const skip = (page - 1) * limit;

      const [announcements, totalCount] = await Promise.all([
        prisma.post.findMany({
          where: {
            type:     'ANNOUNCEMENT',
            status:   'PUBLISHED',
            audience: 'PUBLIC',
          },
          include: {
            club: {
              select: {
                id:       true,
                title:    true,
                imageUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.post.count({
          where: {
            type:     'ANNOUNCEMENT',
            status:   'PUBLISHED',
            audience: 'PUBLIC',
          },
        }),
      ]);

      return {
        announcements,
        totalPages:  Math.ceil(totalCount / limit),
        currentPage: page,
      };
    }),
});