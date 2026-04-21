import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";
import { generateTextWithOpenAI } from "../../openai";
import { getInstagramPostPrompt } from "../../prompts/posts/instagram";
import { getLinkedInPostPrompt } from "../../prompts/posts/linkedin";
import { getWhatsAppPostPrompt } from "../../prompts/posts/whatsapp";
import { getForumPostPrompt } from "../../prompts/posts/forum";

type Platform = "instagram" | "linkedin" | "whatsapp" | "forum";

function isPlatform(value: string): value is Platform {
  return ["instagram", "linkedin", "whatsapp", "forum"].includes(value);
}

function sanitizePostContent(content: string): string {
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
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
  description: "Generates or modifies social media posts for Instagram, LinkedIn, WhatsApp, and Forum using direct OpenAI calls.",
  parameters: z.object({
    type: z.enum(["generate_new_posts", "modify_existing_post"]).describe("Whether to generate new posts or modify an existing one"),
    explanation: z.string().describe("Explanation of what is being done"),
    post_platform: z.enum(["instagram", "linkedin", "whatsapp", "forum", ""]).describe("Platform for post modification. Empty for new generation.").default(""),
    edits_requested: z.string().describe("Requested changes for modifications. Empty for new generation.").default(""),
  }),
  handler: async ({ type, explanation, post_platform, edits_requested }, { step, network }) => {
    const state = network!.state.data as AgentState;
    const { fragmentId, projectId, publishers } = state;

    await step!.run("generate_batch_posts_text:explain", () => publishers.publishChunk(explanation));

    return await step!.run("generate_batch_posts_text", async () => {
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
            const content = await generateTextWithOpenAI({
              systemPrompt: buildPostPrompt(platform, eventReport, clubName),
              userPrompt:
                "Generate the final post text now. Return plain text only (no markdown syntax).",
            });
            return { platform, content: sanitizePostContent(content) };
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
      const targetPlatform: Platform = isPlatform(post_platform)
        ? post_platform
        : "instagram";
      const existing = state.posts?.find((p) => p.platform === targetPlatform);

      const editedPost = await generateTextWithOpenAI({
        systemPrompt: buildPostPrompt(
          targetPlatform,
          eventReport,
          clubName,
          existing?.content,
          edits_requested
        ),
        userPrompt:
          "Apply the edits and return the complete final post text only, in plain text without markdown syntax.",
      });
      const newContent = sanitizePostContent(editedPost);

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
    });
  },
});
