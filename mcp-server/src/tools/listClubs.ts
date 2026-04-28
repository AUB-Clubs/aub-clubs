import { z } from 'zod';
import { query } from '../db.js';
import { ClubType, normalizeClubTypeFilters } from './clubTypes.js';

export const listClubsInput = {
  query: z.string().optional().describe('Free-text search across club title, description, and mission (case-insensitive).'),
  types: z.array(ClubType).optional().describe('Filter to clubs that have ANY of the listed categories/types.'),
  categories: z.array(ClubType).optional().describe('Alias for "types". Filter by club category values.'),
  category: z.union([ClubType, z.array(ClubType)]).optional().describe('Alias for "types". Accepts one category or a list.'),
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
  const { query: q, types, categories, category, limit = 10 } = args;
  const normalizedTypes = normalizeClubTypeFilters({ types, categories, category });
  const params: unknown[] = [];
  const where: string[] = [`c.status <> 'INACTIVE'`];

  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    const i = params.length;
    where.push(`(c.title ILIKE $${i} OR c.description ILIKE $${i} OR c.mission ILIKE $${i})`);
  }
  if (normalizedTypes.length > 0) {
    params.push(normalizedTypes);
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
