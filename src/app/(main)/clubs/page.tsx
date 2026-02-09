import { Suspense } from 'react';
import ClubList from "@/modules/Clubs/ui/Views/ClubsList";
import { ClubListSkeleton } from "@/modules/Clubs/ui/components/Skeletons";

export default function ClubsPage() {
  return (
    <Suspense fallback={<ClubListSkeleton />}>
      <ClubList />
    </Suspense>
  );
}
