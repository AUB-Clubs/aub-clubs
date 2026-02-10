import { Suspense } from 'react';
import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import ClubOverview from '@/modules/Clubs/ui/Views/Club-Overview';
import { ClubOverviewSkeleton } from '@/modules/Clubs/ui/components/Skeletons';

interface ClubPageProps {
  params: Promise<{ clubId: string }>
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { clubId } = await params;

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { title: true, description: true },
    });

    if (!club) {
      return {
        title: 'Club Not Found',
        description: 'The requested club could not be found.',
      };
    }

    return {
      title: club.title,
      description: club.description,
    };
  } catch (error) {
    return {
      title: 'Error',
      description: 'An error occurred while fetching club details.',
    };
  }
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params
  return (
    <Suspense fallback={<ClubOverviewSkeleton />}>
      <ClubOverview clubId={clubId} />
    </Suspense>
  )
}
