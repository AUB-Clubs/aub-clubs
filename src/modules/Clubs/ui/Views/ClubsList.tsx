'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import Link from 'next/link';
import { Users, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
import { Badge } from '@/components/ui/badge';

// ── Types ───────────────────────────────────────────────────────────

type CommitmentLevel = "HIGH" | "MEDIUM" | "LOW";

type CommitmentQueryResult = {
  data?: {
    clubId: string;
    commitmentLevel: CommitmentLevel;
  } | undefined;
};

const COMMITMENT_ORDER: Record<CommitmentLevel, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const ALL_CLUB_TYPES = [
  "ACADEMIC", "ARTS", "BUSINESS", "CAREER", "CULTURAL", "GAMING", "MEDIA",
  "SPORTS", "SOCIAL", "TECHNOLOGY", "COMMUNITY_SERVICE", "ENVIRONMENTAL",
  "HEALTH_WELLNESS", "RELIGIOUS", "BEGINNER_FRIENDLY", "COMPETITIVE", "NETWORKING",
] as const;

const COMMITMENT_LEVELS: CommitmentLevel[] = ["HIGH", "MEDIUM", "LOW"];

function formatTypeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAnd\b/g, 'and');
}

// ── Commitment Badge ────────────────────────────────────────────────

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

// ── Main Component ──────────────────────────────────────────────────

