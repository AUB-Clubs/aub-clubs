'use client';

import { trpc } from '@/trpc/client';
import { ClubRecommendationCard } from '@/modules/Recommendations/ui/components/ClubRecommendationCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

interface SimilarClubsSectionProps {
  clubId: string;
}

function SkeletonCard() {
  return (
    <Card className="w-[200px] flex-shrink-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-center">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-1 justify-center">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-20 mx-auto" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SimilarClubsSection({ clubId }: SimilarClubsSectionProps) {
  const { data: similarClubs, isLoading } = trpc.recommendations.getSimilarClubs.useQuery(
    { clubId, limit: 5 },
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (replaces cacheTime in newer versions)
    }
  );

  // Don't show anything if there are no similar clubs
  if (!isLoading && (!similarClubs || similarClubs.length === 0)) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Similar Clubs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You might also be interested in
        </p>
      </div>

      {/* Mobile: Horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 sm:hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          similarClubs?.map((club) => (
            <ClubRecommendationCard
              key={club.id}
              club={{ ...club, imageUrl: club.imageUrl ?? undefined }}
              variant="compact"
            />
          ))
        )}
      </div>

      {/* Tablet: 2-column grid */}
      <div className="hidden sm:grid lg:hidden grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          similarClubs?.map((club) => (
            <ClubRecommendationCard
              key={club.id}
              club={{ ...club, imageUrl: club.imageUrl ?? undefined }}
              variant="compact"
            />
          ))
        )}
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          similarClubs?.map((club) => (
            <ClubRecommendationCard
              key={club.id}
              club={{ ...club, imageUrl: club.imageUrl ?? undefined }}
              variant="compact"
            />
          ))
        )}
      </div>
    </div>
  );
}
