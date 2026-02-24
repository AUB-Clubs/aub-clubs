import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { prisma } from '@/lib/prisma';


function calculatedCommitmentLevel(post: { createdAt: Date } | null): "HIGH" | "MEDIUM" | "LOW" {
  if (!post) return "LOW";

  const today    = new Date();
  const postDate = new Date(post.createdAt);
  const diffMs   = today.getTime() - postDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 10) return "HIGH";
  if (diffDays <= 30) return "MEDIUM";
  return "LOW";
}

const GetCommitmentLevelInput = z.object({
  clubId: z.string().uuid(),
});

const CommitmentLevelSchema = z.object({
  clubId:          z.string(),
  commitmentLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export const commitmentLevelRouter = createTRPCRouter({
  getCommitmentLevel: baseProcedure
    .input(GetCommitmentLevelInput)
    .output(CommitmentLevelSchema)
    .query(async function ({ input }) {
      const latestAnnouncement = await prisma.post.findFirst({
        where: {
          clubId: input.clubId,
          type:   "ANNOUNCEMENT",
        },
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { createdAt: true },
      });

      return {
        clubId:          input.clubId,
        commitmentLevel: calculatedCommitmentLevel(latestAnnouncement),
      };
    }),
});