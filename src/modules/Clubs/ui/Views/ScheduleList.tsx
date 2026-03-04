'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { CalendarDays, Trash2, Plus } from 'lucide-react';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

const DAY_LABELS: Record<string, string> = {
  MONDAY:    'Monday',
  TUESDAY:   'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY:  'Thursday',
  FRIDAY:    'Friday',
  SATURDAY:  'Saturday',
  SUNDAY:    'Sunday',
};

type Slot = {
  courseCode: string;
  dayOfWeek:  string;
  startTime:  string;
  endTime:    string;
};

type ScheduleSlot = {
  courseCode: string;
  dayOfWeek:  string;
  startTime:  Date;
  endTime:    Date;
};

const DEFAULT_SLOT: Slot = {
  courseCode: '',
  dayOfWeek:  'MONDAY',
  startTime:  '08:00',
  endTime:    '09:15',
};

export default function ScheduleView() {
  const [slots, setSlots] = useState<Slot[]>([{ ...DEFAULT_SLOT }]);
  const [saved, setSaved] = useState(false);

  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

  const userId = profile?.id;

  const scheduleQuery = trpc.schedule.getMySchedule.useQuery(
    { userId: userId! },
    { enabled: !!userId }
  );

  useEffect(function () {
    if (scheduleQuery.data && scheduleQuery.data.length > 0) {
      setSlots(
        scheduleQuery.data.map(function (s: ScheduleSlot) {
          return {
            courseCode: s.courseCode,
            dayOfWeek:  s.dayOfWeek,
            startTime:  new Date(s.startTime).toISOString().slice(11, 16),
            endTime:    new Date(s.endTime).toISOString().slice(11, 16),
          };
        })
      );
    }
  }, [scheduleQuery.data]);

  const upsertMutation = trpc.schedule.upsertSchedule.useMutation({
    onSuccess: function () {
      setSaved(true);
      setTimeout(function () { setSaved(false); }, 3000);
    },
  });

  function addSlot() {
    setSlots(function (prev) { return [...prev, { ...DEFAULT_SLOT }]; });
  }

  function removeSlot(index: number) {
    setSlots(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
  }

  function updateSlot(index: number, field: keyof Slot, value: string) {
    setSlots(function (prev) {
      return prev.map(function (slot, i) {
        return i === index ? { ...slot, [field]: value } : slot;
      });
    });
  }

  function handleSave() {
    if (!userId) return;

    const payload = slots.map(function (slot) {
      return {
        courseCode: slot.courseCode,
        dayOfWeek:  slot.dayOfWeek as typeof DAYS[number],
        startTime:  `1970-01-01T${slot.startTime}:00.000Z`,
        endTime:    `1970-01-01T${slot.endTime}:00.000Z`,
      };
    });

    upsertMutation.mutate({ userId, slots: payload });
  }

  if (scheduleQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        {[1, 2, 3].map(function (i) {
          return (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex flex-wrap gap-3">
                  <Skeleton className="h-10 w-36" />
                  <Skeleton className="h-10 w-36" />
                  <Skeleton className="h-10 w-28" />
                  <Skeleton className="h-10 w-28" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">My Class Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Enter your weekly classes so we can detect conflicts with club events.
        </p>
      </div>

      <div className="space-y-3">
        {slots.length === 0 ? (
          <Card className="border-dashed">
            <Empty className="py-12">
              <EmptyMedia variant="icon">
                <CalendarDays className="size-8 text-muted-foreground" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No classes added</EmptyTitle>
                <EmptyDescription>
                  Add your first class slot to get started.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          slots.map(function (slot, i) {
            return (
              <Card key={i} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Course Code</Label>
                      <Input
                        placeholder="e.g. CMPS 200"
                        value={slot.courseCode}
                        onChange={function (e) { updateSlot(i, 'courseCode', e.target.value); }}
                        className="w-36"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Day</Label>
                      <Select
                        value={slot.dayOfWeek}
                        onValueChange={function (v) { updateSlot(i, 'dayOfWeek', v); }}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map(function (day) {
                            return (
                              <SelectItem key={day} value={day}>
                                {DAY_LABELS[day]}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Start Time</Label>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={function (e) { updateSlot(i, 'startTime', e.target.value); }}
                        className="w-28"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">End Time</Label>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={function (e) { updateSlot(i, 'endTime', e.target.value); }}
                        className="w-28"
                      />
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={function () { removeSlot(i); }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={addSlot} className="gap-1.5">
          <Plus className="size-4" />
          Add Class
        </Button>
        <Button
          onClick={handleSave}
          disabled={upsertMutation.isPending || slots.length === 0}
        >
          {upsertMutation.isPending ? 'Saving...' : 'Save Schedule'}
        </Button>
        {saved && (
          <Badge className="bg-green-100 text-green-800">Schedule saved</Badge>
        )}
      </div>
    </div>
  );
}