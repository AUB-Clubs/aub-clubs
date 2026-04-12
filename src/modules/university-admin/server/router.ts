import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter } from "@/trpc/init"
import { prisma } from "@/lib/prisma"
import { protectedProcedure } from "@/modules/auth/server/middleware"
import { isUniversityAdminEmail } from "@/modules/auth/server/university-admin"

function assertUniversityAdmin(email: string | null | undefined) {
  if (!isUniversityAdminEmail(email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "University admin access required" })
  }
}

type YearlyCountRow = {
  clubId: string
  clubTitle: string
  crn: number
  year: string
  count: number
}

export const universityAdminRouter = createTRPCRouter({
  getYearlyClubActivity: protectedProcedure
    .input(
      z
        .object({
          yearFrom: z.coerce.number().int().min(1970).max(2100).optional(),
          yearTo: z.coerce.number().int().min(1970).max(2100).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      assertUniversityAdmin(ctx.user.email)

      const yearFrom = input?.yearFrom ?? 1970
      const yearTo = input?.yearTo ?? 2100

      const postsSimple = await prisma.$queryRaw<YearlyCountRow[]>`
        SELECT c.id AS "clubId",
               c.title AS "clubTitle",
               c.crn AS crn,
               to_char(p.created_at, 'YYYY') AS year,
               COUNT(*)::int AS count
        FROM posts p
        INNER JOIN clubs c ON c.id = p.club_id
        WHERE p.status = 'PUBLISHED'
          AND to_char(p.created_at, 'YYYY')::int >= ${yearFrom}
          AND to_char(p.created_at, 'YYYY')::int <= ${yearTo}
        GROUP BY c.id, c.title, c.crn, year
        ORDER BY year ASC, c.title ASC;
      `

      const events = await prisma.$queryRaw<YearlyCountRow[]>`
        SELECT c.id AS "clubId",
               c.title AS "clubTitle",
               c.crn AS crn,
               to_char(e.starts_at, 'YYYY') AS year,
               COUNT(*)::int AS count
        FROM events e
        INNER JOIN clubs c ON c.id = e.club_id
        WHERE to_char(e.starts_at, 'YYYY')::int >= ${yearFrom}
          AND to_char(e.starts_at, 'YYYY')::int <= ${yearTo}
        GROUP BY c.id, c.title, c.crn, year
        ORDER BY year ASC, c.title ASC;
      `

      const members = await prisma.$queryRaw<YearlyCountRow[]>`
        SELECT c.id AS "clubId",
               c.title AS "clubTitle",
               c.crn AS crn,
               to_char(m.joined_at, 'YYYY') AS year,
               COUNT(*)::int AS count
        FROM memberships m
        INNER JOIN clubs c ON c.id = m.club_id
        WHERE m.status = 'ACCEPTED'
          AND to_char(m.joined_at, 'YYYY')::int >= ${yearFrom}
          AND to_char(m.joined_at, 'YYYY')::int <= ${yearTo}
        GROUP BY c.id, c.title, c.crn, year
        ORDER BY year ASC, c.title ASC;
      `

      type Key = string
      const mergeKey = (r: YearlyCountRow) => `${r.clubId}|${r.year}` as Key

      const rows = new Map<
        Key,
        {
          clubId: string
          clubTitle: string
          crn: number
          year: string
          publishedPosts: number
          eventsHosted: number
          membershipsAccepted: number
        }
      >()

      const touch = (r: YearlyCountRow) => {
        const k = mergeKey(r)
        const cur = rows.get(k) ?? {
          clubId: r.clubId,
          clubTitle: r.clubTitle,
          crn: r.crn,
          year: r.year,
          publishedPosts: 0,
          eventsHosted: 0,
          membershipsAccepted: 0,
        }
        rows.set(k, cur)
        return cur
      }

      for (const r of postsSimple) {
        const cur = touch(r)
        cur.publishedPosts = r.count
      }
      for (const r of events) {
        const cur = touch(r)
        cur.eventsHosted = r.count
      }
      for (const r of members) {
        const cur = touch(r)
        cur.membershipsAccepted = r.count
      }

      return {
        rows: Array.from(rows.values()).sort((a, b) => {
          if (a.year !== b.year) return a.year.localeCompare(b.year)
          return a.clubTitle.localeCompare(b.clubTitle)
        }),
      }
    }),

  getFundingOverview: protectedProcedure.query(async ({ ctx }) => {
    assertUniversityAdmin(ctx.user.email)

    type Row = {
      clubId: string
      clubTitle: string
      crn: number
      totalIncome: number
      totalExpense: number
    }

    const raw = await prisma.$queryRaw<Row[]>`
      SELECT c.id AS "clubId",
             c.title AS "clubTitle",
             c.crn AS crn,
             COALESCE(SUM(CASE WHEN f.type = 'INCOME' THEN f.amount ELSE 0 END), 0)::float AS "totalIncome",
             COALESCE(SUM(CASE WHEN f.type = 'EXPENSE' THEN f.amount ELSE 0 END), 0)::float AS "totalExpense"
      FROM clubs c
      LEFT JOIN "ClubFinance" f ON f."clubId" = c.id
      GROUP BY c.id, c.title, c.crn
      ORDER BY c.title ASC;
    `

    return {
      clubs: raw.map((r) => ({
        ...r,
        netBalance: r.totalIncome - r.totalExpense,
      })),
    }
  }),
})
