import { createTool, createAgent, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";
import { getInstagramPostPrompt } from "../../prompts/posts/instagram";
import { getLinkedInPostPrompt } from "../../prompts/posts/linkedin";
import { getWhatsAppPostPrompt } from "../../prompts/posts/whatsapp";
import { getForumPostPrompt } from "../../prompts/posts/forum";

type Platform = "instagram" | "linkedin" | "whatsapp" | "forum";

function buildPostPrompt(
  platform: Platform,
  eventReport: string,
  clubName: string,
  previousContent?: string,
  editsRequested?: string
): string {
  const base = { event_report: eventReport, club_name: clubName, previous_content: previousContent, edits_requested: editsRequested };
  switch (platform) {
    case "instagram": return getInstagramPostPrompt(base);
    case "linkedin":  return getLinkedInPostPrompt(base);
    case "whatsapp":  return getWhatsAppPostPrompt(base);
    case "forum":     return getForumPostPrompt(base);
  }
}

export const generate_batch_posts_text = createTool<AgentState>({
  name: "generate_batch_posts_text",
  description: "Generates or modifies social media posts for Instagram, LinkedIn, WhatsApp, and Forum.",
  parameters: z.object({
    type: z.enum(["generate_new_posts", "modify_existing_post"]),
    explanation: z.string(),
    post_platform: z.enum(["instagram", "linkedin", "whatsapp", "forum", ""]).optional(),
    edits_requested: z.string().optional(),
  }),
  handler: async ({ type, explanation, post_platform, edits_requested }, { network }) => {
    const { fragmentId, projectId, publishers } = network!.state.data;
    const state = network!.state.data;

    await publishers.publishChunk(explanation);

    const eventReport =
      state.report ||
      (await prisma.fragment.findFirst({
        where: { message: { projectId }, completedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { eventReport: true },
      }))?.eventReport?.markdown ||
      "";

    const clubName = state.club.name;
    const platforms: Platform[] = ["instagram", "linkedin", "whatsapp", "forum"];

    if (type === "generate_new_posts") {
      const posts = await Promise.all(
        platforms.map(async (platform) => {
          const agent = createAgent({
            name: `post-agent-${platform}`,
            system: buildPostPrompt(platform, eventReport, clubName),
            model: openai({ model: "gpt-5.4" }),
          });
          const { output } = await agent.run("Generate the post now.");
          const content =
            output[0]?.type === "text"
              ? Array.isArray(output[0].content)
                ? output[0].content.join("")
                : output[0].content
              : "";
          return { platform, content };
        })
      );

      network!.state.data.posts = posts;

      if (fragmentId) {
        await prisma.eventPost.deleteMany({ where: { fragmentId } });
        await prisma.eventPost.createMany({
          data: posts.map((p) => ({ fragmentId, platform: p.platform, content: p.content })),
        });
      }

      await publishers.publishFragmentUpdate("posts", posts);
      return "All posts generated successfully.";
    }

    // Modify existing post
    const targetPlatform = (post_platform || "") as Platform;
    const existing = state.posts?.find((p) => p.platform === targetPlatform);

    const agent = createAgent({
      name: `post-agent-edit`,
      system: buildPostPrompt(targetPlatform, eventReport, clubName, existing?.content, edits_requested),
      model: openai({ model: "gpt-5.4" }),
    });
    const { output } = await agent.run("Modify the post now.");
    const newContent =
      output[0]?.type === "text"
        ? Array.isArray(output[0].content)
          ? output[0].content.join("")
          : output[0].content
        : "";

    const updatedPosts = (state.posts ?? []).map((p) =>
      p.platform === targetPlatform ? { ...p, content: newContent } : p
    );
    if (!updatedPosts.find((p) => p.platform === targetPlatform)) {
      updatedPosts.push({ platform: targetPlatform, content: newContent });
    }
    network!.state.data.posts = updatedPosts;

    if (fragmentId) {
      await prisma.eventPost.upsert({
        where: { fragmentId_platform: { fragmentId, platform: targetPlatform } } as any,
        create: { fragmentId, platform: targetPlatform, content: newContent },
        update: { content: newContent },
      });
    }

    await publishers.publishFragmentUpdate("posts", updatedPosts);
    return `Post for "${targetPlatform}" modified successfully.`;
  },
});
