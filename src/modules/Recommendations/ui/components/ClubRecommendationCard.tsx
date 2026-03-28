'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Check } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/trpc/client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';

// Types
type ClubType = string;

interface ClubRecommendationData {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  types: ClubType[];
  memberCount: number;
  isJoined?: boolean;
}

interface ClubRecommendationCardProps {
  club: ClubRecommendationData;
  variant?: 'compact' | 'grid';
}

function formatTypeLabel(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAnd\b/g, 'and');
}

function getClubInitials(name: string): string {
  const words = name.split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function ClubRecommendationCard({ club, variant = 'grid' }: ClubRecommendationCardProps) {
  const queryClient = useQueryClient();
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(club.isJoined || false);

  const requestJoinMutation = trpc.clubs.requestJoin.useMutation({
    onMutate: () => {
      setIsJoining(true);
    },
    onSuccess: () => {
      setHasJoined(true);
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: getQueryKey(trpc.recommendations.getSimilarClubs),
      });
      queryClient.invalidateQueries({
        queryKey: getQueryKey(trpc.recommendations.getRecommendedClubs),
      });
    },
    onSettled: () => {
      setIsJoining(false);
    },
  });

  const handleJoinClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasJoined && !isJoining) {
      requestJoinMutation.mutate({ clubId: club.id });
    }
  };

  // Compact variant for horizontal scroll (Similar Clubs)
  if (variant === 'compact') {
    return (
      <Link href={`/clubs/${club.id}`}>
        <Card className="w-[200px] flex-shrink-0 hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-center">
              <Avatar className="h-12 w-12">
                <AvatarImage src={club.imageUrl} alt={club.title} />
                <AvatarFallback>{getClubInitials(club.title)}</AvatarFallback>
              </Avatar>
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                {club.title}
              </h3>
              
              <div className="flex flex-wrap gap-1 justify-center min-h-[1.5rem]">
                {club.types.slice(0, 2).map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs px-1.5 py-0">
                    {formatTypeLabel(type)}
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{club.memberCount}</span>
              </div>
            </div>

            <Button
              size="sm"
              className="w-full"
              variant={hasJoined ? "secondary" : "default"}
              onClick={handleJoinClick}
              disabled={hasJoined || isJoining}
            >
              {hasJoined ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Joined
                </>
              ) : (
                'Join'
              )}
            </Button>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Grid variant for recommended clubs section
  return (
    <Link href={`/clubs/${club.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-16 w-16 flex-shrink-0">
              <AvatarImage src={club.imageUrl} alt={club.title} />
              <AvatarFallback>{getClubInitials(club.title)}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-semibold text-base line-clamp-2">
                {club.title}
              </h3>
              <div className="flex flex-wrap gap-1">
                {club.types.slice(0, 3).map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {formatTypeLabel(type)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {club.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {club.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{club.memberCount} members</span>
            </div>

            <Button
              size="sm"
              variant={hasJoined ? "secondary" : "default"}
              onClick={handleJoinClick}
              disabled={hasJoined || isJoining}
            >
              {hasJoined ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Joined
                </>
              ) : (
                'Join Club'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
