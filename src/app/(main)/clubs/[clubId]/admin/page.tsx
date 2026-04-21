import { Suspense } from 'react'
import AdminPanel from '@/modules/Clubs/ui/Views/AdminPanel'

interface PageProps {
  params: Promise<{ clubId: string }>
  searchParams: Promise<{ section?: string }>
}

const ALLOWED_SECTIONS = [
  'members',
  'requests',
  'announcements',
  'events',
  'analytics',
  'finance',
  'profile',
  'event-generator'
] as const
type AdminSection = (typeof ALLOWED_SECTIONS)[number]

function isAdminSection(value: string | undefined): value is AdminSection {
  if (!value) return false
  return (ALLOWED_SECTIONS as readonly string[]).includes(value)
}

export default async function ClubAdminPage({ params, searchParams }: PageProps) {
  const { clubId } = await params
  const { section } = await searchParams
  const initialSection: AdminSection | null = isAdminSection(section) ? section : null
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading admin panel…</p>
        </div>
      }
    >
      <AdminPanel clubId={clubId} initialSection={initialSection} />
    </Suspense>
  )
}
