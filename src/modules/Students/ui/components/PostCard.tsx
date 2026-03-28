'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Megaphone, FileText, Heart, Flame, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';

// ── Types ──────────────────────────────────────────────────────────

type PostType = 'ANNOUNCEMENT' | 'GENERAL';
type Priority = 'URGENT' | 'IMPORTANT' | 'GENERAL';

interface PostData {
  id: string;
  title: string;
  content: string;
  type: PostType;
  priority?: Priority;
  createdAt: Date;
  club: {
    id: string;
    title: string;
    imageUrl?: string | null;
  };
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  _count: {
    upvotes: number;
  };
  upvotes: Array<{ id: string }>;
}

interface PostCardProps {
  post: PostData;
  variant?: 'default' | 'discover' | 'trending';
  showJoinButton?: boolean;
  onJoin?: (clubId: string) => void;
}

// ── Helper Functions ───────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getClubInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// ── Upvote Button Component ────────────────────────────────────────

function UpvoteButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);

  const toggleMutation = trpc.clubs.toggleUpvote.useMutation({
    onMutate: async () => {
      setLiked((prev) => !prev);
      setCount((prev) => prev + (liked ? -1 : 1));
    },
    onError: () => {
      setLiked(initialLiked);
      setCount(initialCount);
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 gap-1.5 px-2 text-muted-foreground hover:bg-transparent hover:text-red-500',
        liked && 'text-red-500'
      )}
      onClick={(e) => {
        e.stopPropagation();
        toggleMutation.mutate({ postId });
      }}
    >
      <Heart className={cn('size-4 transition-all', liked && 'fill-current scale-110')} />
      <span>{count}</span>
    </Button>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function PostCard({ post, variant = 'default', showJoinButton = false, onJoin }: PostCardProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  const requestJoinMutation = trpc.clubs.requestJoin.useMutation({
    onMutate: () => {
      setIsJoining(true);
    },
    onSuccess: () => {
      setHasJoined(true);
      if (onJoin) onJoin(post.club.id);
    },
    onSettled: () => {
      setIsJoining(false);
    },
  });

  const handleJoinClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasJoined && !isJoining) {
      requestJoinMutation.mutate({ clubId: post.club.id });
    }
  };

  const isAnnouncement = post.type === 'ANNOUNCEMENT';
  const upvoteCount = post._count.upvotes;
  const hasUpvoted = post.upvotes.length > 0;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/clubs/${post.club.id}`}
            className="group flex flex-wrap items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0"
          >
            <Avatar className="size-11 border-2 border-background shadow-sm flex-shrink-0">
              {post.club.imageUrl ? (
                <AvatarImage src={post.club.imageUrl} alt={post.club.title} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getClubInitials(post.club.title)}
              </AvatarFallback>
            </Avatar>
            
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate group-hover:underline decoration-primary/50 underline-offset-4">
                {post.club.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {isAnnouncement ? (
                  <Badge
                    variant={
                      post.priority === 'URGENT'
                        ? 'destructive'
                        : post.priority === 'IMPORTANT'
                        ? 'default'
                        : 'secondary'
                    }
                    className="gap-1 text-xs font-normal"
                  >
                    <Megaphone className="size-3" />
                    {post.priority === 'URGENT'
                      ? 'Urgent'
                      : post.priority === 'IMPORTANT'
                      ? 'Important'
                      : 'Announcement'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <FileText className="size-3" />
                    Post by {post.author.firstName} {post.author.lastName}
                  </Badge>
                )}
                
                {variant === 'trending' && (
                  <Badge variant="secondary" className="gap-1 text-xs font-normal bg-orange-100 text-orange-800">
                    <Flame className="size-3" />
                    Trending
                  </Badge>
                )}
              </div>
            </div>
          </Link>
          
          {showJoinButton && (
            <Button
              size="sm"
              variant={hasJoined ? 'secondary' : 'default'}
              onClick={handleJoinClick}
              disabled={hasJoined || isJoining}
              className="flex-shrink-0"
            >
              {hasJoined ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Joined
                </>
              ) : (
                `Join`
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {post.title && (
          <h2 className="font-medium text-foreground leading-snug">{post.title}</h2>
        )}
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-0 text-xs text-muted-foreground">
        <span>{formatRelativeTime(post.createdAt)}</span>
        <UpvoteButton postId={post.id} initialCount={upvoteCount} initialLiked={hasUpvoted} />
      </CardFooter>
    </Card>
  );
}
