import { z } from 'zod';
import { query } from '../db.js';

const ClubType = z.enum([
  'ACADEMIC', 'ARTS', 'BUSINESS', 'CAREER', 'CULTURAL', 'GAMING', 'MEDIA',
  'SPORTS', 'SOCIAL', 'TECHNOLOGY', 'COMMUNITY_SERVICE', 'ENVIRONMENTAL',
  'HEALTH_WELLNESS', 'RELIGIOUS', 'BEGINNER_FRIENDLY', 'COMPETITIVE', 'NETWORKING',
]);

export const listRecentAnnouncementsInput = {
  limit: z.number().int().min(1).max(50).optional().default(10),
  types: z.array(ClubType).optional().describe('Filter to announcements from clubs with ANY of these types.'),
};

const inputSchema = z.object(listRecentAnnouncementsInput);

const Row = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  priority: z.enum(['GENERAL', 'IMPORTANT', 'URGENT']),
  createdAt: z.string(),
  clubId: z.string(),
  clubTitle: z.string(),
});

export async function listRecentAnnouncements(args: z.infer<typeof inputSchema>) {
  const { limit = 10, types } = args;
  const params: unknown[] = [];
  const where: string[] = [
    `p.type = 'ANNOUNCEMENT'`,
    `p.status = 'PUBLISHED'`,
    `p.audience = 'PUBLIC'`,
    `c.status <> 'INACTIVE'`,
  ];
  if (types && types.length > 0) {
    params.push(types);
    where.push(`c.types && $${params.length}::"ClubType"[]`);
  }
  params.push(limit);

  const sql = `
    SELECT
      p.id, p.title, p.content, p.priority,
      p.created_at AS "createdAt",
      p.club_id    AS "clubId",
      c.title      AS "clubTitle"
    FROM posts p
    JOIN clubs c ON c.id = p.club_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.created_at DESC
    LIMIT $${params.length}
  `;
  const rows = await query(sql, params);
  return z.array(Row).parse(
    rows.map((r: any) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  );
}
