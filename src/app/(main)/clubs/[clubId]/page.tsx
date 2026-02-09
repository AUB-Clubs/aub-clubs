import { Suspense } from 'react';
import ClubOverview from '@/modules/Clubs/ui/Views/Club-Overview'
import { ClubOverviewSkeleton } from '@/modules/Clubs/ui/components/Skeletons'

interface ClubPageProps {
  params: Promise<{ clubId: string }>
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params
  return (
    <Suspense fallback={<ClubOverviewSkeleton />}>
      <ClubOverview clubId={clubId} />
    </Suspense>
  )
}
