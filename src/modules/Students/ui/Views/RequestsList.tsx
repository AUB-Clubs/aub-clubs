'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import Link from 'next/link';
import { AlertCircle, Clock } from 'lucide-react';
import { useState, useEffect } from "react";
import { keepPreviousData } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
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
import { Badge } from '@/components/ui/badge';

function formatRelativeDate(dateString: string | Date) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function RequestsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const limit = 10;

  const [pageInput, setPageInput] = useState(page.toString());

  useEffect(() => {
    setPageInput(page.toString());
  }, [page]);

  const query = trpc.profile.getJoinRequests.useQuery({
    page,
    limit,
  }, {
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });

  const isLoading = query.isLoading;
  const error = query.error;

  const data = query.data;
  const requests = data?.requests ?? [];
  const totalPages = data?.totalPages ?? 0;

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">My Join Requests</h1>
        </div>
        <p className="text-muted-foreground">View the status of your club join requests below.</p>
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
                  <TableHead>Requested On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-10 w-24" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : requests.length > 0 ? (
                  requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={request.club.imageUrl ?? undefined} alt={request.club.title} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                              {request.club.title.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold line-clamp-1">{request.club.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>{request.club.crn}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-sm">{formatRelativeDate(request.joinedAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.status === 'ACCEPTED' ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">Accepted</Badge>
                        ) : request.status === 'PENDING' ? (
                          <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 dark:text-yellow-400">Pending</Badge>
                        ) : request.status === 'REJECTED' ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : (
                          <Badge variant="outline">{request.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/clubs/${request.club.id}`}>
                              View Club
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Clock className="h-8 w-8 text-muted-foreground/50" />
                        <p>You have no join requests.</p>
                        <Button asChild variant="link" className="mt-2 text-primary">
                          <Link href="/clubs">Browse clubs</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {!isLoading && totalPages > 1 && (
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
    </div>
  );
}
