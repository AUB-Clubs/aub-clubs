'use client'

import { useState, useEffect } from 'react'
import { trpc } from '@/trpc/client'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useInView } from 'react-intersection-observer'
import {
  Card,

  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CalendarDays, FileText, Megaphone, Pencil, ThumbsUp, Users, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatRelativeTime(date: Date | string): string {
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
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

const roleLabels: Record<string, string> = {
  PRESIDENT: 'President',
  VICE_PRESIDENT: 'Vice President',
  MEMBER: 'Member',
}

interface ClubMember {
  id: string
  userId: string
  role: string
  joinedAt: string
  firstName: string
  lastName: string
  email: string
}

interface ClubAnnouncement {
  id: string
  title: string
  content: string
  createdAt: string
  author: string
  authorId: string
  imageUrls: string[]
  upvoteCount: number
  isUpvoted: boolean
}

interface ClubForumPost {
  id: string
  type: string
  title: string
  content?: string
  author: string
  authorId: string
  role: string
  upvoteCount: number
  imageUrls: string[]
  createdAt: string
  isUpvoted: boolean
}

export interface ClubOverviewProps {
  clubId?: string
}

export default function ClubOverview({ clubId }: ClubOverviewProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = searchParams.get('tab') || 'about'

  const setActiveTab = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', val)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const { ref: announcementsRef, inView: announcementsInView } = useInView()
  const { ref: forumRef, inView: forumInView } = useInView()

  const overview = trpc.clubs.getOverview.useQuery(
    { clubId: clubId! },
    { enabled: !!clubId }
  )

  // Wait for overview to load before fetching heavy data
  // This prevents one giant batched request that blocks the initial UI paint
  const isOverviewLoaded = !!overview.data;

  const statsQuery = trpc.clubs.getStats.useQuery(
    { clubId: clubId! },
    { enabled: !!clubId && isOverviewLoaded, refetchInterval: 5000 }
  )

  const membershipQuery = trpc.clubs.getMembership.useQuery(
    { clubId: clubId! },
    { enabled: !!clubId && isOverviewLoaded, refetchInterval: 5000 }
  )

  // Wait for stats to load before fetching heavy data lists
  // This ensures the stats (small query) returns quickly and isn't batched with the heavy lists
  const isStatsLoaded = !!statsQuery.data;

  const membersQuery = trpc.clubs.getMembers.useQuery(
    { clubId: clubId! },
    { enabled: !!clubId && isStatsLoaded, refetchInterval: 5000 }
  )
  const announcementsQuery = trpc.clubs.getAnnouncements.useInfiniteQuery(
    { clubId: clubId!, limit: 5 },
    { 
      enabled: !!clubId && isStatsLoaded,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 5000,
    }
  )
  const forumPostsQuery = trpc.clubs.getForumPosts.useInfiniteQuery(
    { clubId: clubId!, limit: 5 },
    { 
      enabled: !!clubId && isStatsLoaded,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 5000,
    }
  )

  useEffect(() => {
    if (announcementsInView && announcementsQuery.hasNextPage) {
      announcementsQuery.fetchNextPage()
    }
  }, [announcementsInView, announcementsQuery.hasNextPage])

  useEffect(() => {
    if (forumInView && forumPostsQuery.hasNextPage) {
      forumPostsQuery.fetchNextPage()
    }
  }, [forumInView, forumPostsQuery.hasNextPage])

  const utils = trpc.useUtils()
  const createPostMutation = trpc.clubs.createPost.useMutation({
    onSuccess: () => {
      if (!clubId) return
      utils.clubs.getForumPosts.invalidate({ clubId })
      utils.clubs.getAnnouncements.invalidate({ clubId })
      setPostDialogOpen(false)
      setPostForm({ title: '', content: '', type: 'GENERAL' })
    },
  })

  const toggleUpvoteMutation = trpc.clubs.toggleUpvote.useMutation({
    onMutate: async ({ postId }) => {
      if (!clubId) return

      await utils.clubs.getAnnouncements.cancel()
      await utils.clubs.getForumPosts.cancel()

      const previousAnnouncements = utils.clubs.getAnnouncements.getInfiniteData({ clubId, limit: 5 })
      const previousForumPosts = utils.clubs.getForumPosts.getInfiniteData({ clubId, limit: 5 })

      const updatePostInPage = (page: any) => ({
        ...page,
        items: page.items.map((post: any) => {
          if (post.id === postId) {
            return {
              ...post,
              isUpvoted: !post.isUpvoted,
              upvoteCount: post.isUpvoted ? post.upvoteCount - 1 : post.upvoteCount + 1,
            }
          }
          return post
        }),
      })

      utils.clubs.getAnnouncements.setInfiniteData({ clubId, limit: 5 }, (old) => {
        if (!old) return old
        return { ...old, pages: old.pages.map(updatePostInPage) }
      })

      utils.clubs.getForumPosts.setInfiniteData({ clubId, limit: 5 }, (old) => {
        if (!old) return old
        return { ...old, pages: old.pages.map(updatePostInPage) }
      })

      return { previousAnnouncements, previousForumPosts }
    },
    onError: (err, variables, context) => {
      if (!clubId) return
      if (context?.previousAnnouncements) {
        utils.clubs.getAnnouncements.setInfiniteData(
          { clubId, limit: 5 },
          context.previousAnnouncements
        )
      }
      if (context?.previousForumPosts) {
        utils.clubs.getForumPosts.setInfiniteData(
          { clubId, limit: 5 },
          context.previousForumPosts
        )
      }
    },
    onSettled: () => {
      if (!clubId) return
      utils.clubs.getAnnouncements.invalidate({ clubId })
      utils.clubs.getForumPosts.invalidate({ clubId })
    },
  })

  const handleUpvote = (e: React.MouseEvent, postId: string) => {
    e.preventDefault()
    e.stopPropagation()
    toggleUpvoteMutation.mutate({ postId })
  }

  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [postForm, setPostForm] = useState({
    title: '',
    content: '',
    type: 'GENERAL' as 'GENERAL' | 'ANNOUNCEMENT',
  })


  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clubId || !postForm.title.trim() || !postForm.content.trim()) return
    createPostMutation.mutate({
      clubId,
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      type: postForm.type,
    })
  }

  const isLoading = overview.isLoading
  const isStatsLoading = statsQuery.isLoading
  const isMembershipLoading = membershipQuery.isLoading

  const error = overview.error?.message
  const club = overview.data?.club
  const stats = statsQuery.data
  const role = membershipQuery.data?.role
  const canPostAnnouncement =
    role === 'PRESIDENT' || role === 'VICE_PRESIDENT'
  const members = membersQuery.data ?? []
  
  const announcements = announcementsQuery.data?.pages.flatMap(page => page.items) ?? []
  const forumPosts = forumPostsQuery.data?.pages.flatMap(page => page.items) ?? []

  if (!clubId) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-dashed">
          <Empty className="py-12">
            <EmptyMedia variant="icon">
              <Users className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Select a club</EmptyTitle>
              <EmptyDescription>
                Open a club from the list to view its page.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      </div>
    )
  }

  if (error || (!isLoading && !club)) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Cannot view this club</CardTitle>
            <CardDescription>
              {error ?? 'Club not found.'} You may need to join this club first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/">Back to clubs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-muted">
            {isLoading ? (
              <Skeleton className="h-full w-full bg-primary/10" />
            ) : club?.bannerUrl ? (
              <Image
                src={club.bannerUrl}
                alt=""
                width={1200}
                height={160}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-muted to-muted/80" />
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between -mt-12 relative z-10 px-2 sm:px-0">
            <div className="flex items-end gap-4">
              {isLoading ? (
                <Skeleton className="size-20 rounded-xl border-4 border-background shadow-lg bg-sidebar animate-pulse" />
              ) : (
                <Avatar
                  className="size-20 rounded-xl border-4 border-background shadow-lg"
                >
                  {club?.imageUrl ? (
                    <AvatarImage src={club.imageUrl} alt={club.title} />
                  ) : null}
                  <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-2xl font-semibold">
                    {club?.title?.slice(0, 2).toUpperCase() ?? '?'}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="pb-1 space-y-2">
                {isLoading ? (
                  <Skeleton className="h-8 w-56 sm:h-9 sm:w-80 border-4 border-background/50 shadow-sm" />
                ) : (
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {club?.title}
                  </h1>
                )}
                
                {isLoading || isStatsLoading ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats?.members ?? 0} member{(stats?.members ?? 0) !== 1 ? 's' : ''}
                    {stats && stats.postsThisWeek > 0
                      ? ` · ${stats.postsThisWeek} posts this week`
                      : ''}
                  </p>
                )}
              </div>
            </div>
            
            {isLoading || isMembershipLoading ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : role ? (
              <Badge variant="secondary" className="w-fit text-sm font-medium">
                {roleLabels[role] ?? role}
              </Badge>
            ) : (
              <Badge variant="outline" className="w-fit text-sm font-medium text-muted-foreground">
                Not a member
              </Badge>
            )}
          </div>
        </header>

        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="w-full"
        >
          <TabsList className="mb-6 w-full flex flex-wrap h-auto gap-1 bg-muted p-1">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="forum">Forum</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="mt-0">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle>About</CardTitle>
                <CardDescription>What this club is about.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <Skeleton className="h-4 w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {club?.description || 'No description yet.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-0">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {membersQuery.isLoading || !isStatsLoaded ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                      >
                        <Skeleton className="size-11 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : members.length === 0 ? (
                  <Empty className="py-8">
                    <EmptyMedia variant="icon">
                      <Users className="size-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>No members yet</EmptyTitle>
                      <EmptyDescription>
                        Members will appear here once they join.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ScrollArea className="-mx-2">
                    <ul className="space-y-3 pb-4">
                      {members.map((member: ClubMember) => (
                        <li
                          key={member.id}
                          className="flex items-center gap-3 rounded-xl border border-muted bg-muted/20 px-3 py-2"
                        >
                          <Avatar className="size-11 border-2 border-background shadow-sm">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {getInitials(member.firstName, member.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              Joined {formatRelativeTime(member.joinedAt)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-primary/40 bg-primary/5 text-xs font-medium uppercase tracking-wide"
                          >
                            {roleLabels[member.role] ?? member.role}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="announcements" className="mt-0">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle>Announcements</CardTitle>
                <CardDescription>Official club announcements.</CardDescription>
              </CardHeader>
              <CardContent>
                {announcementsQuery.isLoading || !isStatsLoaded ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <Card key={i} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Skeleton className="h-3 w-32" />
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : announcements.length === 0 ? (
                  <Empty className="py-8">
                    <EmptyMedia variant="icon">
                      <Megaphone className="size-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>No announcements</EmptyTitle>
                      <EmptyDescription>
                        Announcements from the club will show here.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ScrollArea className="-mx-2">
                    <ul className="space-y-4 pb-4">
                      {announcements.map((announcement: ClubAnnouncement) => (
                        <li key={announcement.id}>
                          <Card className="overflow-hidden transition-shadow hover:shadow-md">
                            <CardHeader className="pb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-xs font-normal"
                                >
                                  <Megaphone className="size-3" />
                                  Announcement
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <h2 className="text-sm font-semibold leading-none text-foreground">
                                {announcement.title}
                              </h2>
                              <p className="whitespace-pre-wrap text-xs leading-snug text-muted-foreground">
                                {announcement.content}
                              </p>
                              {announcement.imageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {announcement.imageUrls.map((url, i) => (
                                    <div
                                      key={i}
                                      className="relative h-24 w-24 overflow-hidden rounded-md bg-muted"
                                    >
                                      <Image
                                        src={url}
                                        alt=""
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                            <CardFooter className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
                              <span>{formatRelativeTime(announcement.createdAt)}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 gap-1.5 px-2 text-muted-foreground hover:bg-transparent hover:text-red-500",
                                  announcement.isUpvoted && "text-red-500"
                                )}
                                onClick={(e) => handleUpvote(e, announcement.id)}
                              >
                                <Heart
                                  className={cn(
                                    "size-4 transition-all",
                                    announcement.isUpvoted && "fill-current scale-110"
                                  )}
                                />
                                <span>{announcement.upvoteCount}</span>
                              </Button>
                            </CardFooter>
                          </Card>
                        </li>
                      ))}
                      {announcementsQuery.hasNextPage && (
                        <li ref={announcementsRef} className="flex justify-center p-4">
                          {announcementsQuery.isFetchingNextPage ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Loading more...
                            </div>
                          ) : (
                            <div className="h-4" />
                          )}
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forum" className="mt-0">
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Forum</CardTitle>
                    <CardDescription>Discussions and posts.</CardDescription>
                  </div>
                  {!isLoading && club && role && (
                    <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5">
                          <Pencil className="size-4" />
                          New post
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>New post</DialogTitle>
                          <DialogDescription>
                            Share a discussion or, if you’re a club leader, post an announcement.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreatePost} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="post-title">Title</Label>
                            <Input
                              id="post-title"
                              placeholder="Post title"
                              value={postForm.title}
                              onChange={(e) =>
                                setPostForm((prev) => ({ ...prev, title: e.target.value }))
                              }
                              maxLength={500}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="post-content">Content</Label>
                            <Textarea
                              id="post-content"
                              placeholder="What’s on your mind?"
                              value={postForm.content}
                              onChange={(e) =>
                                setPostForm((prev) => ({ ...prev, content: e.target.value }))
                              }
                              rows={4}
                              maxLength={10000}
                              required
                            />
                          </div>
                          {canPostAnnouncement && (
                            <div className="space-y-2">
                              <Label>Post type</Label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="post-type"
                                    checked={postForm.type === 'GENERAL'}
                                    onChange={() =>
                                      setPostForm((prev) => ({ ...prev, type: 'GENERAL' }))
                                    }
                                    className="rounded-full border-input"
                                  />
                                  <span className="text-sm">Discussion</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="post-type"
                                    checked={postForm.type === 'ANNOUNCEMENT'}
                                    onChange={() =>
                                      setPostForm((prev) => ({ ...prev, type: 'ANNOUNCEMENT' }))
                                    }
                                    className="rounded-full border-input"
                                  />
                                  <span className="text-sm">Announcement</span>
                                </label>
                              </div>
                            </div>
                          )}
                          <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setPostDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={
                                createPostMutation.isPending ||
                                !postForm.title.trim() ||
                                !postForm.content.trim()
                              }
                            >
                              {createPostMutation.isPending ? 'Posting…' : 'Post'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {forumPostsQuery.isLoading || !isStatsLoaded ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Skeleton className="h-3 w-32" />
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                ) : forumPosts.length === 0 ? (
                  <Empty className="py-8">
                    <EmptyMedia variant="icon">
                      <FileText className="size-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>No posts yet</EmptyTitle>
                      <EmptyDescription>
                        Start a discussion in the forum.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ScrollArea className="-mx-2">
                    <ul className="space-y-4 pb-4">
                      {forumPosts.map((post: ClubForumPost) => (
                        <li key={post.id}>
                          <Card className="overflow-hidden transition-shadow hover:shadow-md">
                            <CardHeader className="pb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={post.type === 'announcement' ? 'secondary' : 'outline'}
                                  className="gap-1 text-xs font-normal"
                                >
                                  <FileText className="size-3" />
                                  {post.type === 'announcement'
                                    ? 'Announcement'
                                    : `Post by ${post.author}`}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {post.title ? (
                                <h2 className="text-sm font-semibold leading-none text-foreground">
                                  {post.title}
                                </h2>
                              ) : null}
                              {post.content ? (
                              <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-snug text-muted-foreground">
                                  {post.content}
                                </p>
                              ) : null}
                              {post.imageUrls && post.imageUrls.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {post.imageUrls.map((url, i) => (
                                    <div
                                      key={i}
                                      className="relative h-24 w-24 overflow-hidden rounded-md bg-muted"
                                    >
                                      <Image
                                        src={url}
                                        alt=""
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                            <CardFooter className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
                              <span>
                                {formatRelativeTime(post.createdAt)} · {roleLabels[post.role] ?? post.role}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-8 gap-1.5 px-2 text-muted-foreground hover:bg-transparent hover:text-red-500",
                                  post.isUpvoted && "text-red-500"
                                )}
                                onClick={(e) => handleUpvote(e, post.id)}
                              >
                                <Heart
                                  className={cn(
                                    "size-4 transition-all",
                                    post.isUpvoted && "fill-current scale-110"
                                  )}
                                />
                                <span>{post.upvoteCount}</span>
                              </Button>
                            </CardFooter>
                          </Card>
                        </li>
                      ))}
                      {forumPostsQuery.hasNextPage && (
                        <li ref={forumRef} className="flex justify-center p-4">
                          {forumPostsQuery.isFetchingNextPage ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Loading more...
                            </div>
                          ) : (
                            <div className="h-4" />
                          )}
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-0">
            <Card className="overflow-hidden transition-shadow hover:shadow-md border-dashed">
              <Empty className="py-12">
                <EmptyMedia variant="icon">
                  <CalendarDays className="size-8 text-muted-foreground" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No events yet</EmptyTitle>
                  <EmptyDescription>
                    When the club schedules events, they will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
