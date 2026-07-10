import { z } from 'zod';
import { query } from '../db.js';

export const listClubPostsInput = {
  clubId: z.string().uuid(),
  type: z.enum(['ANNOUNCEMENT', 'GENERAL']).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
};

const inputSchema = z.object(listClubPostsInput);

const PostRow = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  type: z.enum(['ANNOUNCEMENT', 'GENERAL']),
  priority: z.enum(['GENERAL', 'IMPORTANT', 'URGENT']),
  createdAt: z.string(),
  upvoteCount: z.number(),
  commentCount: z.number(),
});

export async function listClubPosts(args: z.infer<typeof inputSchema>) {
  const { clubId, type, limit = 10 } = args;
  const params: unknown[] = [clubId];
  const where: string[] = [
    `p.club_id = $1`,
    `p.status = 'PUBLISHED'`,
    `p.audience = 'PUBLIC'`,
    `c.status <> 'INACTIVE'`,
  ];
  if (type) {
    params.push(type);
    where.push(`p.type = $${params.length}::"PostType"`);
  }
  params.push(limit);

  const sql = `
    SELECT
      p.id, p.title, p.content, p.type, p.priority,
      p.created_at AS "createdAt",
      COALESCE((SELECT COUNT(*)::int FROM upvotes u WHERE u.post_id = p.id), 0) AS "upvoteCount",
      COALESCE((SELECT COUNT(*)::int FROM comments cm WHERE cm.post_id = p.id), 0) AS "commentCount"
    FROM posts p
    JOIN clubs c ON c.id = p.club_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.pinned_at DESC NULLS LAST, p.created_at DESC
    LIMIT $${params.length}
  `;
  const rows = await query(sql, params);
  return z.array(PostRow).parse(
    rows.map((r: any) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  );
}
