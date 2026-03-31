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
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be below 8MB");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);

    const base64Image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result ?? "");
        const payload = raw.split(",")[1];
        if (!payload) reject(new Error("Invalid image"));
        resolve(payload);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    inferMutation.mutate({
      mimeType: file.type as "image/png" | "image/jpeg" | "image/jpg",
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
