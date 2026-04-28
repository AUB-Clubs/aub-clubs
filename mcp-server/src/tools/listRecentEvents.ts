import { z } from 'zod';
import { query } from '../db.js';

const ClubType = z.enum([
  'ACADEMIC', 'ARTS', 'BUSINESS', 'CAREER', 'CULTURAL', 'GAMING', 'MEDIA',
  'SPORTS', 'SOCIAL', 'TECHNOLOGY', 'COMMUNITY_SERVICE', 'ENVIRONMENTAL',
  'HEALTH_WELLNESS', 'RELIGIOUS', 'BEGINNER_FRIENDLY', 'COMPETITIVE', 'NETWORKING',
]);

export const listRecentEventsInput = {
  limit: z.number().int().min(1).max(50).optional().default(10),
  types: z.array(ClubType).optional().describe('Filter to events whose club has ANY of these types.'),
};

const inputSchema = z.object(listRecentEventsInput);

const EventRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  clubId: z.string(),
  clubTitle: z.string(),
});

export async function listRecentEvents(args: z.infer<typeof inputSchema>) {
  const { limit = 10, types } = args;
  const params: unknown[] = [];
  const where: string[] = [`c.status <> 'INACTIVE'`, `e.starts_at >= NOW()`];
  if (types && types.length > 0) {
    params.push(types);
    where.push(`c.types && $${params.length}::"ClubType"[]`);
  }
  params.push(limit);
  const sql = `
    SELECT
      e.id, e.title, e.description, e.location,
      e.starts_at AS "startsAt",
      e.ends_at   AS "endsAt",
      e.club_id   AS "clubId",
      c.title     AS "clubTitle"
    FROM events e
    JOIN clubs c ON c.id = e.club_id
    WHERE ${where.join(' AND ')}
    ORDER BY e.starts_at ASC
    LIMIT $${params.length}
  `;
  const rows = await query(sql, params);
  return z.array(EventRow).parse(
    rows.map((r: any) => ({
      ...r,
      startsAt: r.startsAt instanceof Date ? r.startsAt.toISOString() : r.startsAt,
      endsAt: r.endsAt instanceof Date ? r.endsAt.toISOString() : r.endsAt,
    })),
  );
}
