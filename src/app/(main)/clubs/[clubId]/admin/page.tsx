import { Suspense } from 'react'
import AdminPanel from '@/modules/Clubs/ui/Views/AdminPanel'

interface PageProps {
  params: Promise<{ clubId: string }>
}

export default async function ClubAdminPage({ params }: PageProps) {
  const { clubId } = await params
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading admin panel…</p>
        </div>
      }
    >
      <AdminPanel clubId={clubId} />
    </Suspense>
  )
}
