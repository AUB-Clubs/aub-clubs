'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import Image from 'next/image';
import { ExpandableImage } from '@/components/ui/expandable-image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CommentForm } from './CommentForm';

/**
 * ASCII Preview:
 * ┌─────────────────────────────────────────────┐
 * │ 👤 John Doe • 2h ago          ❤️ 24        │
 * │    This is a great post! Thanks for...      │
 * │    [🖼️ Image if attached]                   │
 * │    [Like] [Reply] [Delete?]                 │
 * │                                              │
 * │    [Load 3 replies ▼] or [Hide replies ▲]  │
 * │                                              │
 * │    ├─ [Nested CommentItem components]       │
 * └─────────────────────────────────────────────┘
 */

interface CommentItemProps {
  comment: {
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    imageUrls: string[];
    likeCount: number;
    isLiked: boolean;
    replyCount: number;
  };
  postId: string;
  depth?: number;
  currentUserId?: string;
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function CommentItem({ comment, postId, depth = 0, currentUserId }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const utils = trpc.useUtils();

  // Fetch replies when expanded
  const repliesQuery = trpc.posts.getCommentReplies.useInfiniteQuery(
    { commentId: comment.id, limit: 10 },
    {
      enabled: showReplies,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Toggle like mutation
  const likeMutation = trpc.posts.toggleCommentLike.useMutation({
    onMutate: async () => {
      // Optimistic update
      await utils.posts.getPostComments.cancel();
      
      // Snapshot the previous value
      const previousData = utils.posts.getPostComments.getInfiniteData({ postId });
      
      // Optimistically update
      utils.posts.getPostComments.setInfiniteData({ postId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === comment.id
                ? {
                    ...item,
                    isLiked: !item.isLiked,
                    likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
                  }
                : item
            ),
          })),
        };
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert on error
      if (context?.previousData) {
        utils.posts.getPostComments.setInfiniteData({ postId }, context.previousData);
      }
      toast.error('Failed to update like');
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      utils.posts.getPostComments.invalidate({ postId });
      if (showReplies) {
        utils.posts.getCommentReplies.invalidate({ commentId: comment.id });
      }
    },
  });

  // Delete comment mutation
  const deleteMutation = trpc.posts.deleteComment.useMutation({
    onSuccess: () => {
      toast.success('Comment deleted');
      utils.posts.getPostComments.invalidate({ postId });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete comment');
    },
  });

  const handleLike = () => {
    likeMutation.mutate({ commentId: comment.id });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this comment? All replies will also be deleted.')) {
      deleteMutation.mutate({ commentId: comment.id });
    }
  };

  const toggleReplies = () => {
    setShowReplies(!showReplies);
  };

  const replies = repliesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const isOwner = currentUserId === comment.author.id;

  return (
    <div className={cn('space-y-2', depth > 0 && 'ml-8')}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">{getInitials(comment.author.name)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="rounded-lg bg-muted p-3">
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="font-medium">{comment.author.name}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
            </div>
            
            <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
            
            {comment.imageUrls.length > 0 && (
              <div className="mt-2">
                {comment.imageUrls.map((url, i) => (
                  <ExpandableImage key={i} src={url} alt="Comment attachment" className="h-48 w-full rounded-md" />
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 gap-1 px-2 text-muted-foreground hover:text-red-500',
                comment.isLiked && 'text-red-500'
              )}
              onClick={handleLike}
              disabled={likeMutation.isPending}
            >
              <Heart
                className={cn(
                  'h-3 w-3 transition-all',
                  comment.isLiked && 'fill-current scale-110'
                )}
              />
              <span>{comment.likeCount}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-muted-foreground"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <MessageCircle className="h-3 w-3" />
              <span>Reply</span>
            </Button>
            
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-muted-foreground hover:text-red-500"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </Button>
            )}
            
            {comment.replyCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-muted-foreground"
                onClick={toggleReplies}
              >
                {showReplies ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    <span>Hide replies</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    <span>
                      {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                  </>
                )}
              </Button>
            )}
          </div>
          
          {showReplyForm && (
            <div className="mt-2">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                onSuccess={() => {
                  setShowReplyForm(false);
                  setShowReplies(true);
                  utils.posts.getCommentReplies.invalidate({ commentId: comment.id });
                }}
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}
          
          {showReplies && (
            <div className="mt-2 space-y-2">
              {repliesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Loading replies...
                </div>
              ) : (
                <>
                  {replies.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      postId={postId}
                      depth={depth + 1}
                      currentUserId={currentUserId}
                    />
                  ))}
                  
                  {repliesQuery.hasNextPage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => repliesQuery.fetchNextPage()}
                      disabled={repliesQuery.isFetchingNextPage}
                    >
                      {repliesQuery.isFetchingNextPage ? (
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Loading...
                        </span>
                      ) : (
                        'Load more replies'
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
