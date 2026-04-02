import { Suspense } from "react";
import EventGeneratorPage from "@/modules/event-generator/ui/EventGeneratorPage";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  params: Promise<{ clubId: string; projectId: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { clubId, projectId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen">
          <div className="flex w-1/2 flex-col gap-4 p-4 border-r">
            <Skeleton className="h-10 w-48 ml-auto" />
            <Skeleton className="h-16 w-64" />
            <Skeleton className="h-10 w-48 ml-auto" />
          </div>
          <div className="flex-1 p-4 space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      }
    >
      <EventGeneratorPage clubId={clubId} projectId={projectId} />
    </Suspense>
  );
}
