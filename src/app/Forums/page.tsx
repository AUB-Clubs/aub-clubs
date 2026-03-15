import { Suspense } from 'react';
import ForumView from '@/modules/Forums/ui/ForumView';

export default function ForumPage() {
  return (
    <Suspense fallback={<div className="container mx-auto max-w-3xl px-4 py-8">Loading...</div>}>
      <ForumView />
    </Suspense>
  );
}