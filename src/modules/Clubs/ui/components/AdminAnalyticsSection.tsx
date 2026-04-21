'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Calendar, Megaphone, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#ffffff', padding: 30 },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#111' },
  section: { margin: 10, padding: 10, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: 5, marginBottom: 10 },
  label: { fontSize: 14, color: '#444' },
  value: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: '#888', fontSize: 10 }
});

const AnalyticsPDF = ({ data }: { data: { clubName: string; membersCount: number; eventsCount: number; postsCount: number; } }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{data.clubName} - Semester Report</Text>
      
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Total Active Members</Text>
          <Text style={styles.value}>{data.membersCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Events Hosted</Text>
          <Text style={styles.value}>{data.eventsCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Announcements Published</Text>
          <Text style={styles.value}>{data.postsCount}</Text>
        </View>
      </View>

      <Text style={styles.footer}>Generated on {new Date().toLocaleDateString()}</Text>
    </Page>
  </Document>
);


export function AnalyticsSection({ clubId }: { clubId: string }) {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('yearly')
  const query = trpc.clubs.analytics.getClubAnalytics.useQuery({ clubId })

  const activityQuery = trpc.clubs.analytics.getClubActivityOverTime.useQuery({
    clubId,
    interval,
  })

  const activityTable = useMemo(() => {
    const posts = activityQuery.data?.posts ?? []
    const events = activityQuery.data?.events ?? []
    const map = new Map<string, { period: string; posts: number; events: number }>()
    for (const p of posts) {
      const cur = map.get(p.period) ?? { period: p.period, posts: 0, events: 0 }
      cur.posts = p.count
      map.set(p.period, cur)
    }
    for (const e of events) {
      const cur = map.get(e.period) ?? { period: e.period, posts: 0, events: 0 }
      cur.events = e.count
      map.set(e.period, cur)
    }
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period))
  }, [activityQuery.data])

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
           <Skeleton className="h-32 rounded-xl" />
           <Skeleton className="h-32 rounded-xl" />
           <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    )
  }

  const data = query.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Club Analytics</h2>
          <p className="text-sm text-muted-foreground">Overview of your club&apos;s performance</p>
        </div>
        
        {data && (
          <div suppressHydrationWarning>
            {typeof window !== "undefined" && (
              <PDFDownloadLink 
                document={<AnalyticsPDF data={data} />} 
                fileName={`${data.clubName.replace(/\s+/g, '-').toLowerCase()}-report.pdf`}
              >
                {({ loading }) => (
                  <Button className="gap-2" variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                    {loading ? 'Preparing...' : 'Export PDF Report'}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
            <div className="p-3 bg-primary/10 text-primary rounded-full">
               <Users className="size-6" />
            </div>
            <div className="text-2xl font-bold">{data?.membersCount ?? '--'}</div>
            <div className="text-sm text-muted-foreground">Total Members</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
            <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-full">
               <Calendar className="size-6" />
            </div>
            <div className="text-2xl font-bold">{data?.eventsCount ?? '--'}</div>
            <div className="text-sm text-muted-foreground">Total Events</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-2">
            <div className="p-3 bg-green-500/10 text-green-600 rounded-full">
               <Megaphone className="size-6" />
            </div>
            <div className="text-2xl font-bold">{data?.postsCount ?? '--'}</div>
            <div className="text-sm text-muted-foreground">Announcements</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Activity over time</CardTitle>
            <CardDescription>
              Published posts and scheduled events by {interval === 'yearly' ? 'calendar year' : 'month'}.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={interval === 'yearly' ? 'default' : 'outline'}
              onClick={() => setInterval('yearly')}
            >
              Yearly
            </Button>
            <Button
              type="button"
              size="sm"
              variant={interval === 'monthly' ? 'default' : 'outline'}
              onClick={() => setInterval('monthly')}
            >
              Monthly
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activityQuery.isLoading ? (
            <Skeleton className="h-40 w-full rounded-md" />
          ) : activityTable.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity in this view yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{interval === 'yearly' ? 'Year' : 'Month'}</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityTable.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell className="font-medium">{row.period}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.posts}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.events}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
