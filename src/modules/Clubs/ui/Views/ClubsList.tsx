'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import Link from 'next/link';
import { Users, AlertCircle } from 'lucide-react';

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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

export default function ClubList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get state from URL or defaults
  const page = Number(searchParams.get('page')) || 1;
  const searchParam = searchParams.get('search') || '';
  
  const limit = 10;

  const query = trpc.clubs.getClubsList.useQuery({ 
    page, 
    limit,
    search: searchParam 
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
                {isLoading ? (
                  // Skeleton Rows
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
                      <TableCell className="text-right">
                        <div className="flex justify-center gap-2">
                          <Skeleton className="h-10 w-24" />
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
                            <AvatarImage src={club.image_url ?? undefined} alt={club.title} />
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
                        <div className="flex justify-center gap-2">
                          <Button asChild variant="default">
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
          
          {/* Pagination Footer - show only if we have data or are loading (maybe skeleton here too?) */}
          {/* For now, hiding pagination while hard loading is fine as long as the card doesn't jump */}
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
                    // Show first, last, current, and neighbors
                    if (
                      p === 1 || 
                      p === totalPages || 
                      (p >= page - 1 && p <= page + 1)
                    ) {
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
                    } else if (
                      p === page - 2 || 
                      p === page + 2
                    ) {
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
