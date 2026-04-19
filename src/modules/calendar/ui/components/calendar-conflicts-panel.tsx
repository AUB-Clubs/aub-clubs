"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConflictRow } from "../lib/busy-and-conflicts";

export function CalendarConflictsPanel({ rows }: { rows: ConflictRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conflicts</CardTitle>
          <CardDescription>
            No overlaps between your club events and your class schedule or Outlook calendar in this range.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600 shrink-0" />
          Scheduling conflicts
        </CardTitle>
        <CardDescription>
          These club events overlap something on your schedule or Microsoft calendar. You can still RSVP from the
          calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-56 pr-3">
          <ul className="space-y-3 text-sm">
            {rows.map(({ event, overlaps }) => (
              <li key={event.id} className="rounded-md border border-border bg-background/80 p-3">
                <p className="font-medium">
                  {event.title}{" "}
                  <span className="font-normal text-muted-foreground">({event.clubTitle})</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(event.startsAt).toLocaleString()} –{" "}
                  {new Date(event.endsAt ?? event.startsAt).toLocaleString()}
                </p>
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {overlaps.map((o, i) => (
                    <li key={`${event.id}-${i}`}>
                      {o.source === "outlook" ? "Outlook: " : "Schedule: "}
                      {o.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
