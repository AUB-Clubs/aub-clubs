import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter } from "@/trpc/init";
import { protectedProcedure } from "@/modules/auth/server/middleware";
import { inferScheduleFromImage } from "./openai-extractor";
import { dayOfWeekSchema, extractedScheduleItemSchema } from "./validations";

const inferInputSchema = z.object({
  mimeType: z.enum(["image/png", "image/jpeg", "image/jpg"]),
  base64Image: z
    .string()
    .min(200)
    .max(4_100_000, "Image payload is too large. Please upload a smaller image."),
});

const acceptInputSchema = z.object({
  jobId: z.string().uuid(),
  items: z.array(extractedScheduleItemSchema).min(1).max(80),
  replaceExisting: z.boolean().default(true),
});

function toReferenceDate(dayOfWeek: z.infer<typeof dayOfWeekSchema>, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const dayIndex: Record<z.infer<typeof dayOfWeekSchema>, number> = {
    MONDAY: 5,
    TUESDAY: 6,
    WEDNESDAY: 7,
    THURSDAY: 8,
    FRIDAY: 9,
    SATURDAY: 10,
    SUNDAY: 11,
  };
  return new Date(Date.UTC(1970, 0, dayIndex[dayOfWeek], hours, minutes, 0, 0));
}

export const scheduleInferenceRouter = createTRPCRouter({
  inferFromImage: protectedProcedure
    .input(inferInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { mimeType, base64Image } = input;

      const job = await prisma.scheduleInferenceJob.create({
        data: {
          userId: ctx.user.id,
          sourceMimeType: mimeType,
          sourceBase64: base64Image,
          status: "PENDING",
        },
      });

      try {
        const items = await inferScheduleFromImage({
          mimeType,
          base64Image,
        });

        await prisma.scheduleInferenceJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            extractedJson: { items },
          },
        });

        return {
          jobId: job.id,
          items,
        };
      } catch (error) {
        await prisma.scheduleInferenceJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "Inference failed",
          },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not extract schedule from image. Try a clearer image.",
        });
      }
    }),

  acceptInference: protectedProcedure
    .input(acceptInputSchema)
    .mutation(async ({ ctx, input }) => {
      const job = await prisma.scheduleInferenceJob.findUnique({
        where: { id: input.jobId },
        select: { id: true, userId: true, status: true },
      });

      if (!job || job.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Inference job not found" });
      }

      if (job.status !== "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inference must be completed before accepting",
        });
      }

      await prisma.$transaction(async (tx) => {
        if (input.replaceExisting) {
          await tx.userSchedule.deleteMany({
            where: {
              userId: ctx.user.id,
              type: "COURSE",
            },
          });
        }

        await tx.userSchedule.createMany({
          data: input.items.map((item) => ({
            userId: ctx.user.id,
            courseCode: item.courseCode,
            type: "COURSE",
            color: "#1D4ED8",
            isRecurring: true,
            dayOfWeek: item.dayOfWeek,
            startTime: toReferenceDate(item.dayOfWeek, item.startTime),
            endTime: toReferenceDate(item.dayOfWeek, item.endTime),
          })),
        });

        await tx.scheduleInferenceJob.update({
          where: { id: input.jobId },
          data: { status: "COMPLETED" },
        });
      });

      return { success: true };
    }),

  rejectInference: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const job = await prisma.scheduleInferenceJob.findUnique({
        where: { id: input.jobId },
        select: { userId: true },
      });

      if (!job || job.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Inference job not found" });
      }

      await prisma.scheduleInferenceJob.update({
        where: { id: input.jobId },
        data: { status: "REJECTED" },
      });

      return { success: true };
    }),
});
