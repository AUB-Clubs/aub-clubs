'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import { formatDistanceToNow } from 'date-fns';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { AlertCircle, Newspaper } from 'lucide-react';

type Announcement = {
  id:        string;
  title:     string;
  content:   string;
  createdAt: Date;
  club: {
    id:       string;
    title:    string;
    imageUrl: string | null;
  };
};

export default function ForumView() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const page  = Number(searchParams.get('page')) || 1;
  const limit = 10;

  const { data, isLoading, error } = trpc.forum.getAnnouncements.useQuery({
    page,
    limit,
  });

  const announcements = data?.announcements ?? [];
  const totalPages    = data?.totalPages    ?? 0;

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Newspaper className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">University Forum</h1>
        </div>
        <p className="text-muted-foreground">
          Official announcements from all AUB clubs in one place.
        </p>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map(function (_, i) {
            return (
              <Card key={i}>
                <CardContent className="py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                  <Skeleton className="h-5 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && announcements.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Newspaper className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-lg">No announcements yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Check back later for updates from AUB clubs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Announcement cards */}
      {!isLoading && announcements.length > 0 && (
        <div className="space-y-4">
          {announcements.map(function (post: Announcement) {
            return (
              <Card key={post.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-5">

                  {/* Club info row */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={post.club.imageUrl ?? undefined}
                        alt={post.club.title}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                        {post.club.title.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-muted-foreground">
                      {post.club.title}
                    </span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </Badge>
                  </div>

                  {/* Post content */}
                  <h2 className="font-semibold text-base mb-1">{post.title}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.content}
                  </p>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="mt-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(page - 1)}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }).map(function (_, i) {
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
                }
                if (p === page - 2 || p === page + 2) {
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
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

    </div>
  );
}