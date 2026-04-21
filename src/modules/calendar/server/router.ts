import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter } from "@/trpc/init";
import { protectedProcedure } from "@/modules/auth/server/middleware";
import { getOrComputeEventOverlapStats, recomputeEventOverlapStats } from "./cache-manager";
import { classifyOverlap } from "./overlap-calculator";
import { fetchMicrosoftCalendarView } from "./graph-client";

const dayOfWeekSchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);
const UNIVERSITY_TIMEZONE = process.env.UNIVERSITY_TIMEZONE ?? "Asia/Beirut";

const scheduleItemInputSchema = z.object({
  courseCode: z.string().min(1).max(100),
  type: z.enum(["COURSE", "CUSTOM"]).default("CUSTOM"),
  dayOfWeek: dayOfWeekSchema,
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/).default("#1D4ED8"),
  isRecurring: z.boolean().default(true),
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

function getTimeHHMM(d: Date): string {
  return d.toISOString().slice(11, 16);
}

function weekdayToEnum(d: Date): z.infer<typeof dayOfWeekSchema> {
  return d
    .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
    .toUpperCase() as z.infer<typeof dayOfWeekSchema>;
}

function weekdayToEnumInTimezone(d: Date): z.infer<typeof dayOfWeekSchema> {
  return d
    .toLocaleDateString("en-US", { weekday: "long", timeZone: UNIVERSITY_TIMEZONE })
    .toUpperCase() as z.infer<typeof dayOfWeekSchema>;
}

function minutesInTimezone(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: UNIVERSITY_TIMEZONE,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function scheduleMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function refDateFromMinutes(minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, 0, minutes, 0, 0));
}

