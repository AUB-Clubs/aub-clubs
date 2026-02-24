'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useDebounce } from 'use-debounce';

export function ClubSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [query, setQuery] = useState(
    pathname === '/clubs' ? (searchParams.get('search') || '') : ''
  );

  const [debouncedQuery] = useDebounce(query, 300);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setIsFocused(true);
    if (pathname !== '/clubs') {
      router.push('/clubs');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Sync Input <- URL
  useEffect(() => {
    if (!isFocused) {
      const urlQuery = pathname === '/clubs' ? (searchParams.get('search') || '') : '';
      if (query !== urlQuery) {
        setQuery(urlQuery);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, isFocused]);

  // Sync URL <- Input (Debounced)
  useEffect(() => {
    if (pathname === '/clubs') {
      const currentUrlSearch = searchParams.get('search') || '';

      if (debouncedQuery !== currentUrlSearch) {
        const params = new URLSearchParams(searchParams);

        if (debouncedQuery) {
          params.set('search', debouncedQuery);
        } else {
          params.delete('search');
        }

        params.delete('page');

        router.replace(`/clubs?${params.toString()}`);
      }
    }
  }, [debouncedQuery, pathname, router, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit} className={`flex items-center ${className}`}>
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
    </form>
  );
}
