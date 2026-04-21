export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type ScheduleBlock = {
  id: string;
  courseCode: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
};

export type OutlookBlock = {
  id: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string;
  isAllDay: boolean;
};

export type ClubEventBlock = {
  id: string;
  clubTitle: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string | null;
};

const dayOffset: Record<Weekday, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

function toDateWithTime(baseDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const copy = new Date(baseDate);
  copy.setHours(h, m, 0, 0);
  return copy;
}

export type BusyOverlap = {
  source: "schedule" | "outlook";
  label: string;
};

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function clubEventOverlapSeverity(
  club: { startsAt: Date | string; endsAt: Date | string | null },
  schedule: ScheduleBlock[],
  outlook: OutlookBlock[],
  rangeStart: Date,
  rangeEnd: Date
): { overlapPercent: number; overlapSeverity: "full" | "partial" | "none" } {
  const startsAt = new Date(club.startsAt);
  const endsAt = club.endsAt ? new Date(club.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000);
  const durationMs = Math.max(60_000, endsAt.getTime() - startsAt.getTime());

  const scheduleIntervals = expandScheduleBusy(rangeStart, rangeEnd, schedule);
  const outlookIntervals = outlookBusyIntervals(outlook);
  const all = [...scheduleIntervals, ...outlookIntervals];

  let totalOverlap = 0;
  for (const b of all) {
    if (intervalsOverlap(startsAt, endsAt, b.start, b.end)) {
      const s = Math.max(startsAt.getTime(), b.start.getTime());
      const e = Math.min(endsAt.getTime(), b.end.getTime());
      totalOverlap += Math.max(0, e - s);
    }
  }

  const overlapPercent = Math.min(100, (totalOverlap / durationMs) * 100);
  const overlapSeverity = overlapPercent >= 80 ? "full" : overlapPercent > 0 ? "partial" : "none";
  return { overlapPercent, overlapSeverity };
}

/** Recurring schedule rows as absolute intervals inside [rangeStart, rangeEnd]. */
export function expandScheduleBusy(
  rangeStart: Date,
  rangeEnd: Date,
  schedule: ScheduleBlock[]
): Array<{ start: Date; end: Date; label: string; source: "schedule" }> {
  const out: Array<{ start: Date; end: Date; label: string; source: "schedule" }> = [];
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  for (const item of schedule) {
    const cursor = new Date(start);
    while (cursor <= end) {
      if (cursor.getDay() === dayOffset[item.dayOfWeek]) {
        const s = toDateWithTime(cursor, item.startTime);
        const e = toDateWithTime(cursor, item.endTime);
        if (e <= s) {
          e.setDate(e.getDate() + 1);
        }
        out.push({
          start: s,
          end: e,
          label: item.courseCode,
          source: "schedule",
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

export function outlookBusyIntervals(
  outlook: OutlookBlock[]
): Array<{ start: Date; end: Date; label: string; source: "outlook" }> {
  return outlook.map((o) => ({
    start: new Date(o.startsAt),
    end: new Date(o.endsAt),
    label: o.title,
    source: "outlook" as const,
  }));
}

export function overlapsForClubEvent(
  club: ClubEventBlock,
  schedule: ScheduleBlock[],
  outlook: OutlookBlock[],
  rangeStart: Date,
  rangeEnd: Date
): BusyOverlap[] {
  const startsAt = new Date(club.startsAt);
  const endsAt = club.endsAt ? new Date(club.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000);

  const scheduleIntervals = expandScheduleBusy(rangeStart, rangeEnd, schedule);
  const outlookIntervals = outlookBusyIntervals(outlook);
  const hits: BusyOverlap[] = [];

  for (const b of scheduleIntervals) {
    if (intervalsOverlap(startsAt, endsAt, b.start, b.end)) {
      hits.push({ source: "schedule", label: b.label });
    }
  }
  for (const b of outlookIntervals) {
    if (intervalsOverlap(startsAt, endsAt, b.start, b.end)) {
      hits.push({ source: "outlook", label: b.label });
    }
  }
  return hits;
}

export type ConflictRow = {
  event: ClubEventBlock;
  overlaps: BusyOverlap[];
};

export function buildConflictRows(
  clubEvents: ClubEventBlock[],
  schedule: ScheduleBlock[],
  outlook: OutlookBlock[],
  rangeStart: Date,
  rangeEnd: Date
): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (const event of clubEvents) {
    const overlaps = overlapsForClubEvent(event, schedule, outlook, rangeStart, rangeEnd);
    if (overlaps.length > 0) {
      rows.push({ event, overlaps });
    }
  }
  return rows;
}
