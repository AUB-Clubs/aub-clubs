"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { MAX_UPLOAD_FILE_BYTES, prepareImageDataUrlForUpload } from "@/lib/client-image-upload";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface EditProfilePictureProps {
  userId: string;
  currentImageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  variant?: "default" | "icon";
}

const MAX_FILE_SIZE = MAX_UPLOAD_FILE_BYTES;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function EditProfilePicture({
  userId,
  currentImageUrl,
  firstName,
  lastName,
  variant = "default",
}: EditProfilePictureProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const utils = trpc.useUtils();

  const updateAvatarMutation = trpc.profile.updateAvatar.useMutation({
    onSuccess: () => {
      toast.success("Profile picture updated!");
      utils.profile.get.invalidate();
      utils.auth.getCurrentUser.invalidate();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile picture");
    },
  });

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
        const preparedImage = await prepareImageDataUrlForUpload(file);

        const result = await uploadProfileImageMutation.mutateAsync({
          base64Image: preparedImage.dataUrl,
          fileName: file.name,
        });

        // Update in database
        await updateAvatarMutation.mutateAsync({ avatarUrl: result.imageUrl });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to upload image";
        toast.error(message);
        setPreview(currentImageUrl || null);
      } finally {
        setIsUploading(false);
      }
    },
    [currentImageUrl, updateAvatarMutation, uploadProfileImageMutation]
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

  const handleRemove = async () => {
    setIsUploading(true);
    try {
      await updateAvatarMutation.mutateAsync({ avatarUrl: null });
      setPreview(null);
    } catch {
      toast.error("Failed to remove profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = () => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase() || "?";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="secondary"
            size="icon"
            className="size-8 rounded-full shadow-md"
          >
            <Camera className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Camera className="size-4" />
            Edit Picture
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Profile Picture</DialogTitle>
          <DialogDescription>
            Upload a new profile picture. Max size is 5MB. Accepted formats:
            JPG, PNG, WebP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current/Preview Avatar */}
          <div className="flex justify-center">
            <Avatar className="size-32">
              <AvatarImage src={preview || undefined} />
              <AvatarFallback className="text-2xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner className="size-5" />
                <span className="text-muted-foreground">Uploading...</span>
              </div>
            ) : isDragActive ? (
              <p className="text-primary">Drop the image here</p>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag & drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP (max 5MB)
                </p>
              </div>
            )}
          </div>

          {/* Remove Button */}
          {(preview || currentImageUrl) && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={isUploading}
              className="w-full"
            >
              <X className="mr-2 size-4" />
              Remove Profile Picture
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
