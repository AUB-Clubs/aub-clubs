'use client';

import { usePathname } from 'next/navigation';
import { 
    SidebarProvider, 
    SidebarInset, 
    SidebarTrigger, 
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/modules/Students/ui/components/Sidebar';
import { ClubSearchBar } from '@/modules/Clubs/ui/components/ClubSearchBar';
import { Separator } from '@/components/ui/separator';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          
          <div className="flex flex-1 justify-center">
             <ClubSearchBar className="w-full max-w-md" />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
             {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
