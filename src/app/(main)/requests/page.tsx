import { Suspense } from 'react';
import RequestsList from '@/modules/Students/ui/Views/RequestsList';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'My Join Requests',
  description: 'View the status of your club join requests.',
};

export default function RequestsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <RequestsList />
    </Suspense>
  );
}
