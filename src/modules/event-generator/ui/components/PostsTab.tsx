"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface EventPost {
  id: string;
  platform: string;
  content: string;
}

interface EventImage {
  supabaseUrl: string;
  prompt: string | null;
}

interface Props {
  posts: EventPost[];
  image?: EventImage | null;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  linkedin: "💼",
  whatsapp: "💬",
  forum: "📋",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

export default function PostsTab({ posts, image }: Props) {
  if (posts.length === 0 && !image) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No posts generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {image && (
        <div className="overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.supabaseUrl}
            alt="Event poster"
            className="w-full object-cover"
          />
          {image.prompt && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {image.prompt}
            </p>
          )}
        </div>
      )}

      {posts.map((post) => {
        const icon = PLATFORM_ICONS[post.platform.toLowerCase()] ?? "📣";
        return (
          <Card key={post.id}>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{icon}</span>
                  {post.platform}
                </CardTitle>
                <CopyButton text={post.content} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {post.content}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
