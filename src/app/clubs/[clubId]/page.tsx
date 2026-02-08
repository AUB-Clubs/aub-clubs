import ClubOverview from '@/modules/Clubs/ui/views/Club-Overview'

interface ClubPageProps {
  params: Promise<{ clubId: string }>
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params
  return <ClubOverview clubId={clubId} />
}
