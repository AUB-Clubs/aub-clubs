'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClubSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Initialize state with current URL param if on clubs page
  const [query, setQuery] = useState(
    pathname === '/clubs' ? (searchParams.get('search') || '') : ''
  );
  const [type, setType] = useState(
  pathname === '/clubs' ? (searchParams.get('type') || '') : ''
  );

  
  const [debouncedQuery] = useDebounce(query, 300);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Requirement: "Clicking the bar should take you to clubs page"
  const handleFocus = () => {
    setIsFocused(true);
    if (pathname !== '/clubs') {
      router.push('/clubs');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Sync Input <- URL (Handle Back Button, Navigation Away)
  // Only sync if the user is NOT actively interacting with the input (isFocused is false)
  useEffect(() => {
    if (!isFocused) {
       // If on /clubs, use the param. If elsewhere, clear it.
       const urlQuery = pathname === '/clubs' ? (searchParams.get('search') || '') : '';
      const urlType = pathname === '/clubs' ? (searchParams.get('type') || '') : '';

       // Only update if different to avoid redundant renders
       if (query !== urlQuery || type !== urlType) {
           setQuery(urlQuery);
           setType(urlType);
       }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, isFocused]); // query excluded

  // Sync URL <- Input (Debounced)
  useEffect(() => {
    // Only update URL if we are on the /clubs page
    if (pathname === '/clubs') {
        const currentUrlSearch = searchParams.get('search') || '';
        
        // If the debounced query differs from URL, update URL
        if (debouncedQuery !== currentUrlSearch) {
             const params = new URLSearchParams(searchParams);
             
             if (debouncedQuery) {
                 params.set('search', debouncedQuery);
             } else {
                 params.delete('search');
             }

             if (type) {
              params.set('type', type);
            } else {
              params.delete('type');
            }
             
             // Reset pagination when searching
             params.delete('page');
             
             // Use replace to avoid polluting history with every character typed
             router.replace(`/clubs?${params.toString()}`);
        }
    }
  }, [debouncedQuery, type, pathname, router, searchParams]);


  // Handle form submission purely to prevent page reload if user hits enter
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className={`flex items-center gap-3 sm:w-[500px] ${className}`}>
      <div className="relative w-[300px]">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search clubs..."
        className="w-full rounded-full bg-background pl-8 appearance-none"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      </div>
        <Select value={type} onValueChange={(value) => setType(value)}>
        <SelectTrigger className="w-[180px] rounded-full">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Types</SelectItem>
          <SelectItem value="SOCIAL">Social</SelectItem>
          <SelectItem value="CAREER">Career</SelectItem>
          <SelectItem value="TECHNICAL">Technical</SelectItem>
          <SelectItem value="CULTURAL">Cultural</SelectItem>
          <SelectItem value="SPORTS">Sports</SelectItem>
        </SelectContent>
      </Select>
    </form>
  );
}
