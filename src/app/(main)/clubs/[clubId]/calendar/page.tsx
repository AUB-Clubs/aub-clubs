import { ClubCalendarView } from "@/modules/calendar/ui/views/club-calendar-view";

interface PageProps {
  params: Promise<{ clubId: string }>;
}

export default async function ClubCalendarPage({ params }: PageProps) {
  const { clubId } = await params;
  return <ClubCalendarView clubId={clubId} />;
}
