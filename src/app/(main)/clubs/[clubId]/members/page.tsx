import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ clubId: string }>
}

export default async function ClubMembersPage({ params }: PageProps) {
  const { clubId } = await params
  redirect(`/clubs/${clubId}/admin`)
}