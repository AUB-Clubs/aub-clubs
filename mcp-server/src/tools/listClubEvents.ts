import { z } from 'zod';
import { query } from '../db.js';

export const listClubEventsInput = {
  clubId: z.string().uuid().describe('Club UUID.'),
  limit: z.number().int().min(1).max(50).optional().default(10),
};

const inputSchema = z.object(listClubEventsInput);

const EventRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  capacity: z.number().nullable(),
  registeredCount: z.number(),
});

export async function listClubEvents(args: z.infer<typeof inputSchema>) {
  const { clubId, limit = 10 } = args;
  const sql = `
    SELECT
      e.id, e.title, e.description, e.location,
      e.starts_at AS "startsAt",
      e.ends_at   AS "endsAt",
      e.capacity,
      COALESCE((
        SELECT COUNT(*)::int FROM event_registrations r
        WHERE r.event_id = e.id AND r.status = 'REGISTERED'
      ), 0) AS "registeredCount"
    FROM events e
    JOIN clubs c ON c.id = e.club_id
    WHERE e.club_id = $1
      AND c.status <> 'INACTIVE'
      AND e.starts_at >= NOW()
    ORDER BY e.starts_at ASC
    LIMIT $2
  `;
  const rows = await query(sql, [clubId, limit]);
  return z.array(EventRow).parse(
    rows.map((r: any) => ({
      ...r,
      startsAt: r.startsAt instanceof Date ? r.startsAt.toISOString() : r.startsAt,
      endsAt: r.endsAt instanceof Date ? r.endsAt.toISOString() : r.endsAt,
    })),
  );
}
