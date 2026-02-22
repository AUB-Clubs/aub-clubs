import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "@/trpc/init"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"

export const clubsRouter = createTRPCRouter({
  getOverview: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ input }) => {
      const { clubId } = input
      
      const club = await prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true, title: true, description: true, imageUrl: true, bannerUrl: true, types: true, _count: { select: { memberships: true } } },
      })
      
      if (!club) {
        throw new TRPCError({
           code: "NOT_FOUND",
           message: "Club not found",
        })
      }

      return {
        club,
      }
    }),

  getStats: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ input }) => {
      const { clubId } = input
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const [membersCount, postsThisWeek] = await Promise.all([
        prisma.membership.count({ where: { clubId } }),
        prisma.post.count({ where: { clubId, createdAt: { gte: oneWeekAgo } } }),
      ])
      return { members: membersCount, postsThisWeek }
    }),
  
  getMembership: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { clubId } = input
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId } },
        select: { role: true },
      })
      return { role: membership?.role ?? null }
    }),

  getForumPosts: baseProcedure
    .input(z.object({ 
      clubId: z.string(), 
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit, cursor } = input
      
      const posts = await prisma.post.findMany({
        where: { clubId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { upvotes: true } },
          postImages: { select: { imageUrl: true } },
          upvotes: { where: { userId: ctx.userId }, select: { id: true } },
        },
      })

      let nextCursor: typeof cursor | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      const authorIds = [...new Set(posts.map((post: typeof posts[number]) => post.authorId))]
      const authorRoles = await prisma.membership.findMany({
        where: { clubId, userId: { in: authorIds } },
        select: { userId: true, role: true },
      })
      const roleByUserId = new Map(
        authorRoles.map((r: typeof authorRoles[number]) => [r.userId, r.role])
      )

      return {
        items: posts.map((post: typeof posts[number]) => ({
          id: post.id,
          type: post.type === "ANNOUNCEMENT" ? "announcement" : "discussion",
          title: post.title,
          content: post.content,
          author: `${post.author.firstName} ${post.author.lastName}`,
          authorId: post.authorId,
          role: roleByUserId.get(post.authorId) ?? "MEMBER",
          upvoteCount: post._count.upvotes,
          isUpvoted: post.upvotes.length > 0,
          imageUrls: post.postImages.map((img: { imageUrl: string }) => img.imageUrl),
          createdAt: post.createdAt.toISOString(),
        })),
        nextCursor,
      }
    }),

  getMembers: baseProcedure
    .input(z.object({ clubId: z.string(), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit } = input
      
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
    .input(z.object({ 
      clubId: z.string(), 
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit, cursor } = input

      const posts = await prisma.post.findMany({
        where: { clubId, type: "ANNOUNCEMENT" },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          postImages: { select: { imageUrl: true } },
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId: ctx.userId }, select: { id: true } },
        },
      })

      let nextCursor: typeof cursor | undefined = undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: posts.map((p: typeof posts[number]) => ({
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
          isUpvoted: p.upvotes.length > 0,
        })),
        nextCursor,
      }
    }),

  toggleUpvote: baseProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { postId } = input
      const userId = ctx.userId

      const existingUpvote = await prisma.upvote.findUnique({
        where: { userId_postId: { userId, postId } },
      })

      if (existingUpvote) {
        await prisma.upvote.delete({
          where: { id: existingUpvote.id },
        })
        return { isUpvoted: false }
      } else {
        await prisma.upvote.create({
          data: { userId, postId },
        })
        return { isUpvoted: true }
      }
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
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a member of this club to post",
        })
      }

      if (input.type === "ANNOUNCEMENT" && membership.role !== "PRESIDENT" && membership.role !== "VICE_PRESIDENT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only presidents and vice presidents can post announcements",
        })
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
  getClubsList: baseProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        search: z.string().optional(),
        type: z.enum(["ACADEMIC", "ARTS", "BUSINESS", "CAREER", "CULTURAL", "GAMING", "MEDIA",  "SPORTS", "SOCIAL", "TECHNOLOGY", "COMMUNITY_SERVICE", "ENVIRONMENTAL", "HEALTH_WELLNESS", "RELIGIOUS", "BEGINNER_FRIENDLY", "COMPETITIVE", "NETWORKING"]).optional(),
      })

    )
    .query(async ({ input }) => {
      const { page, limit, search, type } = input;
      const skip = (page - 1) * limit;

      const parsedCrn = search ? parseInt(search) : NaN;
      const isNumber = !isNaN(parsedCrn);

      const where: any = {};

      if (search) {
        const parsedCrn = parseInt(search);
        const isNumber = !isNaN(parsedCrn);

        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          ...(isNumber ? [{ crn: parsedCrn }] : []),
        ];
      }

      if (type) {
        where.types = {
          has: type,
        };
      }



const [clubs, totalCount] = await Promise.all([
  prisma.club.findMany({
    where,
    take: limit,
    skip,
    select: {
      id: true,
      crn: true,
      title: true,
      description: true,
      imageUrl: true,
      types: true,
      _count: {
        select: {
          memberships: true,
        },
      },
    },
    orderBy: {
      title: 'asc',
    },
  }),
  prisma.club.count({ where }),
]);

      return {
        clubs,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    }),
})