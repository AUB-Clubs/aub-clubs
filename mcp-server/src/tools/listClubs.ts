import { z } from 'zod';
import { query } from '../db.js';

const ClubType = z.enum([
  'ACADEMIC', 'ARTS', 'BUSINESS', 'CAREER', 'CULTURAL', 'GAMING', 'MEDIA',
  'SPORTS', 'SOCIAL', 'TECHNOLOGY', 'COMMUNITY_SERVICE', 'ENVIRONMENTAL',
  'HEALTH_WELLNESS', 'RELIGIOUS', 'BEGINNER_FRIENDLY', 'COMPETITIVE', 'NETWORKING',
]);

export const listClubsInput = {
  query: z.string().optional().describe('Free-text search across club title, description, and mission (case-insensitive).'),
  types: z.array(ClubType).optional().describe('Filter to clubs that have ANY of the listed types.'),
  limit: z.number().int().min(1).max(50).optional().default(10).describe('Max results (1-50, default 10).'),
};

const inputSchema = z.object(listClubsInput);

const ClubRow = z.object({
  id: z.string(),
  crn: z.number(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['PENDING_REVIEW', 'ACTIVE', 'INACTIVE']),
  types: z.array(z.string()),
  imageUrl: z.string().nullable(),
  memberCount: z.number(),
});
type ClubRow = z.infer<typeof ClubRow>;

export async function listClubs(args: z.infer<typeof inputSchema>) {
  const { query: q, types, limit = 10 } = args;
  const params: unknown[] = [];
  const where: string[] = [`c.status <> 'INACTIVE'`];

  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    const i = params.length;
    where.push(`(c.title ILIKE $${i} OR c.description ILIKE $${i} OR c.mission ILIKE $${i})`);
  }
  if (types && types.length > 0) {
    params.push(types);
    where.push(`c.types && $${params.length}::"ClubType"[]`);
  }
  params.push(limit);
  const limitParam = params.length;

  const sql = `
    SELECT c.id, c.crn, c.title, c.description, c.status, c.types, c.image_url AS "imageUrl",
           COALESCE((
             SELECT COUNT(*)::int FROM memberships m
             WHERE m.club_id = c.id AND m.status = 'ACCEPTED'
           ), 0) AS "memberCount"
    FROM clubs c
    WHERE ${where.join(' AND ')}
    ORDER BY c.title ASC
    LIMIT $${limitParam}
  `;

  const rows = await query<ClubRow>(sql, params);
  return z.array(ClubRow).parse(rows);
}
