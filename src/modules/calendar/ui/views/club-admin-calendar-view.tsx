"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg, EventDropArg } from "@fullcalendar/core";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const COLOR_OPTIONS = ["#2563EB", "#0EA5E9", "#0F766E", "#16A34A", "#CA8A04", "#EA580C", "#DC2626", "#C026D3"];

export function ClubAdminCalendarView({ clubId }: { clubId: string }) {
  const utils = trpc.useUtils();
  const [colorPreviewByEventId, setColorPreviewByEventId] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [statsDetailsOpen, setStatsDetailsOpen] = useState(false);
  const [selectedStats, setSelectedStats] = useState<{
    eventId: string;
    title: string;
    startsAt: Date;
    rsvpCount: number;
    fullOverlapPercentage: number;
    partialOverlapPercentage: number;
    noOverlapPercentage: number;
    totalMembers: number;
    calculatedAt: Date;
  } | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    eventId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    color: string;
    description: string | null;
    location: string | null;
    capacity: number | null;
    waitlistEnabled: boolean;
    registeredCount: number;
    checkedInCount: number;
  } | null>(null);

  const eventsQuery = trpc.clubs.events.getClubEvents.useQuery({
    clubId,
    upcomingLimit: 100,
    pastLimit: 1,
  });

  const statsQuery = trpc.calendar.getClubEventStats.useQuery({ clubId });
  const refreshStatsMutation = trpc.calendar.refreshClubEventStats.useMutation({
    onSuccess: async ({ refreshed }) => {
      await utils.calendar.getClubEventStats.invalidate({ clubId });
      toast.success(`Refreshed overlap stats for ${refreshed} event${refreshed === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(error.message),
  });

  function formatEventRange(arg: EventContentArg): string {
    const start = arg.event.start;
    const end = arg.event.end;
    if (!start) return arg.timeText;
    const effectiveEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
    return `${fmt.format(start)} - ${fmt.format(effectiveEnd)}`;
  }

  const updateMutation = trpc.clubs.events.updateEvent.useMutation({
    onSuccess: async () => {
      await utils.clubs.events.getClubEvents.invalidate({ clubId, upcomingLimit: 100, pastLimit: 1 });
      await utils.calendar.getClubEventStats.invalidate({ clubId });
    },
  });

  function toLocalDateTimeValue(value: string): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const events = useMemo(
    () =>
      (eventsQuery.data?.upcoming ?? []).map((e) => {
        const start = new Date(e.startsAt);
        const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
        return {
          id: e.id,
          title: e.title,
          start,
          end,
          backgroundColor: colorPreviewByEventId[e.id] ?? e.color ?? "#2563EB",
          borderColor: colorPreviewByEventId[e.id] ?? e.color ?? "#2563EB",
          extendedProps: {
            raw: e,
          },
        };
      }),
    [eventsQuery.data, colorPreviewByEventId]
  );

  function onDrop(arg: EventDropArg) {
    const raw = arg.event.extendedProps.raw as
      | {
          id: string;
          title: string;
          description: string | null;
          location: string | null;
          capacity: number | null;
          waitlistEnabled: boolean;
          color?: string | null;
          registeredCount: number;
          checkedInCount: number;
        }
      | undefined;

    if (!raw) return;

    updateMutation.mutate({
      eventId: raw.id,
      clubId,
      title: raw.title,
      description: raw.description,
      location: raw.location,
      startsAt: arg.event.start ?? new Date(),
      endsAt: arg.event.end ?? arg.event.start ?? new Date(),
      capacity: raw.capacity,
      waitlistEnabled: raw.waitlistEnabled,
      color: raw.color ?? "#2563EB",
      isRecurring: false,
    });
  }

  function onEventClick(arg: EventClickArg) {
    const raw = arg.event.extendedProps.raw as
      | {
          id: string;
          title: string;
          description: string | null;
          location: string | null;
          startsAt: string;
          endsAt: string | null;
          capacity: number | null;
          waitlistEnabled: boolean;
          color?: string | null;
          registeredCount: number;
          checkedInCount: number;
        }
      | undefined;

    if (!raw) return;

    setEditingEvent({
      eventId: raw.id,
      title: raw.title,
      startsAt: toLocalDateTimeValue(raw.startsAt),
      endsAt: raw.endsAt ? toLocalDateTimeValue(raw.endsAt) : "",
      color: raw.color ?? "#2563EB",
      description: raw.description,
      location: raw.location,
      capacity: raw.capacity,
      waitlistEnabled: raw.waitlistEnabled,
      registeredCount: raw.registeredCount,
      checkedInCount: raw.checkedInCount,
    });
    setColorPreviewByEventId((prev) => ({ ...prev, [raw.id]: raw.color ?? "#2563EB" }));
    setEditOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Club admin calendar</CardTitle>
            <CardDescription>Move events by drag-and-drop and track overlap impact.</CardDescription>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" asChild>
              <Link href={`/clubs/${clubId}/admin?section=events`}>
                Events tab
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/clubs/${clubId}/admin`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="calendar-shell">
            <div className="w-full">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
                editable
                displayEventEnd
                eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
                events={events}
                eventContent={(arg) => (
                  <div className="fc-custom-event-content">
                    <div className="fc-custom-event-time">{formatEventRange(arg)}</div>
                    <div className="fc-custom-event-title">{arg.event.title}</div>
                  </div>
                )}
                eventClick={onEventClick}
                eventDrop={onDrop}
                eventResize={(arg) => onDrop(arg as unknown as EventDropArg)}
                height="auto"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Overlap statistics (privacy-safe)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={refreshStatsMutation.isPending}
              onClick={() => refreshStatsMutation.mutate({ clubId })}
            >
              <RefreshCw className={`h-4 w-4 ${refreshStatsMutation.isPending ? "animate-spin" : ""}`} />
              Refresh stats
            </Button>
          </div>
          <CardDescription>Percentages only, recalculated and cached server-side every 30 minutes.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">Event</th>
                <th className="py-2">RSVP</th>
                <th className="py-2">Overlap</th>
                <th className="py-2">Partial overlap</th>
                <th className="py-2">No overlap</th>
              </tr>
            </thead>
            <tbody>
              {(statsQuery.data ?? []).map((row) => (
                <tr
                  key={row.eventId}
                  className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/40"
                  onClick={() => {
                    setSelectedStats({
                      eventId: row.eventId,
                      title: row.title,
                      startsAt: new Date(row.startsAt),
                      rsvpCount: row.rsvpCount,
                      fullOverlapPercentage: row.fullOverlapPercentage,
                      partialOverlapPercentage: row.partialOverlapPercentage,
                      noOverlapPercentage: row.noOverlapPercentage,
                      totalMembers: row.totalMembers,
                      calculatedAt: new Date(row.calculatedAt),
                    });
                    setStatsDetailsOpen(true);
                  }}
                >
                  <td className="py-2">{row.title}</td>
                  <td className="py-2">{row.rsvpCount}</td>
                  <td className="py-2 text-red-600">{row.fullOverlapPercentage.toFixed(1)}%</td>
                  <td className="py-2 text-amber-600">{row.partialOverlapPercentage.toFixed(1)}%</td>
                  <td className="py-2 text-emerald-600">{row.noOverlapPercentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Click any row to view detailed overlap breakdown.</p>
        </CardContent>
      </Card>

      <Dialog open={statsDetailsOpen} onOpenChange={setStatsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overlap details</DialogTitle>
          </DialogHeader>
          {selectedStats ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p><span className="font-semibold">Event:</span> {selectedStats.title}</p>
                <p><span className="font-semibold">Starts:</span> {selectedStats.startsAt.toLocaleString()}</p>
                <p><span className="font-semibold">RSVP count:</span> {selectedStats.rsvpCount}</p>
                <p><span className="font-semibold">Members analyzed:</span> {selectedStats.totalMembers}</p>
                <p><span className="font-semibold">Calculated at:</span> {selectedStats.calculatedAt.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-red-300 bg-red-50 p-3">
                  <p className="text-xs text-red-700">Overlap</p>
                  <p className="text-lg font-semibold text-red-700">{selectedStats.fullOverlapPercentage.toFixed(1)}%</p>
                  <p className="text-xs text-red-700">
                    ~{Math.max(0, Math.round((selectedStats.fullOverlapPercentage / 100) * selectedStats.totalMembers))} members
                  </p>
                </div>
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Partial overlap</p>
                  <p className="text-lg font-semibold text-amber-700">{selectedStats.partialOverlapPercentage.toFixed(1)}%</p>
                  <p className="text-xs text-amber-700">
                    ~{Math.max(0, Math.round((selectedStats.partialOverlapPercentage / 100) * selectedStats.totalMembers))} members
                  </p>
                </div>
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">No overlap</p>
                  <p className="text-lg font-semibold text-emerald-700">{selectedStats.noOverlapPercentage.toFixed(1)}%</p>
                  <p className="text-xs text-emerald-700">
                    ~{Math.max(0, Math.round((selectedStats.noOverlapPercentage / 100) * selectedStats.totalMembers))} members
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && editingEvent) {
            setColorPreviewByEventId((prev) => {
              const copy = { ...prev };
              delete copy[editingEvent.eventId];
              return copy;
            });
          }
          setEditOpen(nextOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit event color</DialogTitle>
          </DialogHeader>
          {editingEvent ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
                <p><span className="font-semibold">Registered:</span> {editingEvent.registeredCount}</p>
                <p><span className="font-semibold">Checked-in:</span> {editingEvent.checkedInCount}</p>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={editingEvent.title} onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingEvent.description ?? ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value || null })}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={editingEvent.location ?? ""}
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value || null })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="datetime-local"
                    value={editingEvent.startsAt}
                    onChange={(e) => setEditingEvent({ ...editingEvent, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="datetime-local"
                    value={editingEvent.endsAt}
                    onChange={(e) => setEditingEvent({ ...editingEvent, endsAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editingEvent.capacity ?? ""}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        capacity: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((colorOption) => (
                    <button
                      key={colorOption}
                      type="button"
                      aria-label={`Pick ${colorOption}`}
                      onClick={() => {
                        setEditingEvent({ ...editingEvent, color: colorOption });
                        setColorPreviewByEventId((prev) => ({
                          ...prev,
                          [editingEvent.eventId]: colorOption,
                        }));
                      }}
                      className={`h-8 w-8 rounded-full border-2 ${editingEvent.color === colorOption ? "border-foreground" : "border-border"}`}
                      style={{ backgroundColor: colorOption }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={!editingEvent}
              onClick={() => {
                if (!editingEvent) return;
                updateMutation.mutate(
                  {
                    eventId: editingEvent.eventId,
                    clubId,
                    title: editingEvent.title,
                    description: editingEvent.description,
                    location: editingEvent.location,
                    startsAt: new Date(editingEvent.startsAt),
                    endsAt: editingEvent.endsAt ? new Date(editingEvent.endsAt) : null,
                    color: editingEvent.color,
                    isRecurring: false,
                    capacity: editingEvent.capacity,
                    waitlistEnabled: editingEvent.waitlistEnabled,
                  },
                  {
                    onSuccess: () => {
                      setColorPreviewByEventId((prev) => ({
                        ...prev,
                        [editingEvent.eventId]: editingEvent.color,
                      }));
                      setEditOpen(false);
                      toast.success("Event color updated");
                    },
                  }
                );
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
