"use client";

import { cn } from "@/lib/utils";

interface Props {
  fragmentId: string;
  fragmentNumber: number;
  isActive: boolean;
  isGenerating: boolean;
  onClick: (fragmentId: string) => void;
}

export default function FragmentBadge({
  fragmentId,
  fragmentNumber,
  isActive,
  isGenerating,
  onClick,
}: Props) {
  return (
    <button
      onClick={() => onClick(fragmentId)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
        isGenerating
          ? "animate-pulse bg-blue-500 text-white"
          : isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/70"
      )}
    >
      Fragment #{fragmentNumber}
      {isGenerating && (
        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      )}
    </button>
  );
}
