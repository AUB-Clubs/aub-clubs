import { z } from "zod"
import { createTRPCRouter, baseProcedure } from "@/trpc/init"
import { prisma } from "@/lib/prisma"
import { TRPCError } from "@trpc/server"
import { HfInference } from "@huggingface/inference"
import { memberManagementRouter } from "./member-management"
import { eventsRouter } from "./events"
import { analyticsRouter } from "./analytics"
import { protectedProcedure } from "@/modules/auth/server/middleware"

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
  events: eventsRouter,
  analytics: analyticsRouter,
  requestJoin: protectedProcedure
    .input(z.object({ clubId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { clubId } = input;
      const userId = ctx.user.id;

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
        select: {
          id: true,
          title: true,
          description: true,
          mission: true,
          imageUrl: true,
          bannerUrl: true,
          instagramUrl: true,
          websiteUrl: true,
          types: true,
          _count: { select: { memberships: true } },
        },
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

  getMembership: protectedProcedure
    .input(z.object({ clubId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { clubId } = input;

      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.user.id, clubId } },
        select: { role: true, status: true },
      });

      return {
        role: membership?.role ?? null,
        status: membership?.status ?? null,
      };
    }),

  getForumPosts: protectedProcedure
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
          upvotes: { where: { userId: ctx.user.id }, select: { id: true } },
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

  getAnnouncements: protectedProcedure
    .input(z.object({
      clubId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().nullish(),
    }))
    .query(async ({ ctx, input }) => {
      const { clubId, limit, cursor } = input

      const posts = await prisma.post.findMany({
        where: { clubId, type: "ANNOUNCEMENT", status: "PUBLISHED", audience: "PUBLIC" },
        orderBy: [
          { pinnedAt: "desc" },
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          postImages: { select: { imageUrl: true } },
          _count: { select: { upvotes: true } },
          upvotes: { where: { userId: ctx.user.id }, select: { id: true } },
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
          priority: p.priority,
          createdAt: p.createdAt.toISOString(),
          pinnedAt: p.pinnedAt?.toISOString() ?? null,
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

  toggleUpvote: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { postId } = input
      const userId = ctx.user.id

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

  createPost: protectedProcedure
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
        where: { userId_clubId: { userId: ctx.user.id, clubId: input.clubId } },
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

      // Hugging Face AI Moderation Check (KoalaAI/Text-Moderation)
      if (process.env.HF_TOKEN) {
        try {
          const hf = new HfInference(process.env.HF_TOKEN);
          // We verify both the title and content
          const textToCheck = `Title: ${input.title}\nContent: ${input.content}`;
          
          const response = await hf.textClassification({
            model: "KoalaAI/Text-Moderation",
            inputs: textToCheck,
          });

          // Console log the result to debug/audit responses
          console.log("AI Moderation Result:", response);

          // The model returns an array of label objects. Usually 'OK' is the top score if it's safe.
          // Since the model outputs multiple labels, we check the probability of 'OK' vs others.
          const topResult = response[0];
          
          // Let's be explicit and define the unsafe categories based on KoalaAI/Text-Moderation
          const unsafeLabels = ["S", "H", "V", "HR", "SH", "S3", "H2", "V2"];
          
          // If the model is not at least 95% confident it's OK, OR if an unsafe label scores higher than very low threshold
          let isUnsafe = false;
          let offendingLabel = topResult.label;

          if (topResult.label === "OK" && topResult.score < 0.95) {
             isUnsafe = true;
             // Find the next highest unsafe label to explain why
             const nextHighest = response.find(r => unsafeLabels.includes(r.label));
             if (nextHighest) offendingLabel = nextHighest.label;
          } else if (unsafeLabels.includes(topResult.label) && topResult.score > 0.05) {
             isUnsafe = true;
          }

          if (isUnsafe) {
            let reason = "inappropriate language";
            
            // Map the label to a friendly reason string
            const reasonMap: Record<string, string> = {
              "S": "sexual content",
              "H": "hate speech",
              "V": "violence",
              "HR": "harassment",
              "SH": "self-harm promotion",
              "S3": "sexual content involving minors",
              "H2": "threatening hate speech",
              "V2": "graphic violence"
            };
            
            if (reasonMap[offendingLabel]) {
               reason = reasonMap[offendingLabel] as string;
            }

            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Your post violates community guidelines and contains ${reason}. Please revise it.`,
            });
          }
        } catch (error: unknown) {
          // If it's our own thrown TRPC error, re-throw it. Otherwise, log it but don't crash entirely if HF is down.
          if (error instanceof TRPCError) throw error;
          console.error("AI Moderation Warning: Failed to reach HuggingFace API. Post allowed by default. " + String(error));
        }
      }

      const post = await prisma.post.create({
        data: {
          clubId: input.clubId,
          authorId: ctx.user.id,
          title: input.title,
          content: input.content,
          type: input.type,
        },
      })
      return { id: post.id, title: post.title, content: post.content, type: post.type, createdAt: post.createdAt.toISOString() }
    }),

  getClubsList: protectedProcedure
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
      const userId = ctx.user.id;

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
              where: { userId },
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
              where: { userId },
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

  // Get popular clubs (fallback for recommendations)
  getPopularClubs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit } = input;
      const userId = ctx.user.id;

      // Get user's joined club IDs to exclude them
      const userMemberships = await prisma.membership.findMany({
        where: {
          userId,
          status: "ACCEPTED",
        },
        select: { clubId: true },
      });
      const joinedClubIds = userMemberships.map((m) => m.clubId);

      // Query clubs by member count (popularity)
      const clubs = await prisma.club.findMany({
        where: {
          id: { notIn: joinedClubIds },
        },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          types: true,
          _count: {
            select: { memberships: true },
          },
        },
        orderBy: {
          memberships: { _count: 'desc' },
        },
        take: limit,
      });

      return clubs.map((club) => ({
        id: club.id,
        title: club.title,
        description: club.description,
        imageUrl: club.imageUrl,
        types: club.types,
        memberCount: club._count.memberships,
        score: 0, // No scoring for popular clubs
      }));
    }),
})
