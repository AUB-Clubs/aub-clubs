"use client";

import { Code2, ChevronRight } from "lucide-react";
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
        "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 transition-all text-left",
        isGenerating
          ? "bg-zinc-800"
          : isActive
            ? "bg-zinc-700 ring-1 ring-zinc-600"
            : "bg-zinc-800"
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-700 shrink-0">
        <Code2 className="size-4 text-zinc-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium text-zinc-200", isGenerating && "animate-pulse")}>Fragment #{fragmentNumber}</p>
        <p className={
          cn(
            "text-xs text-zinc-200 truncate",
            isGenerating && "animate-pulse" )}>
          {isGenerating ? "Generating…" : "Event data"}
        </p>
      </div>
      <ChevronRight className="size-4 text-zinc-500 shrink-0" />
    </button>
  );
}
