
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'

export function ClubSearchBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={`relative sm:w-[300px] md:w-[400px] ${className}`}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Skeleton className="h-10 w-full rounded-full bg-muted" />
    </div>
  )
}

/** Shared skeleton row used by both Suspense fallback and client-side loading */
function SkeletonRow() {
  return (
    <TableRow>
      {/* Club — avatar + name */}
      <TableCell>
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
      </TableCell>
      {/* CRN */}
      <TableCell>
        <Skeleton className="h-4 w-10" />
      </TableCell>
      {/* Type badges */}
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-[22px] w-20 rounded-full" />
        </div>
      </TableCell>
      {/* Description */}
      <TableCell>
        <Skeleton className="h-4 w-full max-w-md" />
      </TableCell>
      {/* Commitment */}
      <TableCell>
        <Skeleton className="h-[22px] w-16 rounded-full" />
      </TableCell>
      {/* Members */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-5" />
        </div>
      </TableCell>
      {/* Actions */}
      <TableCell>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-8 w-[84px] rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ClubListSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Available Clubs</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-[200px] rounded-md" />
          <div className="w-px h-6 bg-border mx-1" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

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
                <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export { SkeletonRow as ClubListSkeletonRow }

export function ClubOverviewSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-muted">
            <Skeleton className="h-full w-full bg-primary/10" />
          </div>
          <div className="relative -mt-12 px-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-1 items-end gap-6">
                <div className="relative">
                  <Skeleton className="size-32 rounded-2xl border-4 border-background bg-muted shadow-sm" />
                </div>
                <div className="mb-4 space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
