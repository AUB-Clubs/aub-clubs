import { ClubAdminCalendarView } from "@/modules/calendar/ui/views/club-admin-calendar-view";

interface PageProps {
  params: Promise<{ clubId: string }>;
}

export default async function ClubAdminCalendarPage({ params }: PageProps) {
  const { clubId } = await params;
  return <ClubAdminCalendarView clubId={clubId} />;
}
