import MemberManagementDashboard from '@/modules/clubs/ui/views/MemberManagementDashboard'

interface PageProps {
  params: Promise<{ clubId: string }>
}

export default async function ClubMembersPage({ params }: PageProps) {
  const { clubId } = await params
  return <MemberManagementDashboard clubId={clubId} />
}