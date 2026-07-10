'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { keepPreviousData } from '@tanstack/react-query';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ClubStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'INACTIVE';
type Club = {
  id: string;
  title: string;
  crn: number;
  description: string;
  imageUrl: string | null;
  status: string;
  _count: { memberships: number };
};

const STATUS_LABELS: Record<ClubStatus, string> = {
  PENDING_REVIEW: 'Pending Review',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

const STATUS_BADGE_CLASS: Record<ClubStatus, string> = {
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  ACTIVE: 'bg-green-100 text-green-800 hover:bg-green-100',
  INACTIVE: 'bg-red-100 text-red-800 hover:bg-red-100',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={STATUS_BADGE_CLASS[status as ClubStatus]}>
      {STATUS_LABELS[status as ClubStatus]}
    </Badge>
  );
}

export default function UniversityAdminPanel() {
  const profileQuery = trpc.profile.get.useQuery();
  const isAdmin = profileQuery.data?.isUniversityAdmin ?? false;
  const currentYear = new Date().getFullYear();
  const [yearFrom, setYearFrom] = useState(String(currentYear - 5));
  const [yearTo, setYearTo] = useState(String(currentYear));

  const yearFromNum = Number.parseInt(yearFrom, 10);
  const yearToNum = Number.parseInt(yearTo, 10);
  const yearFilterValid = Number.isFinite(yearFromNum) && Number.isFinite(yearToNum) && yearFromNum <= yearToNum;

  const activityQuery = trpc.admin.getYearlyClubActivity.useQuery(
    yearFilterValid ? { yearFrom: yearFromNum, yearTo: yearToNum } : undefined,
    { enabled: isAdmin && yearFilterValid }
  );
  const fundingQuery = trpc.admin.getFundingOverview.useQuery(undefined, { enabled: isAdmin });

  const fundingWithMovement = useMemo(() => {
    const rows = fundingQuery.data?.clubs ?? [];
    return rows.filter((c) => c.totalIncome > 0 || c.totalExpense > 0);
  }, [fundingQuery.data?.clubs]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const statusParam = (searchParams.get('status') || 'ALL') as ClubStatus | 'ALL';
  const [pageInput, setPageInput] = useState(page.toString());
  const [confirm, setConfirm] = useState<{ clubId: string; clubTitle: string; newStatus: ClubStatus } | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.admin.listClubsForReview.useQuery(
    { status: statusParam === 'ALL' ? undefined : statusParam, page, limit: 10 },
    { placeholderData: keepPreviousData, enabled: isAdmin }
  );

  const setStatus = trpc.admin.setClubStatus.useMutation({
    onSuccess: (updated) => {
      toast.success(`"${updated.title}" marked as ${STATUS_LABELS[updated.status as ClubStatus]}`);
      void utils.admin.listClubsForReview.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const clubs: Club[] = data?.clubs ?? [];
  const totalPages = data?.totalPages ?? 0;

  function handlePageChange(newPage: number) {
    if (newPage > 0 && newPage <= totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      router.push(`${pathname}?${params.toString()}`);
    }
  }
  function handleStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams);
    params.delete('page');
    if (value === 'ALL') params.delete('status');
    else params.set('status', value);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (profileQuery.isLoading) {
    return <div className="mx-auto max-w-6xl space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Restricted</CardTitle>
          <CardDescription>University admin access is required for this panel.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild><Link href="/discover">Back to Discover</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">University Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Club verification, yearly activity reports, and funding oversight.</p>
        </div>
      </div>

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Club verification</TabsTrigger>
          <TabsTrigger value="activity">Activity reports</TabsTrigger>
          <TabsTrigger value="funding">Funding reports</TabsTrigger>
        </TabsList>

        <TabsContent value="clubs" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">Filter by status:</span>
            <Select value={statusParam} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Filter by status..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Clubs</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[300px]">Club</TableHead><TableHead>CRN</TableHead><TableHead>Description</TableHead><TableHead>Members</TableHead><TableHead>Status</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoading ? Array.from({ length: 10 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>) : clubs.map((club) => (
                      <TableRow key={club.id}>
                        <TableCell className="font-medium"><div className="flex items-center gap-4"><Avatar><AvatarImage src={club.imageUrl ?? undefined} alt={club.title} /><AvatarFallback>{club.title.charAt(0).toUpperCase()}</AvatarFallback></Avatar><span className="font-semibold">{club.title}</span></div></TableCell>
                        <TableCell>{club.crn}</TableCell>
                        <TableCell><p className="line-clamp-2 max-w-md text-muted-foreground">{club.description}</p></TableCell>
                        <TableCell>{club._count.memberships}</TableCell>
                        <TableCell><StatusBadge status={club.status} /></TableCell>
                        <TableCell><div className="flex justify-end gap-2">
                          {club.status !== 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => setConfirm({ clubId: club.id, clubTitle: club.title, newStatus: 'ACTIVE' })}>Mark Active</Button>}
                          {club.status !== 'INACTIVE' && <Button size="sm" variant="outline" onClick={() => setConfirm({ clubId: club.id, clubTitle: club.title, newStatus: 'INACTIVE' })}>Mark Inactive</Button>}
                          {club.status !== 'PENDING_REVIEW' && <Button size="sm" variant="ghost" onClick={() => setConfirm({ clubId: club.id, clubTitle: club.title, newStatus: 'PENDING_REVIEW' })}>Reset</Button>}
                        </div></TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && clubs.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">No clubs found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
              {totalPages > 1 && (
                <CardFooter className="py-4 flex items-center justify-between border-t text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium">Page
                    <Input className="h-8 w-14 text-center" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        let newPage = parseInt(pageInput);
                        if (isNaN(newPage) || newPage < 1) newPage = 1;
                        if (newPage > totalPages) newPage = totalPages;
                        setPageInput(newPage.toString());
                        handlePageChange(newPage);
                      }
                    }} />
                    of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>Next</Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Year range</CardTitle><CardDescription>Published posts, scheduled events, and accepted memberships.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-2"><Label htmlFor="year-from">From</Label><Input id="year-from" type="number" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} className="w-32" /></div>
              <div className="space-y-2"><Label htmlFor="year-to">To</Label><Input id="year-to" type="number" value={yearTo} onChange={(e) => setYearTo(e.target.value)} className="w-32" /></div>
              <Button type="button" variant="secondary" onClick={() => activityQuery.refetch()} disabled={!yearFilterValid || activityQuery.isFetching}>Apply</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Club activity report</CardTitle><CardDescription>Aggregated counts per club and year.</CardDescription></CardHeader>
            <CardContent>
              {activityQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
                <div className="overflow-x-auto rounded-md border">
                  <Table><TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Club</TableHead><TableHead className="text-right">CRN</TableHead><TableHead className="text-right">Posts</TableHead><TableHead className="text-right">Events</TableHead><TableHead className="text-right">Joins</TableHead></TableRow></TableHeader>
                    <TableBody>{(activityQuery.data?.rows ?? []).map((r) => <TableRow key={`${r.clubId}-${r.year}`}><TableCell className="font-medium">{r.year}</TableCell><TableCell>{r.clubTitle}</TableCell><TableCell className="text-right">{r.crn}</TableCell><TableCell className="text-right">{r.publishedPosts}</TableCell><TableCell className="text-right">{r.eventsHosted}</TableCell><TableCell className="text-right">{r.membershipsAccepted}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funding">
          <Card>
            <CardHeader><CardTitle>Funding logged by clubs</CardTitle><CardDescription>Income and expenses reported by each club admin.</CardDescription></CardHeader>
            <CardContent>
              {fundingQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-4">
                  {fundingWithMovement.length === 0 ? <p className="text-sm text-muted-foreground">No funding entries yet.</p> : null}
                  <div className="overflow-x-auto rounded-md border">
                    <Table><TableHeader><TableRow><TableHead>Club</TableHead><TableHead className="text-right">CRN</TableHead><TableHead className="text-right">Income</TableHead><TableHead className="text-right">Spending</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                      <TableBody>{(fundingQuery.data?.clubs ?? []).map((c) => <TableRow key={c.clubId}><TableCell className="font-medium">{c.clubTitle}</TableCell><TableCell className="text-right">{c.crn}</TableCell><TableCell className="text-right">{c.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell><TableCell className="text-right">{c.totalExpense.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell><TableCell className="text-right font-medium">{c.netBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set <strong>{confirm?.clubTitle}</strong> to <strong>{confirm ? STATUS_LABELS[confirm.newStatus] : ''}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!confirm) return;
              setStatus.mutate({ clubId: confirm.clubId, status: confirm.newStatus });
              setConfirm(null);
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
