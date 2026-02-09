'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Megaphone, FileText, Users } from 'lucide-react'

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export default function ForYouPage() {
  const [cursor, setCursor] = useState<string | null>(null)

  const feedQuery = trpc.forYou.getFeed.useQuery(
    { limit: 12, cursor: cursor ?? undefined },
    { placeholderData: (prev) => prev }
  )

  const items = feedQuery.data?.items ?? []
  const nextCursor = feedQuery.data?.nextCursor
  const isLoading = feedQuery.isLoading
  const isFetchingMore = feedQuery.isFetching && cursor != null
  const isEmpty = !isLoading && items.length === 0

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Page header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            For You
          </h1>
          <p className="mt-1 text-muted-foreground">
            Announcements and posts from your clubs, in one place.
          </p>
        </header>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-11 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </CardContent>
                <CardFooter className="pt-0">
                  <Skeleton className="h-3 w-20" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state: no clubs or no posts */}
        {isEmpty && (
          <Card className="border-dashed">
            <Empty className="py-12">
              <EmptyMedia variant="icon">
                <Users className="size-8 text-muted-foreground" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Nothing here yet</EmptyTitle>
                <EmptyDescription>
                  Join some clubs to see announcements and posts in your For You feed. Once you’re in a club, new content will show up here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        )}

        {/* Feed list */}
        {!isLoading && items.length > 0 && (
          <ScrollArea className="-mx-2">
            <ul className="space-y-4 pb-4">
              {items.map((item) => {
                if (item.type === 'announcement') {
                  const a = item.data
                  return (
                    <li key={`announcement-${item.id}`}>
                      <Card className="overflow-hidden transition-shadow hover:shadow-md">
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Avatar className="size-11 border-2 border-background shadow-sm">
                              {a.club.image ? (
                                <AvatarImage src={a.club.image} alt={a.club.Title} />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                                {a.club.Title.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">
                                {a.club.Title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                                  <Megaphone className="size-3" />
                                  Announcement
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <h2 className="font-medium text-foreground leading-snug">
                            {a.title}
                          </h2>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {a.content}
                          </p>
                        </CardContent>
                        <CardFooter className="text-xs text-muted-foreground pt-0">
                          {formatRelativeTime(a.created_at)}
                        </CardFooter>
                      </Card>
                    </li>
                  )
                }

                const p = item.data
                return (
                  <li key={`post-${item.id}`}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Avatar className="size-11 border-2 border-background shadow-sm">
                            {p.club.image ? (
                              <AvatarImage src={p.club.image} alt={p.club.Title} />
                            ) : null}
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {p.club.Title.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">
                              {p.club.Title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="gap-1 text-xs font-normal">
                                <FileText className="size-3" />
                                Post by {p.author.first_name} {p.author.last_name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {p.title ? (
                          <h2 className="font-medium text-foreground leading-snug">
                            {p.title}
                          </h2>
                        ) : null}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {p.content}
                        </p>
                      </CardContent>
                      <CardFooter className="text-xs text-muted-foreground pt-0">
                        {formatRelativeTime(p.created_at)}
                      </CardFooter>
                    </Card>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}

        {/* Load more */}
        {nextCursor && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCursor(nextCursor)}
              disabled={isFetchingMore}
              className="min-w-[140px]"
            >
              {isFetchingMore ? (
                <>
                  <span className="animate-pulse">Loading</span>
                  <span className="ml-1.5">…</span>
                </>
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
