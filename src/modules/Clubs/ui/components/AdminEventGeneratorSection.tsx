import ProjectListView from "@/modules/event-generator/ui/views/ProjectListView";

interface EventGeneratorSectionProps {
  clubId: string;
}

export function EventGeneratorSection({ clubId }: EventGeneratorSectionProps) {
  return <ProjectListView clubId={clubId} />;
}
