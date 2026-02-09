'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/trpc/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarRail,
} from '@/components/ui/sidebar';
import { 
  Home, 
  Settings, 
  Users, 
} from 'lucide-react';

export function AppSidebar() {
  const pathname = usePathname();
  const { data: user, isLoading } = trpc.profile.get.useQuery(undefined, { 
    retry: false, 
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false 
  });

  const items = [
    { title: "For You", url: "/me", icon: Home },
    { title: "Clubs", url: "/clubs", icon: Users },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex flex-col gap-2 p-2 group-data-[collapsible=icon]:hidden">
             {isLoading ? (
               <>
                 <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-1 overflow-hidden w-full">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                 </div>
                 <div className="flex flex-col gap-1 mt-1 px-1">
                     <Skeleton className="h-3 w-full" />
                     <Skeleton className="h-3 w-4/5" />
                 </div>
                  <div className="flex gap-4 px-1 mt-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                 </div>
               </>
             ) : (
                <>
                 <div className="flex items-center gap-2">
                    <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage src={user?.avatarUrl || undefined} alt="User" />
                        <AvatarFallback>{user?.firstName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col text-sm leading-tight overflow-hidden">
                        <span className="truncate font-semibold">{user ? `${user.firstName} ${user.lastName}` : 'Guest'}</span>
                        <span className="truncate text-xs text-muted-foreground">{user?.email || ''}</span>
                    </div>
                 </div>
                 {user?.bio && (
                     <p className="text-xs text-muted-foreground line-clamp-2 px-1">
                         {user.bio}
                     </p>
                 )}
                 <div className="flex gap-4 px-1 mt-2 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                        <span className="font-bold text-foreground">{user?.registered_clubs?.length || 0}</span> Clubs
                    </div>
                    <div className="flex gap-1">
                         <span className="font-bold text-foreground">{user?.year || '-'}</span> Year
                    </div>
                 </div>
                </>
             )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url || (item.url !== '/' && pathname.startsWith(item.url))}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/profile')}>
              <Link href="/profile">
                <Settings />
                <span>Settings & Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
