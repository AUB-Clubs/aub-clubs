'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function UniversityAdminReportsPage() {
  const profileQuery = trpc.profile.get.useQuery()
  const isAdmin = profileQuery.data?.isUniversityAdmin ?? false

  const currentYear = new Date().getFullYear()
  const [yearFrom, setYearFrom] = useState(String(currentYear - 5))
  const [yearTo, setYearTo] = useState(String(currentYear))

  const yearFromNum = Number.parseInt(yearFrom, 10)
  const yearToNum = Number.parseInt(yearTo, 10)
  const yearFilterValid =
    Number.isFinite(yearFromNum) &&
    Number.isFinite(yearToNum) &&
    yearFromNum <= yearToNum

  const activityQuery = trpc.universityAdmin.getYearlyClubActivity.useQuery(
    yearFilterValid ? { yearFrom: yearFromNum, yearTo: yearToNum } : undefined,
    { enabled: isAdmin && yearFilterValid }
  )

  const fundingQuery = trpc.universityAdmin.getFundingOverview.useQuery(undefined, {
    enabled: isAdmin,
  })

  const activityRows = activityQuery.data?.rows ?? []

  const fundingWithMovement = useMemo(() => {
    const rows = fundingQuery.data?.clubs ?? []
    return rows.filter((c) => c.totalIncome > 0 || c.totalExpense > 0)
  }, [fundingQuery.data?.clubs])

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Restricted</CardTitle>
          <CardDescription>
            Club activity and funding oversight is limited to university administrators. Ask your
            team to add your email to the UNIVERSITY_ADMIN_EMAILS environment variable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/discover">Back to Discover</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">University oversight</h1>
        <p className="text-sm text-muted-foreground">
          Historical club activity and logged funding across all registered clubs.
        </p>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity by year</TabsTrigger>
          <TabsTrigger value="funding">Funding overview</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Year range</CardTitle>
              <CardDescription>Filter published posts, scheduled events, and accepted memberships.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="year-from">From</Label>
                <Input
                  id="year-from"
                  type="number"
                  min={1970}
                  max={2100}
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-to">To</Label>
                <Input
                  id="year-to"
                  type="number"
                  min={1970}
                  max={2100}
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => activityQuery.refetch()}
                disabled={!yearFilterValid || activityQuery.isFetching}
              >
                Apply
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Club activity report</CardTitle>
              <CardDescription>Aggregated counts per club and calendar year.</CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : activityRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data in this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead className="text-right">CRN</TableHead>
                        <TableHead className="text-right">Posts</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                        <TableHead className="text-right">Joins</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityRows.map((r) => (
                        <TableRow key={`${r.clubId}-${r.year}`}>
                          <TableCell className="font-medium">{r.year}</TableCell>
                          <TableCell>{r.clubTitle}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.crn}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.publishedPosts}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.eventsHosted}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.membershipsAccepted}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Funding logged by clubs</CardTitle>
              <CardDescription>
                Totals from club-submitted income and expenses (presidents and vice presidents can
                add entries in each club&apos;s admin panel).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fundingQuery.isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="space-y-4">
                  {fundingWithMovement.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No funding entries yet. Clubs can log funding from Admin → Funding.
                    </p>
                  ) : null}
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Club</TableHead>
                          <TableHead className="text-right">CRN</TableHead>
                          <TableHead className="text-right">Income</TableHead>
                          <TableHead className="text-right">Spending</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(fundingQuery.data?.clubs ?? []).map((c) => (
                          <TableRow key={c.clubId}>
                            <TableCell className="font-medium">{c.clubTitle}</TableCell>
                            <TableCell className="text-right tabular-nums">{c.crn}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {c.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {c.totalExpense.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {c.netBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
