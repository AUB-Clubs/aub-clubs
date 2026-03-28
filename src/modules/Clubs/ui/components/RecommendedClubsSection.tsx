'use client';

import { trpc } from '@/trpc/client';
import { ClubRecommendationCard } from '@/modules/Recommendations/ui/components/ClubRecommendationCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

interface ClubData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  types: string[];
  memberCount: number;
}

export function RecommendedClubsSection() {
  const skeletonCount = 6;

  const {
    data: recommendedClubs,
    isLoading: isLoadingRecommendations,
    isFetching: isFetchingRecommendations,
  } = trpc.recommendations.getRecommendedClubs.useQuery(
    { limit: 6 },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
    }
  );

  const hasRecommendedClubs = (recommendedClubs?.length ?? 0) > 0;
  const recommendationsResolved = !isLoadingRecommendations && !isFetchingRecommendations;
  const shouldLoadPopularFallback = recommendationsResolved && !hasRecommendedClubs;

  // Fallback to popular clubs if no recommendations
  const { data: popularClubs, isLoading: isLoadingPopular } = trpc.clubs.getPopularClubs.useQuery(
    { limit: 6 },
    {
      enabled: shouldLoadPopularFallback,
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
    }
  );

  const clubsToShow: ClubData[] | undefined = hasRecommendedClubs
    ? recommendedClubs
    : popularClubs;

  const showLoading = !recommendationsResolved || (shouldLoadPopularFallback && isLoadingPopular);
  const isRecommended = hasRecommendedClubs;

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {showLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-52" />
              <Skeleton className="h-4 w-72" />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {isRecommended ? 'Recommended for You' : 'Popular Clubs'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isRecommended
                  ? 'Clubs we think you might like based on your interests'
                  : 'Join clubs to get personalized recommendations'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Mobile: 1 column */}
      <div className="grid grid-cols-1 sm:hidden gap-4">
        {showLoading ? (
          <>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={`mobile-skeleton-${i}`} />
            ))}
          </>
        ) : (
          clubsToShow?.map((club) => (
            <ClubRecommendationCard
              key={club.id}
              club={{ 
                ...club, 
                imageUrl: club.imageUrl ?? undefined,
                description: club.description ?? undefined,
              }}
              variant="grid"
            />
          ))
        )}
      </div>

      {/* Tablet: 2-column grid */}
      <div className="hidden sm:grid lg:hidden grid-cols-2 gap-4">
        {showLoading ? (
          <>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={`tablet-skeleton-${i}`} />
            ))}
          </>
        ) : (
          clubsToShow?.map((club) => (
            <ClubRecommendationCard
              key={club.id}
              club={{ 
                ...club, 
                imageUrl: club.imageUrl ?? undefined,
                description: club.description ?? undefined,
              }}
              variant="grid"
            />
          ))
        )}
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        {showLoading ? (
          <>
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={`desktop-skeleton-${i}`} />
            ))}
          </>
        ) : (
          clubsToShow?.map((club) => (
            <ClubRecommendationCard
              key={club.id}
              club={{ 
                ...club, 
                imageUrl: club.imageUrl ?? undefined,
                description: club.description ?? undefined,
              }}
              variant="grid"
            />
          ))
        )}
      </div>

      {/* Show "Browse All" link if showing popular clubs */}
      {!isRecommended && !showLoading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" asChild>
            <Link href="/clubs">
              Browse All Clubs
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
