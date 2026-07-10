import { z } from 'zod';
import { query } from '../db.js';

export const listClubMeetingsInput = {
  clubId: z.string().uuid(),
};

const inputSchema = z.object(listClubMeetingsInput);

const MeetingRow = z.object({
  id: z.string(),
  title: z.string(),
  dayOfWeek: z.enum([
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  ]),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().nullable(),
});

export async function listClubMeetings(args: z.infer<typeof inputSchema>) {
  const { clubId } = args;
  const sql = `
    SELECT
      ce.id, ce.title,
      ce.day_of_week AS "dayOfWeek",
      ce.start_time  AS "startTime",
      ce.end_time    AS "endTime",
      ce.location
    FROM club_events ce
    JOIN clubs c ON c.id = ce.club_id
    WHERE ce.club_id = $1 AND c.status <> 'INACTIVE'
    ORDER BY
      CASE ce.day_of_week
        WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 WHEN 'WEDNESDAY' THEN 3
        WHEN 'THURSDAY' THEN 4 WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 WHEN 'SUNDAY' THEN 7
      END,
      ce.start_time ASC
  `;
  const rows = await query(sql, [clubId]);
  return z.array(MeetingRow).parse(
    rows.map((r: any) => ({
      ...r,
      startTime: r.startTime instanceof Date ? r.startTime.toISOString() : r.startTime,
      endTime: r.endTime instanceof Date ? r.endTime.toISOString() : r.endTime,
    })),
  );
}
