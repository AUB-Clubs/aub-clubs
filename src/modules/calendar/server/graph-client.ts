import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "./token-crypto";
import { refreshAccessToken } from "./microsoft-oauth";

const UNIVERSITY_TIMEZONE = process.env.UNIVERSITY_TIMEZONE ?? "Asia/Beirut";

export type OutlookCalendarEventDTO = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  /** YYYY-MM-DD (Graph start date); only for all-day */
  allDayStartDate?: string;
  /** YYYY-MM-DD end exclusive from Graph; only for all-day */
  allDayEndExclusiveDate?: string;
};

type GraphDateTime = {
  dateTime: string;
  timeZone: string;
};

type GraphEvent = {
  id: string;
  subject?: string | null;
  isAllDay?: boolean;
  start?: GraphDateTime | { date: string };
  end?: GraphDateTime | { date: string };
};

type GraphCalendar = {
  id: string;
};

function parseGraphDateTime(dt: GraphDateTime): Date {
  return new Date(dt.dateTime);
}

/** All-day end in Graph is exclusive; expand to last moment of previous calendar day for overlap math in UI. */
function parseAllDayRange(start: { date: string }, end: { date: string }): { start: Date; end: Date } {
  const startD = new Date(`${start.date}T00:00:00.000Z`);
  const endExclusive = new Date(`${end.date}T00:00:00.000Z`);
  const endInclusive = new Date(endExclusive.getTime() - 1);
  return { start: startD, end: endInclusive };
}

function mapGraphEvent(e: GraphEvent): OutlookCalendarEventDTO | null {
  if (!e.id) return null;
  const title = e.subject?.trim() || "(No title)";

  if (e.isAllDay && e.start && "date" in e.start && e.end && "date" in e.end) {
    const { start, end } = parseAllDayRange(e.start, e.end);
    return {
      id: e.id,
      title,
      startsAt: start,
      endsAt: end,
      isAllDay: true,
      allDayStartDate: e.start.date,
      allDayEndExclusiveDate: e.end.date,
    };
  }

  if (e.start && "dateTime" in e.start && e.end && "dateTime" in e.end) {
    const startsAt = parseGraphDateTime(e.start);
    const endsAt = parseGraphDateTime(e.end);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
    return { id: e.id, title, startsAt, endsAt, isAllDay: false };
  }

  return null;
}

export async function getValidAccessTokenForUser(userId: string): Promise<string> {
  const link = await prisma.userMicrosoftCalendarLink.findUnique({
    where: { userId },
  });
  if (!link) {
    throw new Error("Microsoft calendar is not connected");
  }

  const refreshPlain = decryptSecret(link.encryptedRefreshToken);
  const tokens = await refreshAccessToken(refreshPlain);

  const expiresAt = new Date(Date.now() + Math.max(0, tokens.expires_in - 60) * 1000);
  const encryptedRefresh = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : link.encryptedRefreshToken;

  await prisma.userMicrosoftCalendarLink.update({
    where: { userId },
    data: {
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope ?? link.scopes,
    },
  });

  return tokens.access_token;
}

export async function fetchMicrosoftCalendarView(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<OutlookCalendarEventDTO[]> {
  const accessToken = await getValidAccessTokenForUser(userId);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Prefer: `outlook.timezone="${UNIVERSITY_TIMEZONE}"`,
  };

  const calendarsUrl = new URL("https://graph.microsoft.com/v1.0/me/calendars");
  calendarsUrl.searchParams.set("$select", "id");
  calendarsUrl.searchParams.set("$top", "100");
  const calendarIds: string[] = [];
  let calendarsNext: string | null = calendarsUrl.toString();

  while (calendarsNext) {
    const res = await fetch(calendarsNext, { headers });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`calendars list failed: ${res.status} ${t}`);
    }
    const body = (await res.json()) as { value?: GraphCalendar[]; "@odata.nextLink"?: string };
    for (const cal of body.value ?? []) {
      if (cal.id) calendarIds.push(cal.id);
    }
    calendarsNext = body["@odata.nextLink"] ?? null;
  }

  const deduped = new Map<string, OutlookCalendarEventDTO>();

  for (const calendarId of calendarIds) {
    const url = new URL(`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`);
    url.searchParams.set("startDateTime", startIso);
    url.searchParams.set("endDateTime", endIso);
    url.searchParams.set("$top", "250");

    let next: string | null = url.toString();
    while (next) {
      const res = await fetch(next, { headers });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`calendarView failed: ${res.status} ${t}`);
      }
      const body = (await res.json()) as { value?: GraphEvent[]; "@odata.nextLink"?: string };
      for (const e of body.value ?? []) {
        const mapped = mapGraphEvent(e);
        if (mapped && !deduped.has(mapped.id)) deduped.set(mapped.id, mapped);
      }
      next = body["@odata.nextLink"] ?? null;
    }
  }

  return Array.from(deduped.values());
}
