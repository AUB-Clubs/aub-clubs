'use client'

import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty } from '@/components/ui/empty'
import { CalendarDays, CalendarClock, Users, Ticket } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

type ViewerStatus = 'REGISTERED' | 'WAITLIST' | 'CHECKED_IN' | null
type TimeState = 'UPCOMING' | 'SOLD_OUT' | 'ENDED'

type ClubEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
  startsAt: string
  endsAt: string | null
  capacity: number | null
  waitlistEnabled: boolean

  registeredCount: number
  checkedInCount: number
  waitlistCount: number

  viewerStatus: ViewerStatus
  timeState: TimeState
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getBadgeConfig(e: ClubEvent): { label: string; className: string } {
  if (e.timeState === 'ENDED') return { label: 'Ended', className: 'bg-muted text-muted-foreground' }
  if (e.timeState === 'SOLD_OUT') return { label: 'Sold out', className: 'bg-red-500/10 text-red-700 dark:text-red-400' }
  return { label: 'Upcoming', className: 'bg-green-500/10 text-green-700 dark:text-green-400' }
}

function getRsvpButton(e: ClubEvent): { text: string; disabled: boolean; intent: 'default' | 'secondary' | 'outline' } {
  if (e.viewerStatus === 'CHECKED_IN') return { text: 'Checked in', disabled: true, intent: 'secondary' }
  if (e.viewerStatus === 'REGISTERED') return { text: 'Registered', disabled: true, intent: 'secondary' }
  if (e.viewerStatus === 'WAITLIST') return { text: 'Waitlisted', disabled: true, intent: 'secondary' }

  if (e.timeState === 'SOLD_OUT') {
    if (e.waitlistEnabled) return { text: 'Join waitlist', disabled: false, intent: 'outline' }
    return { text: 'Sold out', disabled: true, intent: 'secondary' }
  }

  return { text: 'RSVP', disabled: false, intent: 'default' }
}

export default function ClubEventsPublic({ clubId }: { clubId: string }) {
  const utils = trpc.useUtils()

  const eventsQuery = trpc.clubs.events.getClubEvents.useQuery(
    { clubId, upcomingLimit: 6, pastLimit: 6 },
    { enabled: !!clubId, refetchInterval: 15000 }
  )

  const rsvpMutation = trpc.clubs.events.rsvpToEvent.useMutation({
    onSuccess: async () => {
      await utils.clubs.events.getClubEvents.invalidate({ clubId })
    },
  })

  const upcoming = eventsQuery.data?.upcoming ?? []
  const past = eventsQuery.data?.past ?? []

  const isLoading = eventsQuery.isLoading

  const hasUpcoming = useMemo(() => upcoming.length > 0, [upcoming])

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden transition-shadow hover:shadow-md border-dashed">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="size-4" />
                Upcoming events
              </CardTitle>
              <p className="text-sm text-muted-foreground">RSVP, track seats, and join the waitlist when needed.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : !hasUpcoming ? (
            <Empty className="py-10">
              <CalendarClock className="size-8 text-muted-foreground" />
              <p className="font-medium">No upcoming events</p>
              <p className="text-sm text-muted-foreground">When the club schedules events, they will appear here.</p>
            </Empty>
          ) : (
            <ScrollArea className="-mx-2">
              <ul className="space-y-3 pb-2">
                {upcoming.map((e: ClubEvent) => {
                  const badge = getBadgeConfig(e)
                  const rsvp = getRsvpButton(e)
                  return (
                    <li key={e.id} className="rounded-xl border bg-muted/10 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn('gap-1', badge.className)} variant="secondary">
                              <Ticket className="size-3.5" />
                              {badge.label}
                            </Badge>
                            {e.capacity !== null && (
                              <Badge variant="outline" className="text-xs">
                                {e.registeredCount}/{e.capacity} seats
                              </Badge>
                            )}
                            {e.waitlistEnabled && e.waitlistCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {e.waitlistCount} waitlist
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 font-semibold truncate">{e.title}</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(e.startsAt)}</p>
                          {e.location && <p className="text-xs text-muted-foreground">{e.location}</p>}
                          {e.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{e.description}</p>}
                        </div>

                        <div className="sm:shrink-0 flex items-center sm:items-end gap-2">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                              <Users className="size-3.5" />
                              {e.registeredCount} registered
                            </p>
                            {e.checkedInCount > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <CalendarClock className="size-3.5" />
                                {e.checkedInCount} checked in
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={rsvp.intent === 'default' ? 'default' : rsvp.intent}
                            disabled={rsvp.disabled || rsvpMutation.isPending}
                            className="rounded-lg"
                            onClick={() => rsvpMutation.mutate({ eventId: e.id })}
                          >
                            {rsvp.text}
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden transition-shadow hover:shadow-md border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="size-4" />
            Past events
          </CardTitle>
          <p className="text-sm text-muted-foreground">Archive of ended events.</p>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : past.length === 0 ? (
            <Empty className="py-10">
              <CalendarClock className="size-8 text-muted-foreground" />
              <p className="font-medium">No past events</p>
              <p className="text-sm text-muted-foreground">Events that have already ended will show here.</p>
            </Empty>
          ) : (
            <ScrollArea className="-mx-2">
              <ul className="space-y-3 pb-2">
                {past.map((e: ClubEvent) => {
                  const badge = getBadgeConfig(e)
                  return (
                    <li key={e.id} className="rounded-xl border bg-muted/10 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn('gap-1', badge.className)} variant="secondary">
                              {badge.label}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {e.registeredCount} attendees
                            </Badge>
                          </div>
                          <p className="mt-2 font-semibold truncate">{e.title}</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(e.startsAt)}</p>
                          {e.location && <p className="text-xs text-muted-foreground">{e.location}</p>}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

