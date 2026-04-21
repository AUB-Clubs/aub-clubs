import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const write_event_report = createTool<AgentState>({
  name: "write_event_report",
  description: "Creates the comprehensive event report in markdown. Call once with the complete report.",
  parameters: z.object({
    explanation: z.string(),
    event_markdown_report: z.string().describe("Full markdown report following the EVENT REPORT STRUCTURE."),
  }),
  handler: async ({ explanation, event_markdown_report }, { step, network }) => {
    const { fragmentId, publishers } = network!.state.data;

    await step!.run("write_event_report:explain", () => publishers.publishChunk(explanation));

    return await step!.run("write_event_report", async () => {
      // Save to state
      network!.state.data.report = event_markdown_report;

      // Save to DB (current incomplete fragment)
      if (fragmentId) {
        await prisma.eventReport.upsert({
          where: { fragmentId },
          create: { fragmentId, markdown: event_markdown_report },
          update: { markdown: event_markdown_report },
        });
      }

      await publishers.publishFragmentUpdate("report", { markdown: event_markdown_report });

      return "Event report created successfully.";
    });
  },
});
