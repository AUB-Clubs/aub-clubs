"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E5E5E0] dark:border-white/5 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6 lg:px-12 xl:px-40">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="text-[#840132] dark:text-white flex items-center justify-center p-2.5 rounded-xl bg-primary/5 transition-colors group-hover:bg-primary/10">
            <span className="material-symbols-outlined text-3xl">
              diversity_3
            </span>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#840132] dark:text-white">
            AUB Clubs
          </span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList className="gap-6">
            <NavigationMenuItem>
              <Link
                href="/clubs"
                className="text-sm font-bold text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-white"
              >
                Clubs
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link
                href="/events"
                className="text-sm font-bold text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-white"
              >
                Events
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link
                href="/about"
                className="text-sm font-bold text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-white"
              >
                About
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="font-bold text-sm text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-white"
          >
            Sign In
          </Button>

          <Button className="bg-[#840132] text-white h-10 px-6 rounded-full font-bold text-sm shadow-sm hover:opacity-90">
            Join
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-600 dark:text-gray-300"
              >
                <span className="material-symbols-outlined">menu</span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-44 bg-background-light dark:bg-background-dark border-[#E5E5E0] dark:border-white/10"
            >
              <DropdownMenuItem asChild>
                <Link href="/clubs">Clubs</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/events">Events</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/about">About</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
