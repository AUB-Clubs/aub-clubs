import { StudentCalendarView } from "@/modules/calendar/ui/views/student-calendar-view";

export const metadata = {
  title: "Calendar",
  description: "Student calendar for schedule and club events",
};

export default function CalendarPage() {
  return <StudentCalendarView />;
}
