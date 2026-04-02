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

function toPlainTextPost(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/^```(?:text|markdown|md)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/^(\s*)[-*]\s+/gm, "$1- ")
    .replace(/^(\s*)(\d+)\.\s+/gm, "$1$2) ")
    .trim();
}

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
        const plainContent = toPlainTextPost(post.content);
        return (
          <Card key={post.id}>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{icon}</span>
                  {post.platform}
                </CardTitle>
                <CopyButton text={plainContent} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {plainContent}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
