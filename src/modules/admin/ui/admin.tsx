'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type ClubStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'INACTIVE';

type Club = {
  id: string;
  title: string;
  crn: number;
  description: string;
  imageUrl: string | null;
  status: string;
  types: string[];
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

export default function ClubVerificationView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const statusParam = (searchParams.get('status') || 'ALL') as ClubStatus | 'ALL';

  const [pageInput, setPageInput] = useState(page.toString());
  const [confirm, setConfirm] = useState<{
    clubId: string;
    clubTitle: string;
    newStatus: ClubStatus;
  } | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.admin.listClubsForReview.useQuery(
    {
      status: statusParam === 'ALL' ? undefined : statusParam,
      page,
      limit: 10,
    },
    {
      placeholderData: keepPreviousData,
    }
  );

  const setStatus = trpc.admin.setClubStatus.useMutation({
    onSuccess: function(updated: { id: string; title: string; status: string }) {
      toast.success(
        `"${updated.title}" marked as ${STATUS_LABELS[updated.status as ClubStatus]}`
      );
      utils.admin.listClubsForReview.invalidate();
    },
    onError: function(err: { message: string }) {
      toast.error(err.message);
    },
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
    if (value === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Club Verification</h1>
              <p className="text-muted-foreground text-sm h-5">
                Review and assign status labels to university clubs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Filter by status:</span>
          <Select value={statusParam} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Filter by status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Clubs</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Club</TableHead>
                  <TableHead>CRN</TableHead>
                  <TableHead className="max-w-[300px]">Description</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map(function(_, i) {
                    return (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map(function(__, j) {
                          return (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                ) : clubs.length > 0 ? (
                  clubs.map(function(club: Club) {
                    return (
                      <TableRow key={club.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-4">
                            <Avatar>
                              <AvatarImage src={club.imageUrl ?? undefined} alt={club.title} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                {club.title.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">{club.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>{club.crn}</TableCell>
                        <TableCell>
                          <p className="line-clamp-2 max-w-md text-muted-foreground">
                            {club.description}
                          </p>
                        </TableCell>
                        <TableCell>{club._count.memberships}</TableCell>
                        <TableCell>
                          <StatusBadge status={club.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {club.status !== 'ACTIVE' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-700 border-green-300 hover:bg-green-50"
                                onClick={function() {
                                  setConfirm({
                                    clubId: club.id,
                                    clubTitle: club.title,
                                    newStatus: 'ACTIVE',
                                  });
                                }}
                              >
                                Mark Active
                              </Button>
                            )}
                            {club.status !== 'INACTIVE' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 border-red-300 hover:bg-red-50"
                                onClick={function() {
                                  setConfirm({
                                    clubId: club.id,
                                    clubTitle: club.title,
                                    newStatus: 'INACTIVE',
                                  });
                                }}
                              >
                                Mark Inactive
                              </Button>
                            )}
                            {club.status !== 'PENDING_REVIEW' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={function() {
                                  setConfirm({
                                    clubId: club.id,
                                    clubTitle: club.title,
                                    newStatus: 'PENDING_REVIEW',
                                  });
                                }}
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No clubs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {totalPages > 1 && (
            <CardFooter className="py-4 flex items-center justify-between border-t text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium">
                Page
                <Input
                  className="h-8 w-14 text-center"
                  value={pageInput}
                  onChange={function(e) {
                    setPageInput(e.target.value);
                  }}
                  onKeyDown={function(e) {
                    if (e.key === 'Enter') {
                      let newPage = parseInt(pageInput);
                      if (isNaN(newPage) || newPage < 1) newPage = 1;
                      if (newPage > totalPages) newPage = totalPages;
                      setPageInput(newPage.toString());
                      handlePageChange(newPage);
                    }
                  }}
                  onBlur={function() {
                    let newPage = parseInt(pageInput);
                    if (isNaN(newPage) || newPage < 1) newPage = 1;
                    if (newPage > totalPages) newPage = totalPages;
                    setPageInput(newPage.toString());
                    if (newPage !== page) handlePageChange(newPage);
                  }}
                />
                of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={function() {
                    handlePageChange(page - 1);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={function() {
                    handlePageChange(page + 1);
                  }}
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}

      <AlertDialog open={!!confirm} onOpenChange={function(open) { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set <strong>{confirm?.clubTitle}</strong> to{' '}
              <strong>{confirm ? STATUS_LABELS[confirm.newStatus] : ''}</strong>? This
              will be visible to all users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={function() {
                if (!confirm) return;
                setStatus.mutate({ clubId: confirm.clubId, status: confirm.newStatus });
                setConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}