export default function ClubList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page')) || 1;
  const searchParam = searchParams.get('search') || '';

  // Parse filter params from URL
  const typesParam = searchParams.get('types') || '';
  const commitmentParam = searchParams.get('commitment') || '';

  const selectedTypes: string[] = typesParam ? typesParam.split(',').filter(Boolean) : [];
  const selectedCommitment: CommitmentLevel[] = commitmentParam
    ? (commitmentParam.split(',').filter(c => COMMITMENT_LEVELS.includes(c as CommitmentLevel)) as CommitmentLevel[])
    : [];

  const [pageInput, setPageInput] = useState(page.toString());

  useEffect(() => {
    setPageInput(page.toString());
  }, [page]);

  const limit = 10;
  const sortParam = searchParams.get('sort') || 'name-az';
  const [showTypeFilter, setShowTypeFilter] = useState(selectedTypes.length > 0);
  const [showCommitmentFilter, setShowCommitmentFilter] = useState(selectedCommitment.length > 0);

  // Prioritize profile fetch
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

  const query = trpc.clubs.getClubsList.useQuery({
    page,
    limit,
    search: searchParam || undefined,
    types: selectedTypes.length > 0 ? selectedTypes as typeof ALL_CLUB_TYPES[number][] : undefined,
    commitmentLevel: selectedCommitment.length > 0 ? selectedCommitment : undefined,
    sort: sortParam as "name-az" | "name-za" | "members-desc" | "members-asc" | "commitment-hl" | "commitment-lh",
  }, {
    enabled: !!profile,
    refetchInterval: 5000,
    placeholderData: keepPreviousData,
  });

  const utils = trpc.useUtils();

  const [confirmClubId, setConfirmClubId] = useState<string | null>(null);

  const requestJoin = trpc.clubs.requestJoin.useMutation({
    onSuccess: async () => {
      await utils.clubs.getClubsList.invalidate({ page, limit, search: searchParam || undefined });
    },
  });

  const isLoading = query.isLoading;
  const error = query.error;
  const data = query.data;
  const clubs = data?.clubs ?? [];
  const totalPages = data?.totalPages ?? 0;

  // Commitment queries for client-side sorting
  const commitmentQueries = trpc.useQueries(function (t) {
    if (!clubs) return [];
    return clubs.map(function (club) {
      return t.commitmentLevel.getCommitmentLevel({ clubId: club.id });
    });
  });

  const sortedClubs = [...clubs];

  // Only commitment sorting is done client-side (it's a computed value, not in DB)
  if (sortParam === 'commitment-hl') {
    sortedClubs.sort((a, b) => {
      const aLevel = commitmentQueries.find((q: CommitmentQueryResult) => q.data?.clubId === a.id)?.data?.commitmentLevel ?? 'LOW';
      const bLevel = commitmentQueries.find((q: CommitmentQueryResult) => q.data?.clubId === b.id)?.data?.commitmentLevel ?? 'LOW';
      return COMMITMENT_ORDER[aLevel] - COMMITMENT_ORDER[bLevel];
    });
  } else if (sortParam === 'commitment-lh') {
    sortedClubs.sort((a, b) => {
      const aLevel = commitmentQueries.find((q: CommitmentQueryResult) => q.data?.clubId === a.id)?.data?.commitmentLevel ?? 'LOW';
      const bLevel = commitmentQueries.find((q: CommitmentQueryResult) => q.data?.clubId === b.id)?.data?.commitmentLevel ?? 'LOW';
      return COMMITMENT_ORDER[bLevel] - COMMITMENT_ORDER[aLevel];
    });
  }

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set('page', newPage.toString());
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  // ── Filter helpers ──────────────────────────────────────────────

  const updateFilters = (newTypes: string[], newCommitment: CommitmentLevel[]) => {
    const params = new URLSearchParams(searchParams);
    params.delete('page'); // Reset pagination on filter change
    if (newTypes.length > 0) {
      params.set('types', newTypes.join(','));
    } else {
      params.delete('types');
    }
    if (newCommitment.length > 0) {
      params.set('commitment', newCommitment.join(','));
    } else {
      params.delete('commitment');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleType = (type: string) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    updateFilters(next, selectedCommitment);
  };

  const toggleCommitment = (level: CommitmentLevel) => {
    const next = selectedCommitment.includes(level)
      ? selectedCommitment.filter(l => l !== level)
      : [...selectedCommitment, level];
    updateFilters(selectedTypes, next);
  };

  const clearAllFilters = () => {
    updateFilters([], []);
    setShowTypeFilter(false);
    setShowCommitmentFilter(false);
  };

  const hasActiveFilters = selectedTypes.length > 0 || selectedCommitment.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Available Clubs</h1>
            <div className="text-muted-foreground text-sm h-5">
              {searchParam && `Results for "${searchParam}"`}
              {hasActiveFilters && ` • Filtered`}
            </div>
          </div>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sortParam} onValueChange={(value) => {
            const params = new URLSearchParams(searchParams);
            params.set('sort', value);
            params.delete('page');
            router.push(`${pathname}?${params.toString()}`);
          }}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-az">Name A → Z</SelectItem>
              <SelectItem value="name-za">Name Z → A</SelectItem>
              <SelectItem value="commitment-hl">Commitment High → Low</SelectItem>
              <SelectItem value="commitment-lh">Commitment Low → High</SelectItem>
              <SelectItem value="members-desc">Most Members</SelectItem>
              <SelectItem value="members-asc">Fewest Members</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-border mx-1" />

          <span className="text-sm text-muted-foreground font-medium">Filter:</span>
          <Button
            variant={showTypeFilter ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTypeFilter(!showTypeFilter)}
          >
            Type {selectedTypes.length > 0 && `(${selectedTypes.length})`}
          </Button>
          <Button
            variant={showCommitmentFilter ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCommitmentFilter(!showCommitmentFilter)}
          >
            Commitment {selectedCommitment.length > 0 && `(${selectedCommitment.length})`}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-destructive hover:text-destructive">
              Clear all
            </Button>
          )}
        </div>

        {/* Type Filter Chips */}
        {showTypeFilter && (
          <div className="flex flex-wrap gap-1.5">
            {ALL_CLUB_TYPES.map(type => (
              <Badge
                key={type}
                variant={selectedTypes.includes(type) ? "default" : "outline"}
                className="cursor-pointer select-none transition-colors"
                onClick={() => toggleType(type)}
              >
                {formatTypeLabel(type)}
              </Badge>
            ))}
          </div>
        )}

        {/* Commitment Filter Chips */}
        {showCommitmentFilter && (
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={selectedCommitment.includes("HIGH") ? "default" : "outline"}
              className="cursor-pointer select-none bg-green-100 text-green-800 hover:bg-green-200 border-green-300"
              onClick={() => toggleCommitment("HIGH")}
            >
              {selectedCommitment.includes("HIGH") ? "✓ " : ""}High (0-10 days)
            </Badge>
            <Badge
              variant={selectedCommitment.includes("MEDIUM") ? "default" : "outline"}
              className="cursor-pointer select-none bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300"
              onClick={() => toggleCommitment("MEDIUM")}
            >
              {selectedCommitment.includes("MEDIUM") ? "✓ " : ""}Medium (10-30 days)
            </Badge>
            <Badge
              variant={selectedCommitment.includes("LOW") ? "default" : "outline"}
              className="cursor-pointer select-none bg-red-100 text-red-800 hover:bg-red-200 border-red-300"
              onClick={() => toggleCommitment("LOW")}
            >
              {selectedCommitment.includes("LOW") ? "✓ " : ""}Low (30+ days)
            </Badge>
          </div>
        )}
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
                  <TableHead>Type</TableHead>
                  <TableHead className="max-w-[300px]">Description</TableHead>
                  <TableHead>Commitment</TableHead>
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
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
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
                ) : sortedClubs.length > 0 ? (
                  sortedClubs.map((club) => (
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
                        <div className="flex flex-wrap gap-1">
                          {(club.types as string[])?.map((t: string) => (
                            <Badge key={t} variant="outline" className="text-xs">
                              {formatTypeLabel(t)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 max-w-md text-muted-foreground">
                          {club.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <CommitmentBadge clubId={club.id} />
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
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No clubs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>

          {/* Pagination Footer */}
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