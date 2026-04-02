"use client";

import { trpc } from "@/trpc/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import PreviewTab from "./PreviewTab";
import EmailsTab from "./EmailsTab";
import PostsTab from "./PostsTab";

interface Props {
  fragmentId: string;
}

export default function FragmentViewer({ fragmentId }: Props) {
  const { data: fragment, isLoading } = trpc.eventGenerator.fragments.get.useQuery(
    { fragmentId }
  );

  if (isLoading) {
    return (
      <div className="h-full min-h-0 space-y-3 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!fragment) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
        Fragment not found.
      </div>
    );
  }

  return (
    <Tabs defaultValue="preview" className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 h-14 flex items-center shrink-0">
        <TabsList className="h-8">
          <TabsTrigger value="preview" className="text-xs">
            Preview
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs">
            Emails
          </TabsTrigger>
          <TabsTrigger value="posts" className="text-xs">
            Posts
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 min-h-0">
        <TabsContent value="preview" className="mt-0 h-full min-h-0 overflow-y-auto">
          <PreviewTab fragment={fragment} />
        </TabsContent>
        <TabsContent value="emails" className="mt-0 h-full min-h-0 overflow-y-auto">
          <EmailsTab emails={fragment.eventEmails} />
        </TabsContent>
        <TabsContent value="posts" className="mt-0 h-full min-h-0 overflow-y-auto">
          <PostsTab posts={fragment.eventPosts} image={fragment.eventImage} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
