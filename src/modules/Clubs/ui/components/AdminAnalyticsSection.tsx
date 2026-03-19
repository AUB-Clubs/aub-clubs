'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Calendar, Megaphone, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'

// Create PDF styles
const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#ffffff', padding: 30 },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#111' },
  section: { margin: 10, padding: 10, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: 5, marginBottom: 10 },
  label: { fontSize: 14, color: '#444' },
  value: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: '#888', fontSize: 10 }
});

// PDF Document Component
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
  const query = trpc.clubs.analytics.getClubAnalytics.useQuery({ clubId })

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
            {/* Note: React-PDF dynamically forces its button children to function incorrectly with hydration sometimes due to SSR. 
                The most stable pattern dynamically checks render status on client. */}
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

    </div>
  )
}
