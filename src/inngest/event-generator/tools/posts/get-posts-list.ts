import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const get_posts_list = createTool<AgentState>({
  name: "get_posts_list",
  description: "Retrieves all generated social media posts and the promotional image URL.",
  parameters: z.object({
    explanation: z.string(),
  }),
  handler: async ({ explanation }, { network }) => {
    const { projectId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    // State-first
    if (network!.state.data.posts?.length) {
      return JSON.stringify({
        posts: network!.state.data.posts,
        postImageUrl: network!.state.data.postImageUrl,
      });
    }

    // DB fallback: latest completed fragment
    const prevFragment = await prisma.fragment.findFirst({
      where: {
        message: { projectId },
        completedAt: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: { eventPosts: true, eventImage: true },
    });

    const posts = (prevFragment?.eventPosts ?? []).map((p) => ({
      platform: p.platform,
      content: p.content,
    }));
    const postImageUrl = prevFragment?.eventImage?.supabaseUrl ?? "";

    network!.state.data.posts = posts;
    network!.state.data.postImageUrl = postImageUrl;

    return JSON.stringify({ posts, postImageUrl });
  },
});
