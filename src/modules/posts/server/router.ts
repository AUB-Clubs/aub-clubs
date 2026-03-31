/**
 * Posts Router
 * 
 * Handles all post-related operations including comments
 */

import { z } from "zod";
import { createTRPCRouter } from "@/trpc/init";
import { protectedProcedure } from "@/modules/auth/server/middleware";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import { moderateText, moderateImage } from "@/modules/moderation/server/moderation";
import { uploadFileToSupabase } from "@/lib/supabase-storage";
import { createClient } from "@/modules/auth/server/utils/supabase-server";

/**
 * Helper to convert base64 to Blob
 */
function base64ToBlob(base64: string): Blob {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  // Detect MIME type from base64 prefix
  const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  
  return new Blob([uint8Array], { type: mimeType });
}

export const postsRouter = createTRPCRouter({
  /**
   * Get paginated top-level comments for a post
   * Supports sorting by "top" (likes + recency) or "new" (chronological)
   */
  getPostComments: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().nullish(),
        sort: z.enum(["top", "new"]).default("new"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { postId, limit, cursor, sort } = input;

      // Verify post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      // Build orderBy based on sort option
      const orderBy = sort === "top" 
        ? [{ likes: { _count: "desc" as const } }, { createdAt: "desc" as const }]
        : { createdAt: "desc" as const };

      const comments = await prisma.comment.findMany({
        where: {
          postId,
          parentId: null, // Only top-level comments
        },
        orderBy,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          images: {
            select: { imageUrl: true },
          },
          likes: {
            where: { userId: ctx.user.id },
            select: { id: true },
          },
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (comments.length > limit) {
        const nextItem = comments.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          author: {
            id: comment.author.id,
            name: `${comment.author.firstName} ${comment.author.lastName}`,
            avatarUrl: comment.author.avatarUrl,
          },
          imageUrls: comment.images.map((img) => img.imageUrl),
          likeCount: comment._count.likes,
          isLiked: comment.likes.length > 0,
          replyCount: comment._count.replies,
        })),
        nextCursor,
      };
    }),

  /**
   * Get paginated replies for a comment
   */
  getCommentReplies: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
        limit: z.number().min(1).max(50).default(10),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { commentId, limit, cursor } = input;

      // Verify parent comment exists
      const parentComment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true },
      });

      if (!parentComment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Parent comment not found",
        });
      }

      const replies = await prisma.comment.findMany({
        where: {
          parentId: commentId,
        },
        orderBy: { createdAt: "asc" }, // Replies shown oldest first
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          images: {
            select: { imageUrl: true },
          },
          likes: {
            where: { userId: ctx.user.id },
            select: { id: true },
          },
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (replies.length > limit) {
        const nextItem = replies.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: replies.map((reply) => ({
          id: reply.id,
          content: reply.content,
          createdAt: reply.createdAt.toISOString(),
          parentId: reply.parentId,
          author: {
            id: reply.author.id,
            name: `${reply.author.firstName} ${reply.author.lastName}`,
            avatarUrl: reply.author.avatarUrl,
          },
          imageUrls: reply.images.map((img) => img.imageUrl),
          likeCount: reply._count.likes,
          isLiked: reply.likes.length > 0,
          replyCount: reply._count.replies,
        })),
        nextCursor,
      };
    }),

  /**
   * Create a new comment or reply
   * Includes text moderation
   */
  createComment: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        parentId: z.string().nullish(),
        content: z.string().min(1).max(2000),
        imageUrls: z.array(z.string().url()).max(1).optional(), // Max 1 image per comment
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify post exists
      const post = await prisma.post.findUnique({
        where: { id: input.postId },
        select: { id: true, clubId: true },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      // If replying, verify parent comment exists
      if (input.parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: input.parentId },
          select: { id: true, postId: true },
        });

        if (!parentComment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent comment not found",
          });
        }

        if (parentComment.postId !== input.postId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent comment does not belong to this post",
          });
        }
      }

      // Moderate content
      try {
        await moderateText(input.content, {
          throwOnUnsafe: true,
          textThreshold: 0.05,
        });
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Unexpected moderation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to verify content safety. Please try again later.",
        });
      }

      // Create comment with images in transaction
      const comment = await prisma.$transaction(async (tx) => {
        const newComment = await tx.comment.create({
          data: {
            postId: input.postId,
            parentId: input.parentId,
            authorId: ctx.user.id,
            content: input.content,
          },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Create comment images if provided
        if (input.imageUrls && input.imageUrls.length > 0) {
          await tx.commentImage.createMany({
            data: input.imageUrls.map((url) => ({
              commentId: newComment.id,
              imageUrl: url,
            })),
          });
        }

        return newComment;
      });

      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        author: {
          id: comment.author.id,
          name: `${comment.author.firstName} ${comment.author.lastName}`,
          avatarUrl: comment.author.avatarUrl,
        },
      };
    }),

  /**
   * Upload and moderate a comment image
   * Returns the public URL for use in createComment
   */
  uploadCommentImage: protectedProcedure
    .input(
      z.object({
        base64Image: z.string(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Moderate image first
      try {
        await moderateImage(input.base64Image, {
          throwOnUnsafe: true,
          imageThreshold: 0.3,
        });
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("Unexpected moderation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to verify image safety. Please try again later.",
        });
      }

      // Convert base64 to Blob
      const blob = base64ToBlob(input.base64Image);

      // Upload to Supabase
      const result = await uploadFileToSupabase({
        file: blob,
        userId: ctx.user.id,
        folder: "comment-images",
        fileName: input.fileName,
        supabaseClient: ctx.supabase,
      });

      return {
        imageUrl: result.publicUrl,
      };
    }),

  /**
   * Toggle like on a comment
   */
  toggleCommentLike: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if comment exists
      const comment = await prisma.comment.findUnique({
        where: { id: input.commentId },
        select: { id: true },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check if already liked
      const existingLike = await prisma.commentLike.findUnique({
        where: {
          userId_commentId: {
            userId: ctx.user.id,
            commentId: input.commentId,
          },
        },
      });

      if (existingLike) {
        // Unlike
        await prisma.commentLike.delete({
          where: { id: existingLike.id },
        });
        return { isLiked: false };
      } else {
        // Like
        await prisma.commentLike.create({
          data: {
            userId: ctx.user.id,
            commentId: input.commentId,
          },
        });
        return { isLiked: true };
      }
    }),

  /**
   * Delete own comment
   * Cascades to delete all replies and images
   */
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get comment
      const comment = await prisma.comment.findUnique({
        where: { id: input.commentId },
        select: { id: true, authorId: true },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check ownership
      if (comment.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      // Delete comment (cascade will handle replies, images, and likes)
      await prisma.comment.delete({
        where: { id: input.commentId },
      });

      return { success: true };
    }),
});
