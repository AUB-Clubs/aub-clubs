'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatPanel } from './ChatPanel';

export function FloatingChatBubble() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setOpen(true);
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg transition-transform duration-300",
          open && "scale-0 opacity-0 pointer-events-none"
        )}
        aria-label="Open club assistant"
      >
        <MessageCircle className="size-6" />
      </Button>

      <div 
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-[32rem] sm:max-w-[32rem] bg-background border-l shadow-2xl transition-transform duration-500 ease-in-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasOpened && <ChatPanel onClose={() => setOpen(false)} />}
        </div>
      </div>
    </>
  );
}

