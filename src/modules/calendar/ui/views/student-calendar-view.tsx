"use client";

import { useEffect, useMemo, useState } from "react";
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
import { CalendarConflictsPanel } from "@/modules/calendar/ui/components/calendar-conflicts-panel";
import {
  buildConflictRows,
  clubEventOverlapSeverity,
  overlapsForClubEvent,
} from "@/modules/calendar/ui/lib/busy-and-conflicts";

const COLOR_OPTIONS = ["#1D4ED8", "#2563EB", "#0F766E", "#16A34A", "#CA8A04", "#DC2626", "#C026D3", "#7C3AED"];
const OUTLOOK_COLOR = "#64748B";

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

type OutlookEvent = {
  id: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string;
  isAllDay: boolean;
  allDayStartDate: string | null;
  allDayEndExclusiveDate: string | null;
};

const dayOffset: Record<ScheduleEvent["dayOfWeek"], number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

function formatEventRange(arg: EventContentArg): string {
  const start = arg.event.start;
  const end = arg.event.end;
  if (!start) return arg.timeText;
  const effectiveEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt.format(start)} - ${fmt.format(effectiveEnd)}`;
}

function prettyViewerStatus(status: string | null): string {
  if (!status) return "Not going";
  if (status === "CHECKED_IN") return "Checked in";
  if (status === "WAITLIST") return "Waitlist";
  return "Going";
}

function toDateWithTime(baseDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const copy = new Date(baseDate);
  copy.setHours(h, m, 0, 0);
  return copy;
}

type SelectedEvent =
  | { kind: "club"; id: string }
  | { kind: "schedule"; id: string }
  | { kind: "outlook"; id: string };

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
  const [selected, setSelected] = useState<SelectedEvent | null>(null);
  const [selectedScheduleColor, setSelectedScheduleColor] = useState("#1D4ED8");
  const [form, setForm] = useState({
    courseCode: "",
    dayOfWeek: "MONDAY" as ScheduleEvent["dayOfWeek"],
    startTime: "09:00",
    endTime: "10:00",
    color: "#1D4ED8",
  });

  const calendarQuery = trpc.calendar.getStudentCalendar.useQuery(range);
  const msStatusQuery = trpc.calendar.getMicrosoftConnectionStatus.useQuery();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("ms_connected");
    const err = params.get("ms_error");
    if (!connected && !err) return;
    if (connected) {
      toast.success("Microsoft calendar connected.");
      void utils.calendar.getMicrosoftConnectionStatus.invalidate();
      void utils.calendar.getStudentCalendar.invalidate();
    }
    if (err) {
      toast.error(decodeURIComponent(err));
    }
    window.history.replaceState(null, "", "/calendar");
  }, [utils]);

  const disconnectMsMutation = trpc.calendar.disconnectMicrosoft.useMutation({
    onSuccess: async () => {
      await utils.calendar.getMicrosoftConnectionStatus.invalidate();
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success("Microsoft calendar disconnected.");
    },
    onError: (e) => toast.error(e.message),
  });

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
      toast.success(prettyViewerStatus(data.status));
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelRsvpMutation = trpc.clubs.events.cancelRsvp.useMutation({
    onSuccess: async () => {
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success("Marked as not going.");
    },
    onError: (error) => toast.error(error.message),
  });

  const scheduleForBusy = useMemo(() => {
    const schedule = (calendarQuery.data?.schedule ?? []) as ScheduleEvent[];
    return schedule.map((s) => ({
      id: s.id,
      courseCode: s.courseCode,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }, [calendarQuery.data?.schedule]);

  const outlookForBusy = useMemo(() => {
    const list = (calendarQuery.data?.outlookEvents ?? []) as OutlookEvent[];
    return list.map((o) => ({
      id: o.id,
      title: o.title,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      isAllDay: o.isAllDay,
    }));
  }, [calendarQuery.data?.outlookEvents]);

  const conflictRows = useMemo(() => {
    const clubEvents = (calendarQuery.data?.clubEvents ?? []) as ClubEvent[];
    return buildConflictRows(clubEvents, scheduleForBusy, outlookForBusy, range.rangeStart, range.rangeEnd);
  }, [calendarQuery.data?.clubEvents, scheduleForBusy, outlookForBusy, range.rangeStart, range.rangeEnd]);

  const events = useMemo(() => {
    const schedule = (calendarQuery.data?.schedule ?? []) as ScheduleEvent[];
    const clubEvents = (calendarQuery.data?.clubEvents ?? []) as ClubEvent[];
    const outlookEvents = (calendarQuery.data?.outlookEvents ?? []) as OutlookEvent[];
    const rows: Array<Record<string, unknown>> = [];

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

    for (const o of outlookEvents) {
      if (o.isAllDay && o.allDayStartDate && o.allDayEndExclusiveDate) {
        rows.push({
          id: `outlook-${o.id}`,
          title: `Outlook: ${o.title}`,
          allDay: true,
          start: o.allDayStartDate,
          end: o.allDayEndExclusiveDate,
          backgroundColor: OUTLOOK_COLOR,
          borderColor: OUTLOOK_COLOR,
          textColor: "#fff",
          extendedProps: { kind: "outlook", outlookId: o.id },
        });
      } else {
        rows.push({
          id: `outlook-${o.id}`,
          title: `Outlook: ${o.title}`,
          start: new Date(o.startsAt),
          end: new Date(o.endsAt),
          backgroundColor: OUTLOOK_COLOR,
          borderColor: OUTLOOK_COLOR,
          textColor: "#fff",
          extendedProps: { kind: "outlook", outlookId: o.id },
        });
      }
    }

    for (const event of clubEvents) {
      const { overlapPercent, overlapSeverity } = clubEventOverlapSeverity(
        event,
        scheduleForBusy,
        outlookForBusy,
        range.rangeStart,
        range.rangeEnd
      );

      const startsAt = new Date(event.startsAt);
      const endsAt = event.endsAt ? new Date(event.endsAt) : new Date(startsAt.getTime() + 60 * 60 * 1000);

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
  }, [
    calendarQuery.data,
    range.rangeStart,
    range.rangeEnd,
    selected,
    selectedScheduleColor,
    scheduleForBusy,
    outlookForBusy,
  ]);

  const selectedClubEvent =
    selected?.kind === "club"
      ? ((calendarQuery.data?.clubEvents ?? []).find((event) => event.id === selected.id) as ClubEvent | undefined)
      : undefined;

  const selectedOutlookEvent =
    selected?.kind === "outlook"
      ? ((calendarQuery.data?.outlookEvents ?? []).find((event) => event.id === selected.id) as OutlookEvent | undefined)
      : undefined;

  const selectedClubConflicts =
    selectedClubEvent != null
      ? overlapsForClubEvent(
          selectedClubEvent,
          scheduleForBusy,
          outlookForBusy,
          range.rangeStart,
          range.rangeEnd
        )
      : [];

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
      const eventId = String(arg.event.extendedProps.eventId);
      const ev = (calendarQuery.data?.clubEvents ?? []).find((e) => e.id === eventId) as ClubEvent | undefined;
      if (ev) {
        const hits = overlapsForClubEvent(ev, scheduleForBusy, outlookForBusy, range.rangeStart, range.rangeEnd);
        if (hits.length > 0) {
          toast.warning("This club event overlaps your schedule or Outlook calendar.");
        }
      }
      setSelected({ kind: "club", id: eventId });
      return;
    }
    if (kind === "outlook") {
      setSelected({ kind: "outlook", id: String(arg.event.extendedProps.outlookId) });
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
            <CardDescription>
              Classes, custom items, joined club events, and optionally your Microsoft Outlook calendar together.
            </CardDescription>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-[#1D4ED8]" aria-hidden />
                Schedule
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-[#2563EB]" aria-hidden />
                Club events
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-[#64748B]" aria-hidden />
                Outlook
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <ScheduleUploadDialog />
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <CalendarPlus className="h-4 w-4" />
                Add recurring item
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {msStatusQuery.data?.connected ? (
                <>
                  <p className="w-full text-right text-xs text-muted-foreground sm:w-auto">
                    Outlook: {msStatusQuery.data.accountEmail ?? "Connected"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disconnectMsMutation.isPending}
                    onClick={() => disconnectMsMutation.mutate()}
                  >
                    Disconnect Outlook
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href="/api/integrations/microsoft/start">Connect Microsoft calendar</a>
                </Button>
              )}
            </div>
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

      <CalendarConflictsPanel rows={conflictRows} />

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
            <DialogTitle>
              {selected?.kind === "club"
                ? "Club event"
                : selected?.kind === "outlook"
                  ? "Outlook event"
                  : "Schedule item"}
            </DialogTitle>
          </DialogHeader>

          {selected?.kind === "outlook" && selectedOutlookEvent ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p>
                <span className="font-semibold">Title:</span> {selectedOutlookEvent.title}
              </p>
              <p>
                <span className="font-semibold">Time:</span>{" "}
                {selectedOutlookEvent.isAllDay
                  ? `All day (${selectedOutlookEvent.allDayStartDate ?? ""})`
                  : `${new Date(selectedOutlookEvent.startsAt).toLocaleString()} – ${new Date(selectedOutlookEvent.endsAt).toLocaleString()}`}
              </p>
              <p className="text-muted-foreground">
                This event is read-only and comes from your Microsoft calendar.
              </p>
            </div>
          ) : null}

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
                  {selectedClubConflicts.length > 0 ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-950 dark:text-amber-100">
                      <p className="font-semibold">Scheduling overlap</p>
                      <ul className="mt-1 list-inside list-disc">
                        {selectedClubConflicts.map((c, i) => (
                          <li key={i}>
                            {c.source === "outlook" ? "Outlook" : "Schedule"}: {c.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}

              {selectedClubEvent?.viewerStatus === "CHECKED_IN" ? (
                <p className="text-sm text-muted-foreground">You are checked in for this event.</p>
              ) : selectedClubEvent?.viewerStatus ? (
                <Button
                  variant="outline"
                  disabled={cancelRsvpMutation.isPending}
                  onClick={() => {
                    const id = selected?.id;
                    if (!id) return;
                    cancelRsvpMutation.mutate({ eventId: id });
                  }}
                >
                  Can&apos;t go
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
                  Going
                </Button>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
