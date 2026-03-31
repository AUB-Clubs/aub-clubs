"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";

type PreviewItem = {
  courseCode: string;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  startTime: string;
  endTime: string;
  location?: string | null;
};

const MAX_INPUT_FILE_BYTES = 8 * 1024 * 1024;
const FUNCTION_SAFE_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_COMPRESSION_ATTEMPTS = 8;

type PreparedImage = {
  blob: Blob;
  mimeType: "image/png" | "image/jpeg";
};

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not compress image"));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function prepareImageForInference(file: File): Promise<PreparedImage> {
  if (file.size <= FUNCTION_SAFE_IMAGE_BYTES) {
    return {
      blob: file,
      mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
    };
  }

  const image = await loadImage(file);
  let scale = 1;
  let quality = 0.9;

  for (let attempt = 0; attempt < MAX_COMPRESSION_ATTEMPTS; attempt += 1) {
    const width = Math.max(1, Math.floor(image.naturalWidth * scale));
    const height = Math.max(1, Math.floor(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not initialize image compression");
    }

    ctx.drawImage(image, 0, 0, width, height);
    const compressed = await canvasToBlob(canvas, quality);

    if (compressed.size <= FUNCTION_SAFE_IMAGE_BYTES) {
      return {
        blob: compressed,
        mimeType: "image/jpeg",
      };
    }

    if (quality > 0.6) {
      quality -= 0.1;
    } else {
      scale *= 0.85;
      quality = 0.82;
    }
  }

  throw new Error("Image is too large. Please upload a smaller screenshot.");
}

export function ScheduleUploadDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const inferMutation = trpc.scheduleInference.inferFromImage.useMutation({
    onSuccess: (data) => {
      setItems(data.items);
      setJobId(data.jobId);
      toast.success("Schedule extracted. Review and accept.");
    },
    onError: (error) => {
      toast.error(error.message || "Could not extract schedule");
    },
  });

  const acceptMutation = trpc.scheduleInference.acceptInference.useMutation({
    onSuccess: async () => {
      await utils.calendar.getStudentCalendar.invalidate();
      toast.success("Schedule imported. You can edit it anytime.");
      setOpen(false);
      setItems([]);
      setJobId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const rejectMutation = trpc.scheduleInference.rejectInference.useMutation({
    onSuccess: () => {
      setItems([]);
      setJobId(null);
      toast.message("Inference rejected");
    },
  });

  async function onPickFile(file: File | undefined) {
    if (!file) return;

    setItems([]);
    setJobId(null);

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      toast.error("Please upload PNG or JPG/JPEG images");
      return;
    }
    if (file.size > MAX_INPUT_FILE_BYTES) {
      toast.error("Image must be below 8MB");
      return;
    }

    let prepared: PreparedImage;
    try {
      prepared = await prepareImageForInference(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not process image";
      toast.error(message);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(prepared.blob));
    setSelectedFileName(file.name);
    setSelectedFileSize(prepared.blob.size);

    const dataUrl = await fileToDataUrl(prepared.blob);
    const base64Image = dataUrl.split(",")[1];
    if (!base64Image) {
      toast.error("Invalid image payload");
      return;
    }

    inferMutation.mutate({
      mimeType: prepared.mimeType,
      base64Image,
    });
  }

  function formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (inferMutation.isPending) return;
    void onPickFile(event.dataTransfer.files?.[0]);
  }

  return (
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Analyze schedule image
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import class schedule</DialogTitle>
          <DialogDescription>
            Upload a schedule image. AI extracts classes, you review, then accept to replace your course schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              void onPickFile(file);
            }}
            className="hidden"
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              "group rounded-xl border-2 border-dashed p-6 transition-all",
              "bg-gradient-to-br from-muted/70 via-background to-muted/30",
              inferMutation.isPending && "opacity-70",
              isDragging
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border hover:border-primary/70 hover:shadow-sm"
            )}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full border border-border bg-background p-3">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">Drag and drop your schedule image</p>
                <p className="text-xs text-muted-foreground">or click to browse files</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">PNG</Badge>
                <Badge variant="secondary">JPG/JPEG</Badge>
                <span>Max 8MB</span>
              </div>
            </div>
          </div>

          {selectedFileName && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">Selected file</p>
              <p className="text-sm text-muted-foreground">
                {selectedFileName}
                {selectedFileSize ? ` (${formatBytes(selectedFileSize)})` : ""}
              </p>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Schedule preview"
                  className="mt-3 max-h-48 w-full rounded-md object-contain"
                />
              )}
            </div>
          )}

          {inferMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading image and extracting your weekly classes...
            </div>
          )}

          {items.length > 0 && (
            <div className="max-h-80 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Course</th>
                    <th className="px-3 py-2 text-left">Day</th>
                    <th className="px-3 py-2 text-left">Start</th>
                    <th className="px-3 py-2 text-left">End</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`${item.courseCode}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2">{item.courseCode}</td>
                      <td className="px-3 py-2">{item.dayOfWeek}</td>
                      <td className="px-3 py-2">{item.startTime}</td>
                      <td className="px-3 py-2">{item.endTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!jobId || rejectMutation.isPending}
            onClick={() => jobId && rejectMutation.mutate({ jobId })}
          >
            Reject
          </Button>
          <Button
            disabled={!jobId || items.length === 0 || acceptMutation.isPending}
            onClick={() =>
              jobId &&
              acceptMutation.mutate({
                jobId,
                items,
                replaceExisting: true,
              })
            }
          >
            {acceptMutation.isPending ? "Importing..." : "Accept and replace my course schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
