'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar, Plus, Users, MapPin, CheckCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function EventsSection({ clubId }: { clubId: string }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: '',
    waitlistEnabled: true,
  })
  
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const utils = trpc.useUtils()
  
  const eventsQuery = trpc.clubs.events.getClubEvents.useQuery({
    clubId,
    upcomingLimit: 50,
    pastLimit: 50,
  }, { enabled: !!clubId })
  
  const createMutation = trpc.clubs.events.createEvent.useMutation({
    onSuccess: () => {
      utils.clubs.events.getClubEvents.invalidate({ clubId })
      setCreateOpen(false)
      setForm({ title: '', description: '', location: '', startsAt: '', endsAt: '', capacity: '', waitlistEnabled: true })
    }
  })
  
  const deleteMutation = trpc.clubs.events.deleteEvent.useMutation({
    onSuccess: () => {
      utils.clubs.events.getClubEvents.invalidate({ clubId })
    }
  })

  // Basic Attendance Dialog 
  if (selectedEventId) {
    return <EventAttendanceView eventId={selectedEventId} clubId={clubId} onBack={() => setSelectedEventId(null)} />
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      clubId,
      title: form.title,
      description: form.description || undefined,
      location: form.location || undefined,
      startsAt: new Date(form.startsAt),
      endsAt: form.endsAt ? new Date(form.endsAt) : undefined,
      capacity: form.capacity ? parseInt(form.capacity) : undefined,
      waitlistEnabled: form.waitlistEnabled,
    })
  }

  if (eventsQuery.isLoading) {
    return <Skeleton className="h-64 rounded-2xl" />
  }

  const events = [
    ...(eventsQuery.data?.upcoming || []),
    ...(eventsQuery.data?.past || [])
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Upcoming & Past Events</h2>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>New Event</DialogTitle>
              <DialogDescription>Fill in the details for your event.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Date & Time (Start)</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={e => setForm({...form, startsAt: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Date & Time (End)</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={e => setForm({...form, endsAt: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Capacity (Optional)</Label>
                <Input type="number" placeholder="Leave blank for unlimited" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Event"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-12">
              <Calendar className="size-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No events found.</p>
            </CardContent>
          </Card>
        ) : (
          events.map(event => (
            <Card key={event.id}>
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
                <div className="space-y-1">
                  <h3 className="font-semibold">{event.title}</h3>
                  <div className="text-sm text-muted-foreground flex flex-col gap-1">
                    <span>{new Date(event.startsAt).toLocaleString()}</span>
                    {event.location && <span className="flex items-center gap-1"><MapPin className="size-3"/> {event.location}</span>}
                  </div>
                   <div className="text-sm pt-2 flex gap-4">
                      <span className="text-primary">{event.registeredCount} Registered</span>
                      <span className="text-green-600">{event.checkedInCount} Checked In</span>
                   </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedEventId(event.id)}>
                    <Users className="size-4 mr-2" />
                    Attendance
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => { if(confirm("Are you sure?")) deleteMutation.mutate({ eventId: event.id }) }}>
                    X
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function EventAttendanceView({ eventId, clubId, onBack }: { eventId: string, clubId: string, onBack: () => void }) {
  const attendanceQuery = trpc.clubs.events.getEventAttendance.useQuery({ eventId })
  const utils = trpc.useUtils()
  
  const checkInMutation = trpc.clubs.events.checkIn.useMutation({
    onSuccess: () => {
      utils.clubs.events.getEventAttendance.invalidate({ eventId })
      utils.clubs.events.getClubEvents.invalidate({ clubId })
    }
  })

  if (attendanceQuery.isLoading) return <Skeleton className="h-64 rounded-2xl" />

  const attendees = attendanceQuery.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
        <h2 className="text-xl font-bold">Event Attendance</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {attendees.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No registrations yet.</div>
            ) : (
              attendees.map(user => (
                <div key={user.userId} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{user.firstName} {user.lastName}</div>
                    <div className="text-xs px-2 py-1 bg-muted rounded-full">{user.status}</div>
                  </div>
                  <div>
                    {user.status === "REGISTERED" && (
                      <Button size="sm" onClick={() => checkInMutation.mutate({ eventId, userId: user.userId })} disabled={checkInMutation.isPending}>
                        <CheckCircle className="size-4 mr-2" />
                        Check In
                      </Button>
                    )}
                    {user.status === "CHECKED_IN" && (
                      <div className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="size-4" />
                        Checked In at {user.checkedInAt ? new Date(user.checkedInAt).toLocaleTimeString() : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
