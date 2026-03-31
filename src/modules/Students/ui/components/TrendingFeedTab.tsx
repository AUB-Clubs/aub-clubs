'use client'

import { useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { useInView } from 'react-intersection-observer'
import { PostCard } from './PostCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Flame } from 'lucide-react'

// ── Loading Skeleton ───────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-2 p-6 pb-2">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="size-11 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="space-y-2 p-6 pt-0">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="flex items-center justify-between p-6 pt-0">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function TrendingFeedTab() {
  const { ref, inView } = useInView()
  const profileQuery = trpc.profile.get.useQuery(undefined, { staleTime: 5 * 60 * 1000 })

  const trendingQuery = trpc.discover.getTrendingPosts.useInfiniteQuery(
    { limit: 12 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )

  const { data, hasNextPage, fetchNextPage, isLoading, isFetchingNextPage, error } = trendingQuery

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  const posts = data?.pages.flatMap((page) => page.posts) ?? []
  const isEmpty = !isLoading && posts.length === 0

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="border-dashed">
        <Empty className="py-12">
          <EmptyMedia variant="icon">
            <Flame className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Something went wrong</EmptyTitle>
            <EmptyDescription>
              Unable to load trending posts. Please try again later.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  // Empty state
  if (isEmpty) {
    return (
      <Card className="border-dashed">
        <Empty className="py-12">
          <EmptyMedia variant="icon">
            <Flame className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No trending posts right now</EmptyTitle>
            <EmptyDescription>
              Check back soon! Posts become trending when they get lots of engagement from the community.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    )
  }

  // Posts list
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          variant="trending"
          showJoinButton={true}
          currentUserId={profileQuery.data?.id}
        />
      ))}

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={ref} className="flex justify-center py-4">
          {isFetchingNextPage ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading more...
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>
      )}
    </div>
  )
}
