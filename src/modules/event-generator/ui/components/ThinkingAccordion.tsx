"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  chunks: string[];
  isComplete: boolean;
}

export default function ThinkingAccordion({ chunks, isComplete }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (isComplete) setIsOpen(false);
  }, [isComplete]);

  if (chunks.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 text-sm overflow-hidden">
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="flex w-full items-center justify-between px-3 py-2 hover:text-gray-800 transition-colors"
      >
        <span className="font-medium text-xs animate-pulse">
          {isComplete ? "Thinking process" : "Thinking…"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-1 max-h-40 overflow-y-auto">
          {chunks.map((chunk, i) => (
            <p key={i} className="text-xs text-gray-800 leading-relaxed">
              {chunk}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
