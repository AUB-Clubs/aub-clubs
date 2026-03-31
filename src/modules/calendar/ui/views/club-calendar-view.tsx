"use client";

import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg } from "@fullcalendar/core";
import { trpc } from "@/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function ClubCalendarView({ clubId }: { clubId: string }) {
  function formatEventRange(arg: EventContentArg): string {
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start) return arg.timeText;
    const effectiveEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
    return `${fmt.format(start)} - ${fmt.format(effectiveEnd)}`;
  }

  const eventsQuery = trpc.clubs.events.getClubEvents.useQuery({
    clubId,
    upcomingLimit: 80,
    pastLimit: 1,
  });

  const events = (eventsQuery.data?.upcoming ?? []).map((event) => {
    const start = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
    return {
      id: event.id,
      title: event.title,
      start,
      end,
      backgroundColor: event.color ?? "#2563EB",
      borderColor: event.color ?? "#2563EB",
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Club calendar preview</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clubs/${clubId}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <CardDescription>Members can preview upcoming events here.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="calendar-shell">
          <div className="w-full">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              displayEventEnd
              eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
              eventContent={(arg) => (
                <div className="fc-custom-event-content">
                  <div className="fc-custom-event-time">{formatEventRange(arg)}</div>
                  <div className="fc-custom-event-title">{arg.event.title}</div>
                </div>
              )}
              events={events}
              height="auto"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
