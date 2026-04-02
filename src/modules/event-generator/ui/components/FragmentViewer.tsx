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
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!fragment) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Fragment not found.
      </div>
    );
  }

  return (
    <Tabs defaultValue="preview" className="flex h-full flex-col">
      <div className="border-b px-4 pt-3 shrink-0">
        <TabsList className="h-8">
          <TabsTrigger value="preview" className="text-xs">
            Preview
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs">
            Emails
            {fragment.eventEmails.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {fragment.eventEmails.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="posts" className="text-xs">
            Posts
            {fragment.eventPosts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {fragment.eventPosts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto">
        <TabsContent value="preview" className="mt-0 h-full">
          <PreviewTab fragment={fragment} />
        </TabsContent>
        <TabsContent value="emails" className="mt-0 h-full">
          <EmailsTab emails={fragment.eventEmails} />
        </TabsContent>
        <TabsContent value="posts" className="mt-0 h-full">
          <PostsTab posts={fragment.eventPosts} image={fragment.eventImage} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
