'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/client';
import Link from 'next/link';
import { Users, AlertCircle, Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';

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
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
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
  
  // Local state for input to allow typing without delay, but sync with URL
  const [searchTerm, setSearchTerm] = useState(searchParam);
  // Debounce the search term to avoid excessive URL updates/API calls
  const [debouncedSearch] = useDebounce(searchTerm, 500);

  const limit = 10;

  // Sync valid search param back to input if URL changes externally (e.g. back button)
  useEffect(() => {
    setSearchTerm(searchParam);
  }, [searchParam]);

  // Update URL when debounced search term changes
  useEffect(() => {
    // Only update if the value is different from what's potentially already in the URL
    // to avoid loops or redundant pushes.
    if (debouncedSearch !== searchParam) {
      const params = new URLSearchParams(searchParams);
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      } else {
        params.delete('search');
      }
      params.set('page', '1'); // Reset to page 1 on new search
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [debouncedSearch, pathname, router, searchParams, searchParam]);


  const query = trpc.clubs.getClubsList.useQuery({ 
    page, 
    limit,
    search: searchParam // pass the URL param (which is "committed") to the query
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


  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
        <span className="sr-only">Loading clubs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-600" style={{ fontFamily: 'Castellar, serif' }}>
            All Clubs
          </h1>
          <p className="text-blue-500 mt-2" style={{ fontFamily: 'Castellar, serif' }}>
            Browse and join clubs that interest you!
          </p>
        </div>
        
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clubs..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Club</TableHead>
                <TableHead>CRN</TableHead>
                <TableHead className="max-w-[300px]">Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clubs && clubs.length > 0 ? (
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="default" className="bg-green-600 hover:bg-green-700">
                          Join
                        </Button>
                        <Button asChild variant="default" className="bg-blue-600 hover:bg-blue-700">
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
                  <TableCell colSpan={5} className="h-24 text-center">
                    No clubs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
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
    </div>
  );
}
