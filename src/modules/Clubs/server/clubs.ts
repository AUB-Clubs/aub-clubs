import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "@/trpc/init"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"
import { memberManagementRouter } from "./member-management"

const ClubTypeEnum = z.enum([
  "ACADEMIC", "ARTS", "BUSINESS", "CAREER", "CULTURAL", "GAMING", "MEDIA",
  "SPORTS", "SOCIAL", "TECHNOLOGY", "COMMUNITY_SERVICE", "ENVIRONMENTAL",
  "HEALTH_WELLNESS", "RELIGIOUS", "BEGINNER_FRIENDLY", "COMPETITIVE", "NETWORKING",
]);

const CommitmentLevelEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);

function computeCommitmentLevel(latestAnnouncementDate: Date | null): "HIGH" | "MEDIUM" | "LOW" {
  if (!latestAnnouncementDate) return "LOW";
  const diffMs = Date.now() - latestAnnouncementDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 10) return "HIGH";
  if (diffDays <= 30) return "MEDIUM";
  return "LOW";
}

export const clubsRouter = createTRPCRouter({
  memberManagement: memberManagementRouter,
  requestJoin: baseProcedure
    .input(z.object({ clubId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { clubId } = input;
      const userId = ctx.userId;

      const existing = await prisma.membership.findUnique({
        where: { userId_clubId: { userId, clubId } },
        select: { id: true, status: true },
      });

      if (existing?.status === "ACCEPTED") return { ok: true, status: "ACCEPTED" as const };
      if (existing?.status === "PENDING") return { ok: true, status: "PENDING" as const };

      if (existing?.status === "REJECTED") {
        await prisma.membership.delete({
          where: { userId_clubId: { userId, clubId } },
        });
        await prisma.membership.create({
          data: {
            userId,
            clubId,
            role: "MEMBER",
            status: "PENDING",
          },
        });
        return { ok: true, status: "PENDING" as const };
      }

      await prisma.membership.create({
        data: {
          userId,
          clubId,
          role: "MEMBER",
          status: "PENDING",
        },
      });

      return { ok: true, status: "PENDING" as const };
    }),

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
      const { clubId } = input;

      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.userId, clubId } },
        select: { role: true, status: true },
      });

      return {
        role: membership?.role ?? null,
        status: membership?.status ?? null,
      };
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
    .query(async ({ input }) => {
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
        types: z.array(ClubTypeEnum).optional(),
        commitmentLevel: z.array(CommitmentLevelEnum).optional(),
        sort: z.enum(["name-az", "name-za", "members-desc", "members-asc", "commitment-hl", "commitment-lh"]).optional().default("name-az"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, search, types, commitmentLevel, sort } = input;
      const skip = (page - 1) * limit;

      // Determine Prisma orderBy from sort option
      let orderBy: Record<string, unknown> = { title: "asc" };
      if (sort === "name-za") orderBy = { title: "desc" };
      else if (sort === "members-desc" || sort === "members-asc") {
        orderBy = { memberships: { _count: sort === "members-desc" ? "desc" : "asc" } };
      }
      // commitment sorting is handled client-side (computed value)

      const where: Record<string, unknown> = {};

      if (search) {
        const parsedCrn = parseInt(search);
        const isNumber = !isNaN(parsedCrn);

        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          ...(isNumber ? [{ crn: parsedCrn }] : []),
        ];
      }

      if (types && types.length > 0) {
        where.types = {
          hasSome: types,
        };
      }

      // If filtering by commitment level, we need to fetch more clubs and post-filter
      const needsCommitmentFilter = commitmentLevel && commitmentLevel.length > 0 && commitmentLevel.length < 3;

      if (needsCommitmentFilter) {
        // Fetch all matching clubs (no pagination yet) so we can filter by commitment
        const allClubs = await prisma.club.findMany({
          where,
          include: {
            _count: { select: { memberships: true } },
            memberships: {
              where: { userId: ctx.userId },
              select: { status: true },
            },
          },
          orderBy,
        });

        // For each club, compute commitment level from latest announcement
        const clubsWithCommitment = await Promise.all(
          allClubs.map(async (club) => {
            const latestAnnouncement = await prisma.post.findFirst({
              where: { clubId: club.id, type: "ANNOUNCEMENT" },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            });
            const level = computeCommitmentLevel(latestAnnouncement?.createdAt ?? null);
            return { club, level };
          })
        );

        // Filter by commitment level
        const filtered = clubsWithCommitment.filter(
          ({ level }) => commitmentLevel!.includes(level)
        );

        const totalCount = filtered.length;
        const paged = filtered.slice(skip, skip + limit);

        return {
          clubs: paged.map(({ club }) => ({
            ...club,
            memberCount: club._count.memberships,
            myStatus: club.memberships[0]?.status ?? null,
          })),
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        };
      }

      // Standard path: no commitment filtering
      const [clubs, totalCount] = await Promise.all([
        prisma.club.findMany({
          where,
          take: limit,
          skip,
          include: {
            _count: { select: { memberships: true } },
            memberships: {
              where: { userId: ctx.userId },
              select: { status: true },
            },
          },
          orderBy,
        }),
        prisma.club.count({ where }),
      ]);

      return {
        clubs: clubs.map((c) => ({
          ...c,
          memberCount: c._count.memberships,
          myStatus: c.memberships[0]?.status ?? null,
        })),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    }),
})