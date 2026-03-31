'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/trpc/client';
import NextImage from 'next/image';
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
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const FUNCTION_SAFE_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_COMPRESSION_ATTEMPTS = 8;

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };

    image.src = url;
  });
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not compress image'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

async function prepareImageForUpload(file: File): Promise<{ uploadDataUrl: string; previewDataUrl: string }> {
  if (file.size <= FUNCTION_SAFE_IMAGE_BYTES) {
    const dataUrl = await fileToDataUrl(file);
    return {
      uploadDataUrl: dataUrl,
      previewDataUrl: dataUrl,
    };
  }

  const image = await loadImage(file);
  let scale = 1;
  let quality = 0.9;

  for (let attempt = 0; attempt < MAX_COMPRESSION_ATTEMPTS; attempt += 1) {
    const width = Math.max(1, Math.floor(image.naturalWidth * scale));
    const height = Math.max(1, Math.floor(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize image compression');
    }

    ctx.drawImage(image, 0, 0, width, height);
    const compressed = await canvasToJpegBlob(canvas, quality);

    if (compressed.size <= FUNCTION_SAFE_IMAGE_BYTES) {
      const dataUrl = await fileToDataUrl(compressed);
      return {
        uploadDataUrl: dataUrl,
        previewDataUrl: dataUrl,
      };
    }

    if (quality > 0.6) {
      quality -= 0.1;
    } else {
      scale *= 0.85;
      quality = 0.82;
    }
  }

  throw new Error('Image is still too large after compression. Please choose a smaller image.');
}

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setSelectedImage(file);

    try {
      const preparedImage = await prepareImageForUpload(file);
      setImagePreview(preparedImage.previewDataUrl);

      uploadImageMutation.mutate({
        base64Image: preparedImage.uploadDataUrl,
        fileName: file.name,
      });
    } catch (error) {
      setSelectedImage(null);
      setImagePreview(null);
      toast.error(error instanceof Error ? error.message : 'Failed to process image');
    }
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
            <NextImage
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
