"use client";

import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpandableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
}

export function ExpandableImage({ src, alt, className, ...props }: ExpandableImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <div 
        className={cn("group relative overflow-hidden bg-muted", className)}
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          {...props}
        />
        
        {/* Overlay with expand icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Maximize2 className="h-6 w-6 text-white drop-shadow-md" />
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl w-full p-1 sm:p-2 bg-transparent border-none shadow-none flex justify-center [&>button]:hidden">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="relative group/dialog">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute -top-4 -right-4 z-50 rounded-full bg-background/50 p-2 text-foreground backdrop-blur-sm transition-all hover:bg-background/80"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={src} 
              alt={alt} 
              className="max-h-[85vh] w-auto object-contain rounded-md" 
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}