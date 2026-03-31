import { prisma } from "@/lib/prisma";
import { classifyOverlap } from "./overlap-calculator";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const UNIVERSITY_TIMEZONE = process.env.UNIVERSITY_TIMEZONE ?? "Asia/Beirut";

function getWeekdayInTimezone(date: Date): string {
  return date
    .toLocaleDateString("en-US", { weekday: "long", timeZone: UNIVERSITY_TIMEZONE })
    .toUpperCase();
}

function getMinutesInTimezone(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: UNIVERSITY_TIMEZONE,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function refDateFromMinutes(totalMinutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, 0, totalMinutes, 0, 0));
}

function scheduleMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export async function recomputeEventOverlapStats(eventId: string) {
  const now = new Date();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      clubId: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const effectiveEnd = event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000);

  const members = await prisma.membership.findMany({
    where: {
      clubId: event.clubId,
      status: "ACCEPTED",
    },
    select: { userId: true },
  });

  const userIds = members.map((m) => m.userId);
  const schedules = userIds.length
    ? await prisma.userSchedule.findMany({
        where: {
          userId: { in: userIds },
          isRecurring: true,
        },
        select: {
          userId: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
      })
    : [];

  const eventDay = getWeekdayInTimezone(event.startsAt);
  const eventStartMinutes = getMinutesInTimezone(event.startsAt);
  let eventEndMinutes = getMinutesInTimezone(effectiveEnd);
  if (eventEndMinutes <= eventStartMinutes) {
    eventEndMinutes += 24 * 60;
  }

  const eventWindow = {
    start: refDateFromMinutes(eventStartMinutes),
    end: refDateFromMinutes(eventEndMinutes),
  };

  const byUser = new Map<string, typeof schedules>();
  for (const slot of schedules) {
    const list = byUser.get(slot.userId) ?? [];
    list.push(slot);
    byUser.set(slot.userId, list);
  }

  let full = 0;
  let partial = 0;
  let none = 0;

  for (const userId of userIds) {
    const slots = (byUser.get(userId) ?? []).filter((slot) => slot.dayOfWeek === eventDay);
    const scheduleWindows = slots.map((slot) => {
      const startMinutes = scheduleMinutes(slot.startTime);
      let endMinutes = scheduleMinutes(slot.endTime);
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
      }
      return {
        start: refDateFromMinutes(startMinutes),
        end: refDateFromMinutes(endMinutes),
      };
    });

    const overlap = classifyOverlap({
      scheduleWindows,
      eventWindow,
    });

    if (overlap.severity === "full") full += 1;
    else if (overlap.severity === "partial") partial += 1;
    else none += 1;
  }

  const total = Math.max(userIds.length, 1);
  const payload = {
    fullOverlapPercentage: (full / total) * 100,
    partialOverlapPercentage: (partial / total) * 100,
    noOverlapPercentage: (none / total) * 100,
    totalMembers: userIds.length,
    calculatedAt: now,
    expiresAt: new Date(now.getTime() + THIRTY_MINUTES_MS),
  };

  return prisma.eventOverlapCache.upsert({
    where: { eventId },
    create: { eventId, ...payload },
    update: payload,
  });
}

export async function getOrComputeEventOverlapStats(eventId: string) {
  const now = new Date();
  const cached = await prisma.eventOverlapCache.findUnique({
    where: { eventId },
  });

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  return recomputeEventOverlapStats(eventId);
}
