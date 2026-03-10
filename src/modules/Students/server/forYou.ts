import { z } from 'zod';
import { createTRPCRouter, baseProcedure } from '../../../trpc/init';
import { prisma } from '@/lib/prisma';

/**
 * For You page backend: announcements and new posts from clubs
 * the user is registered in. Feed items are merged and sorted by created_at.
 */
export const forYouRouter = createTRPCRouter({
  getFeed: baseProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.string().optional(),
          filter: z.enum(['ALL', 'ANNOUNCEMENT', 'GENERAL']).optional().default('ALL'),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;
      const filter = input?.filter ?? 'ALL';

      // Get club ids the current user is registered in
      const memberships = await prisma.membership.findMany({
        where: { userId: ctx.userId },
        select: { clubId: true },
      });
      const clubIds = memberships.map((m) => m.clubId);

      if (clubIds.length === 0) {
        return { items: [], nextCursor: null };
      }

      const posts = await prisma.post.findMany({
        where: {
          clubId: { in: clubIds },
          ...(filter !== 'ALL' ? { type: filter as 'ANNOUNCEMENT' | 'GENERAL' } : {})
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        include: {
          club: {
            select: { id: true, title: true, crn: true, imageUrl: true },
          },
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            }
          },
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId: ctx.userId }, select: { id: true } },
        },
      });

      let nextCursor: typeof cursor | null = null;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      const items = posts.map((p) => ({
        type: p.type === 'ANNOUNCEMENT' ? 'announcement' : 'post',
        id: p.id,
        created_at: p.createdAt,
        data: {
          ...p,
          created_at: p.createdAt,
          club: {
            id: p.club.id,
            Title: p.club.title,
            CRN: p.club.crn,
            image: p.club.imageUrl,
          },
          author: {
            id: p.author.id,
            first_name: p.author.firstName,
            last_name: p.author.lastName,
            avatar_url: p.author.avatarUrl,
          },
          upvotes_count: p._count.upvotes,
          has_upvoted: p.upvotes.length > 0,
        },
      }));

      // Sort is handled by DB order by
      // Cursor pagination is handled by DB

      return {
        items, // TS will infer the union type from the map
        nextCursor,
      };
    }),
  // getRecommendedForYou: baseProcedure
  //   .query(async ({ ctx }) => {
  //     // Get clubs user is in
  //     const userClubs = await prisma.membership.findMany({
  //       where: { userId: ctx.userId },
  //       select: { clubId: true },
  //     });
  //     const userClubIds = userClubs.map((m) => m.clubId);

  //     // Get recommended clubs: NOT in user's clubs, sorted by member count
  //     const recommendedClubs = await prisma.club.findMany({
  //       where: {
  //         id: { notIn: userClubIds },
  //       },
  //       take: 5,
  //       select: {
  //         id: true,
  //         title: true,
  //         description: true,
  //         imageUrl: true,
  //         _count: {
  //           select: { memberships: true },
  //         },
  //         posts: {
  //           where: {
  //             createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  //           },
  //           select: { id: true, title: true, content: true, createdAt: true, type: true },
  //           orderBy: { createdAt: 'desc' },
  //           take: 2,
  //         },
  //       },
  //       orderBy: { memberships: { _count: 'desc' } },
  //     });

  //     return {
  //       clubs: recommendedClubs.map((club) => ({
  //         id: club.id,
  //         title: club.title,
  //         description: club.description,
  //         image_url: club.imageUrl,
  //         membersCount: club._count.memberships,
  //         recentPosts: club.posts.map((p: { id: string; title: string; type: string; createdAt: Date }) => ({
  //           id: p.id,
  //           title: p.title,
  //           type: p.type,
  //           createdAt: p.createdAt,
  //         })),
  //       })),
  //     };
  //   }),


  //  getRecommendedForYou: baseProcedure
  //    .query(async ({ ctx }) => {

  //   // Get user memberships with club types
  //   const userMemberships = await prisma.membership.findMany({
  //     where: { 
  //       userId: ctx.userId,
  //       status: "ACCEPTED"
  //     },
  //     include: {
  //       club: {
  //         select: { types: true }
  //       }
  //     }
  //   });

  //   const userClubIds = userMemberships.map(m => m.clubId);

  //   // Extract user preferred types
  //   const preferredTypes = Array.from(
  //     new Set(
  //       userMemberships.flatMap(m => m.club.types)
  //     )
  //   );

  //   // Get candidate clubs (not in user's clubs)
  //   const candidateClubs = await prisma.club.findMany({
  //     where: {
  //       id: { notIn: userClubIds }
  //     },
  //     include: {
  //       _count: {
  //         select: { memberships: true }
  //       },
  //       posts: {
  //         where: {
  //           createdAt: {
  //             gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  //           }
  //         },
  //         select: {
  //           id: true,
  //           title: true,
  //           type: true,
  //           createdAt: true
  //         }
  //       }
  //     }
  //   });

  //   // Compute recommendation score
  //   const scoredClubs = candidateClubs.map(club => {

  //     let score = 0;

  //     // Content similarity score
  //     const matchingTypes = club.types.filter(t => preferredTypes.includes(t));
  //     score += matchingTypes.length * 5;

  //     // Activity score (recent posts)
  //     score += club.posts.length * 2;

  //     // Popularity boost
  //     score += club._count.memberships * 0.1;

  //     return {
  //       club,
  //       score
  //     };
  //   });

  //   scoredClubs.sort((a, b) => b.score - a.score);

  //   return {
  //     clubs: scoredClubs.slice(0, 5).map(({ club, score }) => ({
  //       id: club.id,
  //       title: club.title,
  //       description: club.description,
  //       image_url: club.imageUrl,
  //       membersCount: club._count.memberships,
  //       recommendationScore: score,
  //       recentPosts: club.posts.slice(0, 2)
  //     }))
  //   };
  // }),

  getRecommendedForYou: baseProcedure
.query(async ({ ctx }) => {

  // 1️⃣ Get user's club memberships
  const memberships = await prisma.membership.findMany({
    where: {
      userId: ctx.userId
    },
    include: {
      club: {
        select: {
          id: true,
          types: true
        }
      }
    }
  })

  const userClubIds = memberships.map(m => m.club.id)

  const preferredTypes = Array.from(
    new Set(
      memberships.flatMap(m => m.club.types)
    )
  )

  // 2️⃣ Recommended clubs
  const recommendedClubs = await prisma.club.findMany({
    where: {
      id: { notIn: userClubIds },
      types: {
        hasSome: preferredTypes
      }
    },
    include: {
      _count: {
        select: { memberships: true }
      }
    },
    take: 5
  })

  // 3️⃣ Recommended posts
  const recommendedPosts = await prisma.post.findMany({
    where: {
      club: {
        id: { notIn: userClubIds },
        types: {
          hasSome: preferredTypes
        }
      }
    },
    include: {
      club: {
        select: {
          id: true,
          title: true,
          imageUrl: true
        }
      },
      author: {
        select: {
          firstName: true,
          lastName: true
        }
      },
      _count: {
        select: { upvotes: true }
      }
    },
    orderBy: [
      { createdAt: "desc" }
    ],
    take: 6
  })

  return {
    clubs: recommendedClubs.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      image_url: c.imageUrl,
      membersCount: c._count.memberships
    })),

    posts: recommendedPosts.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      created_at: p.createdAt,

      club: {
        id: p.club.id,
        title: p.club.title,
        imageUrl: p.club.imageUrl
      },

      author: {
        firstName: p.author.firstName,
        lastName: p.author.lastName
      },

      upvotes_count: p._count.upvotes
    }))
  }
})
});
