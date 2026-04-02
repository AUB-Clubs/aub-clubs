'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { 
    SidebarProvider, 
    SidebarInset, 
    SidebarTrigger, 
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/modules/Students/ui/components/Sidebar';
import { ClubSearchBar } from '@/modules/Clubs/ui/components/ClubSearchBar';
import { ClubSearchBarSkeleton } from '@/modules/Clubs/ui/components/Skeletons';
import { Separator } from '@/components/ui/separator';

export function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isEventGeneratorChat =
    /^\/club\/[^/]+\/event-generator\/[^/]+$/.test(pathname) ||
    /^\/clubs\/[^/]+\/projects\/[^/]+$/.test(pathname);

  return (
    <SidebarProvider className={isEventGeneratorChat ? "h-svh overflow-hidden" : ""}>
      <AppSidebar />
      <SidebarInset className={isEventGeneratorChat ? "min-h-0 overflow-hidden" : ""}>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          {!isEventGeneratorChat && (
            <div className="flex flex-1 justify-center">
              <Suspense fallback={<ClubSearchBarSkeleton />}>
                <ClubSearchBar className="w-full max-w-md" />
              </Suspense>
            </div>
          )}
        </header>
        <div
          className={
            isEventGeneratorChat
              ? "flex flex-1 min-h-0 flex-col overflow-hidden"
              : "flex flex-1 flex-col gap-4 p-4"
          }
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
