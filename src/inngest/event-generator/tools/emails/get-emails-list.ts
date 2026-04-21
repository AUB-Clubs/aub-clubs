import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const get_emails_list = createTool<AgentState>({
  name: "get_emails_list",
  description: "Retrieves all generated emails with their names and content.",
  parameters: z.object({
    explanation: z.string(),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { projectId, publishers } = network!.state.data;

    await step!.run("get_emails_list:explain", () => publishers.publishChunk(explanation));

    return await step!.run("get_emails_list", async () => {
      // State-first
      if (network!.state.data.emails?.length) {
        return JSON.stringify(network!.state.data.emails);
      }

      // DB fallback: latest completed fragment
      const prevFragment = await prisma.fragment.findFirst({
        where: {
          message: { projectId },
          completedAt: { not: null },
        },
        orderBy: { createdAt: "desc" },
        include: { eventEmails: true },
      });

      const emails = (prevFragment?.eventEmails ?? []).map((e) => ({
        name: e.name,
        content: e.content,
      }));

      network!.state.data.emails = emails;

      return emails.length ? JSON.stringify(emails) : "No emails generated yet.";
    });
  },
});
