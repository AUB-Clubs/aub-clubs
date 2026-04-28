import { z } from 'zod';
import { query } from '../db.js';

export const getClubInput = {
  id: z.string().uuid().optional().describe('Club UUID. Provide either id or crn.'),
  crn: z.number().int().optional().describe('Club CRN. Provide either id or crn.'),
};

const inputSchema = z.object(getClubInput).refine(
  (v) => !!v.id || typeof v.crn === 'number',
  { message: 'Provide either id or crn.' },
);

const ClubDetails = z.object({
  id: z.string(),
  crn: z.number(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['PENDING_REVIEW', 'ACTIVE', 'INACTIVE']),
  mission: z.string().nullable(),
  types: z.array(z.string()),
  imageUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  memberCount: z.number(),
  upcomingEventCount: z.number(),
});

export async function getClub(args: z.infer<typeof inputSchema>) {
  const params: unknown[] = [];
  let predicate: string;
  if (args.id) {
    params.push(args.id);
    predicate = `c.id = $1`;
  } else {
    params.push(args.crn);
    predicate = `c.crn = $1`;
  }

  const sql = `
    SELECT
      c.id, c.crn, c.title, c.description, c.status, c.mission, c.types::text[] AS types,
      c.image_url AS "imageUrl",
      c.banner_url AS "bannerUrl",
      c.instagram_url AS "instagramUrl",
      c.website_url AS "websiteUrl",
      COALESCE((
        SELECT COUNT(*)::int FROM memberships m
        WHERE m.club_id = c.id AND m.status = 'ACCEPTED'
      ), 0) AS "memberCount",
      COALESCE((
        SELECT COUNT(*)::int FROM events e
        WHERE e.club_id = c.id AND e.starts_at >= NOW()
      ), 0) AS "upcomingEventCount"
    FROM clubs c
    WHERE ${predicate} AND c.status <> 'INACTIVE'
    LIMIT 1
  `;

  const rows = await query(sql, params);
  if (rows.length === 0) {
    throw new Error('Club not found or inactive.');
  }
  return ClubDetails.parse(rows[0]);
}
