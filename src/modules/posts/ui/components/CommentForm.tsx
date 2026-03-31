'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/trpc/client';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * ASCII Preview:
 * ┌─────────────────────────────────────────────┐
 * │ Write a comment...                          │
 * │ ┌─────────────────────────────────────────┐ │
 * │ │ Share your thoughts...                  │ │
 * │ │                                         │ │
 * │ └─────────────────────────────────────────┘ │
 * │                                              │
 * │ [🖼️ Image preview with remove button]      │
 * │                                              │
 * │ [📎 Attach Image]  [Cancel]  [Comment]      │
 * │                              245/2000       │
 * └─────────────────────────────────────────────┘
 */

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  placeholder?: string;
}

const MAX_COMMENT_LENGTH = 2000;

export function CommentForm({ postId, parentId, onSuccess, onCancel, placeholder }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Upload image mutation
  const uploadImageMutation = trpc.posts.uploadCommentImage.useMutation({
    onSuccess: (data) => {
      setUploadedImageUrl(data.imageUrl);
      toast.success('Image uploaded successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload image');
      // Clear the selected image on error
      setSelectedImage(null);
      setImagePreview(null);
    },
  });

  // Create comment mutation
  const createCommentMutation = trpc.posts.createComment.useMutation({
    onSuccess: () => {
      toast.success('Comment posted');
      setContent('');
      setSelectedImage(null);
      setImagePreview(null);
      setUploadedImageUrl(null);
      
      // Invalidate queries
      utils.posts.getPostComments.invalidate({ postId });
      if (parentId) {
        utils.posts.getCommentReplies.invalidate({ commentId: parentId });
      }
      
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to post comment');
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      
      // Upload immediately
      uploadImageMutation.mutate({
        base64Image: result,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setUploadedImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment must be less than ${MAX_COMMENT_LENGTH} characters`);
      return;
    }

    // Wait for image upload if in progress
    if (selectedImage && !uploadedImageUrl && uploadImageMutation.isPending) {
      toast.error('Please wait for the image to finish uploading');
      return;
    }

    createCommentMutation.mutate({
      postId,
      parentId: parentId ?? undefined,
      content: content.trim(),
      imageUrls: uploadedImageUrl ? [uploadedImageUrl] : undefined,
    });
  };

  const isSubmitting = createCommentMutation.isPending;
  const isUploading = uploadImageMutation.isPending;
  const characterCount = content.length;
  const hasContent = content.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder || 'Write a comment...'}
        className="min-h-[80px] resize-none text-sm"
        maxLength={MAX_COMMENT_LENGTH}
        disabled={isSubmitting}
      />

      {imagePreview && (
        <div className="relative w-full overflow-hidden rounded-md border">
          <div className="relative h-48 w-full bg-muted">
            <Image
              src={imagePreview}
              alt="Comment image preview"
              fill
              className="object-cover"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={handleRemoveImage}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </Button>
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageSelect}
            className="hidden"
            disabled={isSubmitting || isUploading || !!selectedImage}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || isUploading || !!selectedImage}
          >
            <ImagePlus className="h-4 w-4" />
            <span className="text-xs">
              {selectedImage ? 'Image attached' : 'Attach image'}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs text-muted-foreground',
              characterCount > MAX_COMMENT_LENGTH * 0.9 && 'text-orange-500',
              characterCount >= MAX_COMMENT_LENGTH && 'text-red-500'
            )}
          >
            {characterCount}/{MAX_COMMENT_LENGTH}
          </span>
          
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          
          <Button
            type="submit"
            size="sm"
            disabled={!hasContent || isSubmitting || isUploading || characterCount > MAX_COMMENT_LENGTH}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              'Comment'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
