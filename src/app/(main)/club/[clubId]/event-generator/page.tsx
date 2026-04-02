import { Suspense } from "react";
import ProjectListView from "@/modules/event-generator/ui/views/ProjectListView";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function EventGeneratorPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;

  return (
    <div className="container py-8">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 w-48 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 w-3/4 rounded bg-muted" />
                    <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 w-full rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        }
      >
        <ProjectListView clubId={clubId} />
      </Suspense>
    </div>
  );
}
