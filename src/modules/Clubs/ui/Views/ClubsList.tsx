'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import Link from 'next/link';
import { Users, AlertCircle } from 'lucide-react';

import { useState, useEffect } from "react";
import { keepPreviousData } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function ClubList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get state from URL or defaults
  const page = Number(searchParams.get('page')) || 1;
  const searchParam = searchParams.get('search') || '';

  const [pageInput, setPageInput] = useState(page.toString());

  useEffect(() => {
    setPageInput(page.toString());
  }, [page]);

  const limit = 10;

  // Prioritize profile fetch (usually already started by Sidebar)
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  })

  const query = trpc.clubs.getClubsList.useQuery({
    page,
    limit,
    search: searchParam
  }, {
    enabled: !!profile, // Wait for profile
    refetchInterval: 5000, // Poll every 5 seconds
    placeholderData: keepPreviousData,
  });
  const utils = trpc.useUtils();

  const [confirmClubId, setConfirmClubId] = useState<string | null>(null);

  const requestJoin = trpc.clubs.requestJoin.useMutation({
    onSuccess: async () => {
      await utils.clubs.getClubsList.invalidate({ page, limit, search: searchParam });
    },
  });

  const isLoading = query.isLoading;
  const error = query.error;

  const data = query.data;
  const clubs = data?.clubs ?? [];
  const totalPages = data?.totalPages ?? 0;

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      router.push(`${pathname}?${params.toString()}`);
    }
  };



  /* 
   * Unified Loading/Error/Data View
   * To prevent full page flashes on refetch, we keep the layout stable
   * and only swap the TableBody content.
   */
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Available Clubs</h1>
          <div className="text-muted-foreground text-sm h-5">
            {searchParam && `Results for "${searchParam}"`}
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
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
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!profile || isLoading ? (
                  // Skeleton Rows
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Skeleton className="h-4 w-4" />
                          <Skeleton className="h-4 w-8" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-center gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : clubs && clubs.length > 0 ? (
                  // Data Rows
                  clubs.map((club) => (
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
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{club.memberCount ?? club._count?.memberships ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          {(() => {
                            const status = club.myStatus as null | "PENDING" | "ACCEPTED" | "REJECTED";
                            if (status === "PENDING") {
                              return (
                                <Button size="sm" variant="secondary" disabled className="w-20">
                                  Pending
                                </Button>
                              );
                            }
                            if (status !== "ACCEPTED") {
                              return (
                                <Button
                                  size="sm"
                                  className="w-20"
                                  disabled={requestJoin.isPending}
                                  onClick={() => setConfirmClubId(club.id)}
                                >
                                  Join
                                </Button>
                              );
                            }
                            return null;
                          })()}
                          <Button asChild variant="default" size="sm">
                            <Link href={`/clubs/${club.id}`}>
                              View Club
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  // Empty State
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No clubs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {/* Pagination Footer - show only if we have data or are loading */}
          {totalPages > 1 && (
            <CardFooter className="py-4 flex items-center justify-between border-t text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium">
                Page
                <Input
                  className="h-8 w-14 text-center"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      let newPage = parseInt(pageInput);
                      if (isNaN(newPage) || newPage < 1) newPage = 1;
                      if (newPage > totalPages) newPage = totalPages;
                      setPageInput(newPage.toString());
                      handlePageChange(newPage);
                    }
                  }}
                  onBlur={() => {
                    let newPage = parseInt(pageInput);
                    if (isNaN(newPage) || newPage < 1) newPage = 1;
                    if (newPage > totalPages) newPage = totalPages;
                    setPageInput(newPage.toString());
                    if (newPage !== page) {
                      handlePageChange(newPage);
                    }
                  }}
                />
                of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}
      <AlertDialog open={!!confirmClubId} onOpenChange={(open) => !open && setConfirmClubId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Join this club?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to join this club? Your request will be sent for approval.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmClubId) return;
                requestJoin.mutate({ clubId: confirmClubId });
                setConfirmClubId(null);
              }}
            >
              Yes, send request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
