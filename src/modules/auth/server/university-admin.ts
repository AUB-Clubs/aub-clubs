/**
 * University staff / admin access for oversight features (reports, cross-club data).
 * Configure comma-separated emails in UNIVERSITY_ADMIN_EMAILS (case-insensitive).
 */
export function getUniversityAdminEmails(): Set<string> {
  const raw = process.env.UNIVERSITY_ADMIN_EMAILS ?? ""
  const parts = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return new Set(parts)
}

export function isUniversityAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getUniversityAdminEmails().has(email.trim().toLowerCase())
}
