"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MessageSquare, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProjectListViewProps {
  clubId: string;
}

export default function ProjectListView({ clubId }: ProjectListViewProps) {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [initialPrompt, setInitialPrompt] = useState("");

  const { data: projects, isLoading } = trpc.eventGenerator.projects.list.useQuery({ clubId });

  const sendMessage = trpc.eventGenerator.messages.send.useMutation({
    onSuccess: (_, variables) => {
      router.push(`/club/${clubId}/event-generator/${variables.projectId}`);
    },
  });

  const createProject = trpc.eventGenerator.projects.create.useMutation({
    onSuccess: (project) => {
      setShowCreateDialog(false);
      const prompt = initialPrompt.trim();
      setProjectName("");
      setInitialPrompt("");
      sendMessage.mutate({ projectId: project.id, value: prompt });
    },
  });

  const handleCreateProject = () => {
    if (projectName.trim() && initialPrompt.trim()) {
      createProject.mutate({ clubId, name: projectName.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 size-4" />
            New Project
          </Button>
        </div>

        {projects && projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10">
                <MessageSquare className="size-10 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Create your first event generation project to get started with AI-powered event planning.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 size-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects?.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-all hover:shadow-md hover:ring-1 hover:ring-primary/20"
                onClick={() => router.push(`/club/${clubId}/event-generator/${project.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="line-clamp-1">{project.name}</span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {project._count.messages} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                    </span>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Give your event generation project a name to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="e.g., Spring Tech Workshop 2026"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && projectName.trim()) {
                    handleCreateProject();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt">Initial Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the event you want to generate…"
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!projectName.trim() || !initialPrompt.trim() || createProject.isPending || sendMessage.isPending}
            >
              {createProject.isPending || sendMessage.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
