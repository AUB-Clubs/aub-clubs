"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { trpc } from "@/trpc/client";

interface ProfileImageUploadProps {
  userId: string;
  currentImageUrl?: string | null;
  onUploadComplete: (url: string | null) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfileImageUpload({
  userId,
  currentImageUrl,
  onUploadComplete,
}: ProfileImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const uploadProfileImageMutation = trpc.profile.uploadProfileImage.useMutation();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size must be less than 5MB");
        return;
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Only JPG, PNG, and WebP images are allowed");
        return;
      }

      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Upload and moderate
      setIsUploading(true);
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;

        const result = await uploadProfileImageMutation.mutateAsync({
          base64Image: base64,
          fileName: file.name,
        });

        // Pass the new URL
        onUploadComplete(result.imageUrl);
        toast.success("Image uploaded successfully");
      } catch (error: any) {
        toast.error(error.message || "Failed to upload image");
        setPreview(currentImageUrl || null);
        onUploadComplete(currentImageUrl || null);
      } finally {
        setIsUploading(false);
      }
    },
    [currentImageUrl, onUploadComplete, uploadProfileImageMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleRemove = () => {
    setPreview(null);
    onUploadComplete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          <AvatarImage src={preview || undefined} />
          <AvatarFallback>
            <ImageIcon className="size-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner className="size-4" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            ) : isDragActive ? (
              <p className="text-sm text-primary">Drop the image here</p>
            ) : (
              <div className="space-y-1">
                <Upload className="mx-auto size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP (max 5MB)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {preview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRemove}
          disabled={isUploading}
        >
          <X className="mr-2 size-4" />
          Remove Image
        </Button>
      )}
    </div>
  );
}
