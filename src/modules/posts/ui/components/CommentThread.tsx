'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useInView } from 'react-intersection-observer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

/**
 * ASCII Preview:
 * ┌─────────────────────────────────────────────┐
 * │  Comments (142)          [Top] [New]        │
 * ├─────────────────────────────────────────────┤
 * │ [Comment form at top]                        │
 * │                                              │
 * │ [CommentItem 1]                              │
 * │ [CommentItem 2]                              │
 * │ [CommentItem 3]                              │
 * │ ...                                          │
 * │         [Load More Comments...]              │
 * └─────────────────────────────────────────────┘
 */

interface CommentThreadProps {
  postId: string;
  currentUserId?: string;
}

export function CommentThread({ postId, currentUserId }: CommentThreadProps) {
  const [sort, setSort] = useState<'top' | 'new'>('new');
  const { ref: loadMoreRef, inView } = useInView();

  // Fetch comments with infinite scroll
  const commentsQuery = trpc.posts.getPostComments.useInfiniteQuery(
    {
      postId,
      limit: 20,
      sort,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
    }
  );

  // Auto-fetch next page when scroll into view
  if (inView && commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
    commentsQuery.fetchNextPage();
  }

  const comments = commentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalComments = comments.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Comments
            {totalComments > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalComments})
              </span>
            )}
          </CardTitle>

          <Tabs value={sort} onValueChange={(v) => setSort(v as 'top' | 'new')}>
            <TabsList className="h-8">
              <TabsTrigger value="new" className="text-xs">
                New
              </TabsTrigger>
              <TabsTrigger value="top" className="text-xs">
                Top
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Comment form */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <CommentForm postId={postId} placeholder="Write a comment..." />
        </div>

        {/* Comments list */}
        {commentsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading comments...
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-sm font-medium">No comments yet</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                currentUserId={currentUserId}
              />
            ))}

            {/* Infinite scroll trigger */}
            {commentsQuery.hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {commentsQuery.isFetchingNextPage ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading more comments...
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => commentsQuery.fetchNextPage()}
                  >
                    Load more comments
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
