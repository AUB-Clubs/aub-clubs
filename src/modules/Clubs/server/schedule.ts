import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { prisma } from '@/lib/prisma';

const TimeSlotSchema = z.object({
  courseCode: z.string().min(1),
  dayOfWeek: z.enum([
    'MONDAY', 'TUESDAY', 'WEDNESDAY',
    'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  ]),
  startTime: z.string(),
  endTime:   z.string(),
});

const UpsertScheduleInput = z.object({
  userId: z.string(),
  slots:  z.array(TimeSlotSchema),
});

const GetMyScheduleInput = z.object({
  userId: z.string(),
});

const GetConflictsInput = z.object({
  userId: z.string(),
  clubId: z.string().uuid(),
});

const ScheduleSlotSchema = z.object({
  id:         z.string(),
  userId:     z.string(),
  courseCode: z.string(),
  dayOfWeek:  z.string(),
  startTime:  z.date(),
  endTime:    z.date(),
});

const ConflictSchema = z.object({
  classSlot: ScheduleSlotSchema,
  clubEvent: z.object({
    id:        z.string(),
    clubId:    z.string(),
    title:     z.string(),
    dayOfWeek: z.string(),
    startTime: z.date(),
    endTime:   z.date(),
    location:  z.string().nullable(),
    createdAt: z.date(),
  }),
});

export const scheduleRouter = createTRPCRouter({

  upsertSchedule: baseProcedure
    .input(UpsertScheduleInput)
    .mutation(async function ({ input }) {
      await prisma.userSchedule.deleteMany({
        where: { userId: input.userId },
      });

      await prisma.userSchedule.createMany({
        data: input.slots.map(function (slot) {
          return {
            userId:     input.userId,
            courseCode: slot.courseCode,
            dayOfWeek:  slot.dayOfWeek,
            startTime:  new Date(slot.startTime),
            endTime:    new Date(slot.endTime),
          };
        }),
      });

      return { success: true };
    }),

  getMySchedule: baseProcedure
    .input(GetMyScheduleInput)
    .output(z.array(ScheduleSlotSchema))
    .query(async function ({ input }) {
      return prisma.userSchedule.findMany({
        where:   { userId: input.userId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    }),

  getConflicts: baseProcedure
    .input(GetConflictsInput)
    .output(z.array(ConflictSchema))
    .query(async function ({ input }) {
      const [userSlots, clubEvents] = await Promise.all([
        prisma.userSchedule.findMany({ where: { userId: input.userId } }),
        prisma.clubEvent.findMany({    where: { clubId: input.clubId  } }),
      ]);

      const conflicts: z.infer<typeof ConflictSchema>[] = [];

      for (const slot of userSlots) {
        for (const event of clubEvents) {

          if (slot.dayOfWeek !== event.dayOfWeek) continue;

          const slotStart  = slot.startTime.getTime();
          const slotEnd    = slot.endTime.getTime();
          const eventStart = event.startTime.getTime();
          const eventEnd   = event.endTime.getTime();

          const hasOverlap = slotStart < eventEnd && slotEnd > eventStart;

          if (hasOverlap) {
            conflicts.push({ classSlot: slot, clubEvent: event });
          }
        }
      }

      return conflicts;
    }),
});