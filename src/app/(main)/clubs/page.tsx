import { Suspense } from 'react';
import { Metadata } from 'next';
import ClubList from "@/modules/Clubs/ui/Views/ClubsList";
import { ClubListSkeleton } from "@/modules/Clubs/ui/components/Skeletons";

export const metadata: Metadata = {
  title: "All Clubs",
  description: "Browse all active clubs at AUB.",
};

export default function ClubsPage() {
  return (
    <Suspense fallback={<ClubListSkeleton />}>
      <ClubList />
    </Suspense>
  );
}
