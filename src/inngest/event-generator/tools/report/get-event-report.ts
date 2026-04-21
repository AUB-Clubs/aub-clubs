import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const get_event_report = createTool<AgentState>({
  name: "get_event_report",
  description: "Retrieves the complete event report markdown.",
  parameters: z.object({
    explanation: z.string(),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { projectId, publishers } = network!.state.data;

    await step!.run("get_event_report:explain", () => publishers.publishChunk(explanation));

    return await step!.run("get_event_report", async () => {
      // State-first
      if (network!.state.data.report) {
        return network!.state.data.report;
      }

      // DB fallback: latest completed fragment
      const prevFragment = await prisma.fragment.findFirst({
        where: {
          message: { projectId },
          completedAt: { not: null },
        },
        orderBy: { createdAt: "desc" },
        include: { eventReport: true },
      });

      const markdown = prevFragment?.eventReport?.markdown ?? null;

      if (markdown) {
        network!.state.data.report = markdown;
      }

      return markdown ?? "No event report found.";
    });
  },
});
