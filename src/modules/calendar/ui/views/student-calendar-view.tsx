"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, EventContentArg } from "@fullcalendar/core";
import { toast } from "sonner";
import { CalendarPlus, Trash2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScheduleUploadDialog } from "@/modules/schedule-inference/ui/components/schedule-upload-dialog";

const COLOR_OPTIONS = ["#1D4ED8", "#2563EB", "#0F766E", "#16A34A", "#CA8A04", "#DC2626", "#C026D3", "#7C3AED"];

type ScheduleEvent = {
  id: string;
  courseCode: string;
  type: "COURSE" | "CUSTOM";
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  startTime: string;
  endTime: string;
  color: string;
  isRecurring: boolean;
};

type ClubEvent = {
  id: string;
  clubId: string;
  clubTitle: string;
  title: string;
  description: string | null;
  startsAt: Date | string;
  endsAt: Date | string | null;
  location: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  color: string;
  rsvpCount: number;
  viewerStatus: "REGISTERED" | "WAITLIST" | "CHECKED_IN" | null;
};

type Weekday = ScheduleEvent["dayOfWeek"];

const dayOffset: Record<ScheduleEvent["dayOfWeek"], number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

function weekdayFromDate(dateInput: Date): Weekday {
  const day = dateInput.getDay();
  if (day === 0) return "SUNDAY";
  if (day === 1) return "MONDAY";
  if (day === 2) return "TUESDAY";
  if (day === 3) return "WEDNESDAY";
  if (day === 4) return "THURSDAY";
  if (day === 5) return "FRIDAY";
  return "SATURDAY";
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlapMinutes(startA: number, endA: number, startB: number, endB: number): number {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  return Math.max(0, end - start);
}

function formatEventRange(arg: EventContentArg): string {
  const start = arg.event.start;
  const end = arg.event.end;
  if (!start) return arg.timeText;
  const effectiveEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt.format(start)} - ${fmt.format(effectiveEnd)}`;
}

function prettyViewerStatus(status: string | null): string {
  if (!status) return "Not RSVPed";
  if (status === "CHECKED_IN") return "Checked in";
  return "Registered";
}

function toDateWithTime(baseDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const copy = new Date(baseDate);
  copy.setHours(h, m, 0, 0);
  return copy;
}

export function StudentCalendarView() {
  const utils = trpc.useUtils();
  const [range, setRange] = useState(() => {
    const now = new Date();
    return {
      rangeStart: new Date(now.getFullYear(), now.getMonth(), 1),
      rangeEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<{ kind: "club" | "schedule"; id: string } | null>(null);
  const [selectedScheduleColor, setSelectedScheduleColor] = useState("#1D4ED8");
  const [form, setForm] = useState({
    courseCode: "",
    dayOfWeek: "MONDAY" as ScheduleEvent["dayOfWeek"],
    startTime: "09:00",
    endTime: "10:00",
    color: "#1D4ED8",
  });

  const calendarQuery = trpc.calendar.getStudentCalendar.useQuery(range);

  const createMutation = trpc.calendar.createScheduleItem.useMutation({
    onSuccess: async () => {
      setCreateOpen(false);
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success("Custom recurring item added");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.calendar.deleteScheduleItem.useMutation({
    onSuccess: async () => {
      await utils.calendar.getStudentCalendar.invalidate();
      setSelected(null);
      toast.success("Item deleted");
    },
  });

  const updateScheduleMutation = trpc.calendar.updateScheduleItem.useMutation({
    onSuccess: async () => {
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success("Color updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const rsvpMutation = trpc.clubs.events.rsvpToEvent.useMutation({
    onSuccess: async (data) => {
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success(`RSVP status: ${prettyViewerStatus(data.status)}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelRsvpMutation = trpc.clubs.events.cancelRsvp.useMutation({
    onSuccess: async () => {
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success("RSVP cancelled");
    },
    onError: (error) => toast.error(error.message),
  });

  const events = useMemo(() => {
    const schedule = (calendarQuery.data?.schedule ?? []) as ScheduleEvent[];
    const clubEvents = (calendarQuery.data?.clubEvents ?? []) as ClubEvent[];
    const rows: Array<Record<string, unknown>> = [];
    const scheduleByDay = schedule.reduce<Record<Weekday, ScheduleEvent[]>>(
      (acc, item) => {
        acc[item.dayOfWeek].push(item);
        return acc;
      },
      {
        MONDAY: [],
        TUESDAY: [],
        WEDNESDAY: [],
        THURSDAY: [],
        FRIDAY: [],
        SATURDAY: [],
        SUNDAY: [],
      }
    );

    const start = new Date(range.rangeStart);
    const end = new Date(range.rangeEnd);

    for (const item of schedule) {
      const cursor = new Date(start);
      while (cursor <= end) {
        if (cursor.getDay() === dayOffset[item.dayOfWeek]) {
          const previewColor =
            selected?.kind === "schedule" && selected.id === item.id ? selectedScheduleColor : item.color;
          rows.push({
            id: item.id,
            title: item.courseCode,
            start: toDateWithTime(cursor, item.startTime),
            end: toDateWithTime(cursor, item.endTime),
            backgroundColor: previewColor,
            borderColor: previewColor,
            extendedProps: {
              kind: "schedule",
              scheduleType: item.type,
            },
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const event of clubEvents) {
      const startsAt = new Date(event.startsAt);
      const endsAt = event.endsAt ? new Date(event.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000);
      const eventStartMin = startsAt.getHours() * 60 + startsAt.getMinutes();
      const eventEndMin = endsAt.getHours() * 60 + endsAt.getMinutes();
      const eventDuration = Math.max(1, eventEndMin - eventStartMin);
      const daySchedule = scheduleByDay[weekdayFromDate(startsAt)];
      const totalOverlap = daySchedule.reduce((sum, item) => {
        return sum + overlapMinutes(eventStartMin, eventEndMin, toMinutes(item.startTime), toMinutes(item.endTime));
      }, 0);
      const overlapPercent = Math.min(100, (totalOverlap / eventDuration) * 100);
      const overlapSeverity = overlapPercent >= 80 ? "full" : overlapPercent > 0 ? "partial" : "none";

      rows.push({
        id: `club-${event.id}`,
        title: `${event.title} (${event.clubTitle})`,
        start: startsAt,
        end: endsAt,
        backgroundColor: event.color,
        borderColor: event.color,
        classNames:
          overlapSeverity === "full"
            ? ["calendar-overlap-full"]
            : overlapSeverity === "partial"
              ? ["calendar-overlap-partial"]
              : [],
        extendedProps: {
          kind: "club",
          eventId: event.id,
          rsvpCount: event.rsvpCount,
          overlapSeverity,
          overlapPercent,
        },
      });
    }

    return rows;
  }, [calendarQuery.data, range.rangeStart, range.rangeEnd, selected, selectedScheduleColor]);

  const selectedClubEvent =
    selected?.kind === "club"
      ? ((calendarQuery.data?.clubEvents ?? []).find((event) => event.id === selected.id) as ClubEvent | undefined)
      : undefined;

  function onSelectSlot(info: DateSelectArg) {
    const dayName = info.start
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase() as ScheduleEvent["dayOfWeek"];
    setForm((prev) => ({
      ...prev,
      dayOfWeek: dayName,
      startTime: info.start.toTimeString().slice(0, 5),
      endTime: info.end.toTimeString().slice(0, 5),
    }));
    setCreateOpen(true);
  }

  function onEventClick(arg: EventClickArg) {
    const kind = String(arg.event.extendedProps.kind || "");
    if (kind === "club") {
      setSelected({ kind: "club", id: String(arg.event.extendedProps.eventId) });
      return;
    }
    const id = String(arg.event.id);
    const color = String(arg.event.backgroundColor || "#1D4ED8");
    setSelectedScheduleColor(color);
    setSelected({ kind: "schedule", id });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>My Calendar</CardTitle>
            <CardDescription>Classes, custom recurring tasks, and joined club events in one place.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScheduleUploadDialog />
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Add recurring item
            </Button>
          </div>
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
                selectable
                selectMirror
                displayEventEnd
                eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
                eventMinHeight={54}
                eventShortHeight={36}
                events={events}
                select={onSelectSlot}
                eventClick={onEventClick}
                eventContent={(arg) => (
                  <div className="fc-custom-event-content">
                    <div className="fc-custom-event-time">{formatEventRange(arg)}</div>
                    <div className="fc-custom-event-title">{arg.event.title}</div>
                  </div>
                )}
                datesSet={(arg) => {
                  setRange({ rangeStart: arg.start, rangeEnd: arg.end });
                }}
                height="auto"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create recurring calendar item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Day</Label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value as ScheduleEvent["dayOfWeek"] })}
                >
                  {Object.keys(dayOffset).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Color</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((colorOption) => (
                    <button
                      key={colorOption}
                      type="button"
                      aria-label={`Pick ${colorOption}`}
                      onClick={() => setForm({ ...form, color: colorOption })}
                      className={`h-8 w-8 rounded-full border-2 ${form.color === colorOption ? "border-foreground" : "border-border"}`}
                      style={{ backgroundColor: colorOption }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  type: "CUSTOM",
                  isRecurring: true,
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event actions</DialogTitle>
          </DialogHeader>

          {selected?.kind === "schedule" ? (
            <div className="space-y-3">
              <div>
                <Label>Event color</Label>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((colorOption) => (
                      <button
                        key={colorOption}
                        type="button"
                        aria-label={`Pick ${colorOption}`}
                        onClick={() => setSelectedScheduleColor(colorOption)}
                        className={`h-8 w-8 rounded-full border-2 ${selectedScheduleColor === colorOption ? "border-foreground" : "border-border"}`}
                        style={{ backgroundColor: colorOption }}
                      />
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!selected?.id) return;
                      updateScheduleMutation.mutate({
                        itemId: selected.id,
                        color: selectedScheduleColor,
                      });
                    }}
                  >
                    Save color
                  </Button>
                </div>
              </div>
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => selected?.id && deleteMutation.mutate({ itemId: selected.id })}
              >
                <Trash2 className="h-4 w-4" />
                Delete schedule item
              </Button>
            </div>
          ) : null}

          {selected?.kind === "club" ? (
            <>
              {selectedClubEvent && (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <p><span className="font-semibold">Title:</span> {selectedClubEvent.title}</p>
                  <p><span className="font-semibold">Club:</span> {selectedClubEvent.clubTitle}</p>
                  <p>
                    <span className="font-semibold">Time:</span>{" "}
                    {new Date(selectedClubEvent.startsAt).toLocaleString()} - {new Date(selectedClubEvent.endsAt ?? selectedClubEvent.startsAt).toLocaleString()}
                  </p>
                  <p><span className="font-semibold">Location:</span> {selectedClubEvent.location ?? "TBA"}</p>
                  <p><span className="font-semibold">Description:</span> {selectedClubEvent.description ?? "No description"}</p>
                  <p>
                    <span className="font-semibold">RSVP:</span> {selectedClubEvent.rsvpCount}
                    {selectedClubEvent.capacity ? ` / ${selectedClubEvent.capacity}` : ""}
                  </p>
                  <p><span className="font-semibold">Your status:</span> {prettyViewerStatus(selectedClubEvent.viewerStatus)}</p>
                </div>
              )}

              {selectedClubEvent?.viewerStatus ? (
                <Button
                  variant="destructive"
                  disabled={cancelRsvpMutation.isPending}
                  onClick={() => {
                    const id = selected?.id;
                    if (!id) return;
                    cancelRsvpMutation.mutate({ eventId: id });
                  }}
                >
                  Reject RSVP
                </Button>
              ) : (
                <Button
                  disabled={rsvpMutation.isPending}
                  onClick={() => {
                    const id = selected?.id;
                    if (!id) return;
                    rsvpMutation.mutate({ eventId: id });
                  }}
                >
                  RSVP
                </Button>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
