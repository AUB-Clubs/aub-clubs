import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { createTRPCRouter } from "@/trpc/init";
import { protectedProcedure } from "@/modules/auth/server/middleware";

const fragmentInclude = {
  eventDetails: true,
  eventReport: true,
  eventSpeakers: true,
  eventSponsors: true,
  eventBuildings: true,
  eventEmails: true,
  eventPosts: true,
  eventImage: true,
} as const;

export const eventGeneratorRouter = createTRPCRouter({
  projects: createTRPCRouter({
    get: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        return prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
      }),

    create: protectedProcedure
      .input(z.object({ clubId: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return prisma.project.create({
          data: { clubId: input.clubId, name: input.name },
        });
      }),
  }),

  messages: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        return prisma.message.findMany({
          where: { projectId: input.projectId },
          orderBy: { createdAt: "asc" },
          include: { fragment: { include: fragmentInclude } },
        });
      }),

    send: protectedProcedure
      .input(z.object({ projectId: z.string(), value: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const message = await prisma.message.create({
          data: {
            projectId: input.projectId,
            role: "USER",
            content: input.value,
          },
        });
        await inngest.send({
          name: "event-generator/run",
          data: { projectId: input.projectId, value: input.value },
        });
        return message;
      }),
  }),

  messageChunks: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .query(async ({ input }) => {
        return prisma.messageChunk.findMany({
          where: { messageId: input.messageId },
          orderBy: { createdAt: "asc" },
        });
      }),
  }),

  fragments: createTRPCRouter({
    get: protectedProcedure
      .input(z.object({ fragmentId: z.string() }))
      .query(async ({ input }) => {
        return prisma.fragment.findUnique({
          where: { id: input.fragmentId },
          include: fragmentInclude,
        });
      }),
  }),
});
