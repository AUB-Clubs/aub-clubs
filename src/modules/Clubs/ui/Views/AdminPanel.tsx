'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Users,
  UserPlus,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserX,
  Check,
  X,
  Plus,
  ArrowLeft,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Member',
  BOARD: 'Board',
  VICE_PRESIDENT: 'Vice President',
  PRESIDENT: 'President',
}

const ROLE_COLORS: Record<string, string> = {
  MEMBER: 'bg-muted text-muted-foreground',
  BOARD: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  VICE_PRESIDENT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  PRESIDENT: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
}

const ROLE_ORDER = ['MEMBER', 'BOARD', 'VICE_PRESIDENT', 'PRESIDENT'] as const

const AUDIENCE_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  MEMBERS_ONLY: 'Members Only',
  BOARD_ONLY: 'Board Only',
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Main Component ───────────────────────────────────────────────────

export interface AdminPanelProps {
  clubId: string
}

export default function AdminPanel({ clubId }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<'members' | 'requests' | 'announcements' | null>(null)

  // Auth check: only president / vice can access
  const membershipQuery = trpc.clubs.getMembership.useQuery(
    { clubId },
    { enabled: !!clubId }
  )

  const role = membershipQuery.data?.role
  const status = membershipQuery.data?.status
  const isAdmin = status === 'ACCEPTED' && (role === 'PRESIDENT' || role === 'VICE_PRESIDENT')

  // Loading state
  if (membershipQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Not admin → redirect
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only club Presidents and Vice Presidents can access the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href={`/clubs/${clubId}`}>Back to club</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-4xl p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {activeSection && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => setActiveSection(null)}
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {activeSection === 'members'
                  ? 'Members'
                  : activeSection === 'requests'
                    ? 'Join Requests'
                    : activeSection === 'announcements'
                      ? 'Announcements'
                      : 'Admin Panel'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeSection
                  ? 'Manage club settings'
                  : 'Choose a section to manage'}
              </p>
            </div>
          </div>
          <Button variant="default" size="sm" className="w-fit rounded-lg" asChild>
            <Link href={`/clubs/${clubId}`}>Back to club</Link>
          </Button>
        </div>

        {/* Section Cards (home) */}
        {!activeSection && (
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={() => setActiveSection('members')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-primary/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Users className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Members</p>
                    <p className="text-sm text-muted-foreground">
                      View, manage roles, and remove members
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('requests')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-amber-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                    <UserPlus className="size-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Requests</p>
                    <p className="text-sm text-muted-foreground">
                      Accept or reject join requests
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('announcements')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-green-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/10 transition-colors group-hover:bg-green-500/20">
                    <Megaphone className="size-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Announcements</p>
                    <p className="text-sm text-muted-foreground">
                      Create and review announcements
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {/* Section content */}
        {activeSection === 'members' && (
          <MembersSection clubId={clubId} actorRole={role!} />
        )}
        {activeSection === 'requests' && (
          <RequestsSection clubId={clubId} />
        )}
        {activeSection === 'announcements' && (
          <AnnouncementsSection clubId={clubId} />
        )}
      </div>
    </div>
  )
}

// ── Members Section ──────────────────────────────────────────────────

function MembersSection({ clubId, actorRole }: { clubId: string; actorRole: string }) {
  const [page, setPage] = useState(1)
  const limit = 10
  const [kickTarget, setKickTarget] = useState<{ userId: string; name: string } | null>(null)

  const membersQuery = trpc.clubs.memberManagement.getMembers.useQuery(
    { clubId, page, limit },
    { enabled: !!clubId }
  )

  const utils = trpc.useUtils()

  const changeRoleMutation = trpc.clubs.memberManagement.changeRole.useMutation({
    onSuccess: () => utils.clubs.memberManagement.getMembers.invalidate({ clubId }),
  })

  const kickMutation = trpc.clubs.memberManagement.kickMember.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getMembers.invalidate({ clubId })
      setKickTarget(null)
    },
  })

  const data = membersQuery.data

  if (membersQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="size-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No members found.</p>
        </CardContent>
      </Card>
    )
  }

  const canKick = (targetRole: string) => {
    if (actorRole === 'PRESIDENT') return targetRole !== 'PRESIDENT'
    if (actorRole === 'VICE_PRESIDENT') return targetRole !== 'PRESIDENT' && targetRole !== 'VICE_PRESIDENT'
    return false
  }

  const canChangeRole = actorRole === 'PRESIDENT'

  const cycleRole = (currentRole: string) => {
    const idx = ROLE_ORDER.indexOf(currentRole as typeof ROLE_ORDER[number])
    return ROLE_ORDER[(idx + 1) % ROLE_ORDER.length]
  }

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {data.totalCount} member{data.totalCount !== 1 ? 's' : ''}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10 border-2 border-background shadow-sm">
                    {m.avatarUrl ? (
                      <AvatarImage src={m.avatarUrl} alt={`${m.firstName} ${m.lastName}`} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(m.firstName, m.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(m.joinedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {canChangeRole ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={changeRoleMutation.isPending || m.role === 'PRESIDENT'}
                      className={`rounded-lg text-xs font-medium min-w-[110px] ${ROLE_COLORS[m.role] || ''}`}
                      onClick={() =>
                        changeRoleMutation.mutate({
                          clubId,
                          userId: m.userId,
                          newRole: cycleRole(m.role),
                        })
                      }
                    >
                      <Shield className="size-3 mr-1" />
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`rounded-lg text-xs font-medium ${ROLE_COLORS[m.role] || ''}`}
                    >
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                  )}
                  {canKick(m.role) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        setKickTarget({ userId: m.userId, name: `${m.firstName} ${m.lastName}` })
                      }
                    >
                      <UserX className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Kick Confirmation */}
      <AlertDialog open={!!kickTarget} onOpenChange={() => setKickTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kick member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{kickTarget?.name}</strong> from
              this club? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={kickMutation.isPending}
              onClick={() => {
                if (kickTarget) {
                  kickMutation.mutate({ clubId, userId: kickTarget.userId })
                }
              }}
            >
              {kickMutation.isPending ? 'Removing…' : 'Yes, kick'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Requests Section ─────────────────────────────────────────────────

function RequestsSection({ clubId }: { clubId: string }) {
  const requestsQuery = trpc.clubs.memberManagement.getPendingRequests.useQuery(
    { clubId },
    { enabled: !!clubId }
  )

  const utils = trpc.useUtils()

  const respondMutation = trpc.clubs.memberManagement.respondToRequest.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getPendingRequests.invalidate({ clubId })
      utils.clubs.memberManagement.getMembers.invalidate({ clubId })
    },
  })

  if (requestsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  const requests = requestsQuery.data ?? []

  if (requests.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserPlus className="size-8 text-muted-foreground mb-3" />
          <p className="font-medium">No pending requests</p>
          <p className="text-sm text-muted-foreground">
            New join requests will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {requests.length} pending request{requests.length !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {requests.map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="size-10 border-2 border-background shadow-sm">
                  {req.avatarUrl ? (
                    <AvatarImage src={req.avatarUrl} alt={`${req.firstName} ${req.lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium">
                    {getInitials(req.firstName, req.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {req.firstName} {req.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDate(req.requestedAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-lg gap-1"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      clubId,
                      membershipId: req.id,
                      action: 'accept',
                    })
                  }
                >
                  <Check className="size-3.5" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg gap-1"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      clubId,
                      membershipId: req.id,
                      action: 'reject',
                    })
                  }
                >
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ── Announcements Section ────────────────────────────────────────────

function AnnouncementsSection({ clubId }: { clubId: string }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    audience: 'PUBLIC' as 'PUBLIC' | 'MEMBERS_ONLY' | 'BOARD_ONLY',
  })

  const announcementsQuery = trpc.clubs.memberManagement.getAdminAnnouncements.useQuery(
    { clubId },
    { enabled: !!clubId }
  )

  const utils = trpc.useUtils()

  const createMutation = trpc.clubs.memberManagement.createAnnouncement.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getAdminAnnouncements.invalidate({ clubId })
      setCreateOpen(false)
      setForm({ title: '', content: '', audience: 'PUBLIC' })
    },
  })

  const reviewMutation = trpc.clubs.memberManagement.reviewAnnouncement.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getAdminAnnouncements.invalidate({ clubId })
      utils.clubs.getAnnouncements.invalidate({ clubId })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    createMutation.mutate({
      clubId,
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
    })
  }

  if (announcementsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-muted/30 px-4 py-4 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  const announcements = announcementsQuery.data ?? []

  return (
    <>
      {/* Create button */}
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 rounded-lg">
              <Plus className="size-4" />
              Create Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Announcement</DialogTitle>
              <DialogDescription>
                Announcements are created as drafts. A President or Vice President must approve before publishing.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  placeholder="Announcement title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={500}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-content">Content</Label>
                <Textarea
                  id="ann-content"
                  placeholder="Announcement content…"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={4}
                  maxLength={10000}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select
                  value={form.audience}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      audience: val as 'PUBLIC' | 'MEMBERS_ONLY' | 'BOARD_ONLY',
                    }))
                  }
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public — visible to everyone</SelectItem>
                    <SelectItem value="MEMBERS_ONLY">Members Only</SelectItem>
                    <SelectItem value="BOARD_ONLY">Board Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !form.title.trim() ||
                    !form.content.trim()
                  }
                >
                  {createMutation.isPending ? 'Creating…' : 'Save as Draft'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="size-8 text-muted-foreground mb-3" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first announcement using the button above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card
              key={a.id}
              className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50"
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={a.status === 'PUBLISHED' ? 'default' : 'secondary'}
                      className={`text-xs ${a.status === 'DRAFT'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400'
                        }`}
                    >
                      {a.status === 'DRAFT' ? '● Draft' : '✓ Published'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {AUDIENCE_LABELS[a.audience] ?? a.audience}
                    </Badge>
                  </div>
                  {a.status === 'DRAFT' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-lg gap-1"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            clubId,
                            postId: a.id,
                            action: 'approve',
                          })
                        }
                      >
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1 text-destructive hover:bg-destructive/10"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            clubId,
                            postId: a.id,
                            action: 'reject',
                          })
                        }
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <h3 className="font-semibold text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {a.content}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  By {a.author} · {formatDate(a.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
