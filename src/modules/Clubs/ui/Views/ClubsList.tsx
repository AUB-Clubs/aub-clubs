'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import Link from 'next/link';
import { Users, AlertCircle } from 'lucide-react';
import { useState } from 'react';

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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

type CommitmentLevel = "HIGH" | "MEDIUM" | "LOW";

type CommitmentQueryResult = {
  data?: {
    clubId:          string;
    commitmentLevel: CommitmentLevel;
  } | undefined;
};

const COMMITMENT_ORDER: Record<CommitmentLevel, number> = {
  HIGH:   1,
  MEDIUM: 2,
  LOW:    3,
};

function CommitmentBadge({ clubId }: { clubId: string }) {
  const query = trpc.commitmentLevel.getCommitmentLevel.useQuery({ clubId });

  if (query.isLoading) {
    return <Skeleton className="h-5 w-16" />;
  }

  if (!query.data) {
    return <Badge variant="secondary">N/A</Badge>;
  }

  const level = query.data.commitmentLevel;

  if (level === "HIGH") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">High</Badge>;
  }

  if (level === "MEDIUM") {
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium</Badge>;
  }

  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Low</Badge>;
}

export default function ClubList() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const page        = Number(searchParams.get('page')) || 1;
  const searchParam = searchParams.get('search') || '';
  const limit       = 10;

  const [sortByCommitment, setSortByCommitment] = useState(false);

  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

  const query = trpc.clubs.getClubsList.useQuery({
    page,
    limit,
    search: searchParam,
  }, {
    enabled: !!profile,
  });

  const isLoading  = query.isLoading;
  const error      = query.error;
  const data       = query.data;
  const clubs      = data?.clubs ?? [];
  const totalPages = data?.totalPages ?? 0;

  const commitmentQueries = trpc.useQueries(function (t) {
    if (!clubs) return [];
    return clubs.map(function (club) {
      return t.commitmentLevel.getCommitmentLevel({ clubId: club.id });
    });
  });

  const sortedClubs = [];
  for (const club of clubs) {
    sortedClubs.push(club);
  }

  if (sortByCommitment) {
    sortedClubs.sort(function (a, b) {
      const aLevel = commitmentQueries.find(function (q: CommitmentQueryResult) {
        return q.data?.clubId === a.id;
      })?.data?.commitmentLevel ?? "LOW";

      const bLevel = commitmentQueries.find(function (q: CommitmentQueryResult) {
        return q.data?.clubId === b.id;
      })?.data?.commitmentLevel ?? "LOW";

      return COMMITMENT_ORDER[aLevel] - COMMITMENT_ORDER[bLevel];
    });
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Available Clubs</h1>
          <div className="text-muted-foreground text-sm h-5">
            {searchParam && `Results for "${searchParam}"`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Sort by Commitment:</span>
          <Button
            variant={sortByCommitment ? "default" : "outline"}
            size="sm"
            onClick={function () { setSortByCommitment(true); }}
          >
            High to Low
          </Button>
          <Button
            variant={!sortByCommitment ? "default" : "outline"}
            size="sm"
            onClick={function () { setSortByCommitment(false); }}
          >
            Default
          </Button>
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
                  <TableHead>Commitment</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!profile || isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
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
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-center gap-2">
                          <Skeleton className="h-10 w-24" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : sortedClubs.length > 0 ? (
                  sortedClubs.map(function (club) {
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
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{club._count?.memberships ?? 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <CommitmentBadge clubId={club.id} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button asChild variant="default">
                              <Link href={`/clubs/${club.id}`}>
                                View Club
                              </Link>
                            </Button>
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

          {!isLoading && totalPages > 1 && (
            <CardFooter className="py-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(page - 1)}
                      className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const p = i + 1;
                    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            onClick={() => handlePageChange(p)}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (p === page - 2 || p === page + 2) {
                      return (
                        <PaginationItem key={p}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    return null;
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(page + 1)}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}