import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const edit_event_report = createTool<AgentState>({
  name: "edit_event_report",
  description: "Edits the event report using exact string replacement. Use search_in_event_report first to get the exact 'before' string.",
  parameters: z.object({
    explanation: z.string(),
    before: z.string().describe("Exact string to find in the report."),
    after: z.string().describe("Replacement string."),
  }),
  handler: async ({ explanation, before, after }, { step, network }) => {
    const { fragmentId, publishers } = network!.state.data;

    await step!.run("edit_event_report:explain", () => publishers.publishChunk(explanation));

    return await step!.run("edit_event_report", async () => {
      const current = network!.state.data.report;
      if (!current) return "No event report in state to edit.";

      if (!current.includes(before)) {
        return `Could not find the exact string to replace. Use search_in_event_report to locate the correct text.`;
      }

      const updated = current.replace(before, after);

      // Update state
      network!.state.data.report = updated;

      // Update DB (current incomplete fragment)
      if (fragmentId) {
        await prisma.eventReport.upsert({
          where: { fragmentId },
          create: { fragmentId, markdown: updated },
          update: { markdown: updated },
        });
      }

      await publishers.publishFragmentUpdate("report", { markdown: updated });

      return "Event report updated successfully.";
    });
  },
});