export const calendarRouter = createTRPCRouter({
  getStudentCalendar: protectedProcedure
    .input(
      z.object({
        rangeStart: z.coerce.date(),
        rangeEnd: z.coerce.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [schedule, memberships, clubEvents] = await Promise.all([
        prisma.userSchedule.findMany({
          where: { userId: ctx.user.id },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        }),
        prisma.membership.findMany({
          where: { userId: ctx.user.id, status: "ACCEPTED" },
          select: { clubId: true },
        }),
        prisma.event.findMany({
          where: {
            startsAt: { gte: input.rangeStart, lte: input.rangeEnd },
          },
          include: {
            club: {
              select: { id: true, title: true, defaultEventColor: true },
            },
            registrations: {
              where: { userId: ctx.user.id },
              select: { status: true },
              take: 1,
            },
            _count: {
              select: {
                registrations: true,
              },
            },
          },
          orderBy: { startsAt: "asc" },
        }),
      ]);

      const myClubIds = new Set(memberships.map((m) => m.clubId));

      const link = await prisma.userMicrosoftCalendarLink.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      let outlookEvents: Array<{
        id: string;
        title: string;
        startsAt: Date;
        endsAt: Date;
        isAllDay: boolean;
        allDayStartDate: string | null;
        allDayEndExclusiveDate: string | null;
      }> = [];

      if (link) {
        try {
          const raw = await fetchMicrosoftCalendarView(ctx.user.id, input.rangeStart, input.rangeEnd);
          outlookEvents = raw.map((e) => ({
            id: e.id,
            title: e.title,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            isAllDay: e.isAllDay,
            allDayStartDate: e.allDayStartDate ?? null,
            allDayEndExclusiveDate: e.allDayEndExclusiveDate ?? null,
          }));
        } catch {
          outlookEvents = [];
        }
      }

      return {
        schedule: schedule.map((item) => ({
          id: item.id,
          courseCode: item.courseCode,
          type: item.type,
          dayOfWeek: item.dayOfWeek,
          startTime: getTimeHHMM(item.startTime),
          endTime: getTimeHHMM(item.endTime),
          color: item.color ?? "#1D4ED8",
          isRecurring: item.isRecurring,
        })),
        clubEvents: clubEvents
          .filter((event) => myClubIds.has(event.clubId))
          .map((event) => ({
            id: event.id,
            clubId: event.clubId,
            clubTitle: event.club.title,
            title: event.title,
            description: event.description,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            location: event.location,
            capacity: event.capacity,
            waitlistEnabled: event.waitlistEnabled,
            color: event.color ?? event.club.defaultEventColor ?? "#2563EB",
            rsvpCount: event._count.registrations,
            viewerStatus: event.registrations[0]?.status ?? null,
          })),
        outlookEvents,
      };
    }),

  getMicrosoftConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const link = await prisma.userMicrosoftCalendarLink.findUnique({
      where: { userId: ctx.user.id },
      select: { accountEmail: true },
    });
    return {
      connected: !!link,
      accountEmail: link?.accountEmail ?? null,
    };
  }),

  disconnectMicrosoft: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.userMicrosoftCalendarLink.deleteMany({
      where: { userId: ctx.user.id },
    });
    return { success: true };
  }),

  createScheduleItem: protectedProcedure
    .input(scheduleItemInputSchema)
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.userSchedule.create({
        data: {
          userId: ctx.user.id,
          courseCode: input.courseCode,
          type: input.type,
          dayOfWeek: input.dayOfWeek,
          startTime: toReferenceDate(input.dayOfWeek, input.startTime),
          endTime: toReferenceDate(input.dayOfWeek, input.endTime),
          color: input.color,
          isRecurring: input.isRecurring,
        },
      });
      return { id: item.id };
    }),

  updateScheduleItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string().uuid(),
        courseCode: z.string().min(1).max(100).optional(),
        dayOfWeek: dayOfWeekSchema.optional(),
        startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
        endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
        color: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.userSchedule.findUnique({
        where: { id: input.itemId },
      });

      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule item not found" });
      }

      const dayOfWeek = input.dayOfWeek ?? existing.dayOfWeek;
      const startTime = input.startTime
        ? toReferenceDate(dayOfWeek, input.startTime)
        : existing.startTime;
      const endTime = input.endTime ? toReferenceDate(dayOfWeek, input.endTime) : existing.endTime;

      await prisma.userSchedule.update({
        where: { id: input.itemId },
        data: {
          courseCode: input.courseCode,
          dayOfWeek,
          startTime,
          endTime,
          color: input.color,
        },
      });

      return { success: true };
    }),

  deleteScheduleItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.userSchedule.findUnique({ where: { id: input.itemId } });
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Schedule item not found" });
      }
      await prisma.userSchedule.delete({ where: { id: input.itemId } });
      return { success: true };
    }),

  getViewerOverlapForEvent: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({ where: { id: input.eventId } });
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      const effectiveEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000);
      const day = weekdayToEnumInTimezone(event.startsAt);
      const schedule = await prisma.userSchedule.findMany({
        where: { userId: ctx.user.id, dayOfWeek: day },
      });

      const eventStartMinutes = minutesInTimezone(event.startsAt);
      let eventEndMinutes = minutesInTimezone(effectiveEnd);
      if (eventEndMinutes <= eventStartMinutes) {
        eventEndMinutes += 24 * 60;
      }

      const overlap = classifyOverlap({
        eventWindow: {
          start: refDateFromMinutes(eventStartMinutes),
          end: refDateFromMinutes(eventEndMinutes),
        },
        scheduleWindows: schedule.map((s) => {
          const startMinutes = scheduleMinutes(s.startTime);
          let endMinutes = scheduleMinutes(s.endTime);
          if (endMinutes <= startMinutes) {
            endMinutes += 24 * 60;
          }
          return {
            start: refDateFromMinutes(startMinutes),
            end: refDateFromMinutes(endMinutes),
          };
        }),
      });

      return overlap;
    }),

  getClubEventStats: protectedProcedure
    .input(z.object({ clubId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.user.id, clubId: input.clubId } },
        select: { role: true, status: true },
      });

      if (!membership || membership.status !== "ACCEPTED") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
      }

      if (!["PRESIDENT", "VICE_PRESIDENT"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const events = await prisma.event.findMany({
        where: {
          clubId: input.clubId,
          startsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
        include: {
          _count: {
            select: { registrations: true },
          },
        },
      });

      const stats = await Promise.all(
        events.map(async (event) => {
          const cache = await getOrComputeEventOverlapStats(event.id);
          return {
            eventId: event.id,
            title: event.title,
            startsAt: event.startsAt,
            rsvpCount: event._count.registrations,
            fullOverlapPercentage: cache.fullOverlapPercentage,
            partialOverlapPercentage: cache.partialOverlapPercentage,
            noOverlapPercentage: cache.noOverlapPercentage,
            totalMembers: cache.totalMembers,
            calculatedAt: cache.calculatedAt,
          };
        })
      );

      return stats;
    }),

  refreshClubEventStats: protectedProcedure
    .input(z.object({ clubId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.membership.findUnique({
        where: { userId_clubId: { userId: ctx.user.id, clubId: input.clubId } },
        select: { role: true, status: true },
      });

      if (!membership || membership.status !== "ACCEPTED") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized" });
      }

      if (![("PRESIDENT"), ("VICE_PRESIDENT")].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const events = await prisma.event.findMany({
        where: {
          clubId: input.clubId,
          startsAt: { gte: new Date() },
        },
        select: { id: true },
      });

      await Promise.all(events.map((event) => recomputeEventOverlapStats(event.id)));

      return { refreshed: events.length };
    }),
});
