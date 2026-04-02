import Link from "next/link";
import ProjectListView from "@/modules/event-generator/ui/views/ProjectListView";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface EventGeneratorSectionProps {
  clubId: string;
}

export function EventGeneratorSection({ clubId }: EventGeneratorSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage your AI-powered event planning projects
          </p>
        </div>
        <Link href={`/club/${clubId}/event-generator`}>
          <Button variant="outline" size="sm">
            Open Full View
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </Link>
      </div>
      <ProjectListView clubId={clubId} />
    </div>
  );
}
