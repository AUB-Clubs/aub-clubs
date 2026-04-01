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
    <Card className="w-full">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex justify-center">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-9 w-full" />
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
  const skeletonCount = 6;

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
    <div className="mt-8 space-y-3">
      <div>
        <h2 className="text-xl font-semibold">Similar Clubs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You might also be interested in
        </p>
      </div>

      {/* Horizontal (x-axis) scroll view */}
      <div className="overflow-x-auto overflow-y-hidden pb-2 pr-1 [scrollbar-gutter:stable] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        <div className="grid min-w-max grid-flow-col auto-cols-[18rem] gap-3 pb-4">
          {isLoading ? (
            <>
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <SkeletonCard key={`similar-skeleton-${i}`} />
              ))}
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
    </div>
  );
}
