'use client'

import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, UserPlus, Users, UserX } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  MEMBER: 'Member',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface MemberManagementDashboardProps {
  clubId: string
}

export default function MemberManagementDashboard({ clubId }: MemberManagementDashboardProps) {
  const dashboard = trpc.clubs.memberManagement.getDashboard.useQuery(
    { clubId },
    { enabled: !!clubId }
  )
  const utils = trpc.useUtils()
  const respond = trpc.clubs.memberManagement.respondToRequest.useMutation({
    onSuccess: () => utils.clubs.memberManagement.getDashboard.invalidate({ clubId }),
  })
  const removeRequest = trpc.clubs.memberManagement.removeRequest.useMutation({
    onSuccess: () => utils.clubs.memberManagement.getDashboard.invalidate({ clubId }),
  })
  const kickMember = trpc.clubs.memberManagement.kickMember.useMutation({
    onSuccess: () => utils.clubs.memberManagement.getDashboard.invalidate({ clubId }),
  })

  if (dashboard.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (dashboard.error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-background to-muted/40 p-6">
        <p className="text-destructive">{dashboard.error.message}</p>
        <Button variant="outline" size="sm" className="rounded-lg" asChild>
          <Link href={`/clubs/${clubId}`}>Back to club</Link>
        </Button>
      </div>
    )
  }

  const { members, pendingRequests } = dashboard.data ?? { members: [], pendingRequests: [] }
  const activeCount = members.filter((m) => m.isActive).length
  const inactiveCount = members.length - activeCount

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Member management</h1>
          <Button variant="outline" size="sm" className="w-fit rounded-lg" asChild>
            <Link href={`/clubs/${clubId}`}>Back to club</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Total members</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-green-500/10">
                <Activity className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active (30d)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <UserX className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{inactiveCount}</p>
                <p className="text-xs text-muted-foreground">Inactive</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
                <UserPlus className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {pendingRequests.length > 0 && (
          <Card className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Pending requests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {pendingRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">
                        {req.firstName} {req.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{req.email}</p>
                      <p className="text-xs text-muted-foreground">Requested {formatDate(req.requestedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        className="rounded-lg"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ clubId, requestId: req.id, action: 'accept' })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ clubId, requestId: req.id, action: 'reject' })}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg text-muted-foreground"
                        disabled={removeRequest.isPending}
                        onClick={() => removeRequest.mutate({ clubId, requestId: req.id })}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(m.joinedAt)}
                      {m.lastActivityAt && ` · Last activity ${formatDate(m.lastActivityAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        m.isActive
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="rounded-lg bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={kickMember.isPending}
                      onClick={() => kickMember.mutate({ clubId, userId: m.userId })}
                    >
                      Kick
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}