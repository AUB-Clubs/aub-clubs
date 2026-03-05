import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';

const ClubSchema = z.object({
  id:          z.string(),
  crn:         z.number(),
  title:       z.string(),
  description: z.string(),
  image_url:   z.string().nullable(),
  banner_url:  z.string().nullable(),
  _count: z.object({
    memberships: z.number(),
  }).optional(),
})

const ClubListSchema = z.array(ClubSchema);

const GetClubByIdInput = z.object({
  id: z.string().uuid(),
})

export const clubsRouter = createTRPCRouter({
  getAllClubs: baseProcedure
    .output(ClubListSchema)
    .query(async function () {
      const clubs = await prisma.club.findMany({
        include: {
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      });

      return clubs.map(function (club) {
        return {
          id:          club.id,
          crn:         club.crn,
          title:       club.title,
          description: club.description,
          image_url:   club.imageUrl,
          banner_url:  club.bannerUrl,
          _count:      club._count,
        };
      });
    }),

  getClubById: baseProcedure
    .input(GetClubByIdInput)
    .output(ClubSchema)
    .query(async function ({ input }) {
      const club = await prisma.club.findUnique({
        where: {
          id: input.id,
        },
        include: {
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      });

      if (!club) {
        throw new Error('club not found');
      }

      return {
        id:          club.id,
        crn:         club.crn,
        title:       club.title,
        description: club.description,
        image_url:   club.imageUrl,
        banner_url:  club.bannerUrl,
        _count:      club._count,
      };
    }),
});