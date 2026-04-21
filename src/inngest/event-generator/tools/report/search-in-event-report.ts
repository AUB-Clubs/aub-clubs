import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { AgentState } from "../../types";

const CONTEXT_CHARS = 200;

export const search_in_event_report = createTool<AgentState>({
  name: "search_in_event_report",
  description: "Searches for an exact string in the event report and returns matching sections with surrounding context. Use this before edit_event_report to get the exact 'before' string.",
  parameters: z.object({
    explanation: z.string(),
    search_query: z.string().describe("Exact text to search for in the report."),
  }),
  handler: async ({ explanation, search_query }, { step, network }) => {
    const { publishers } = network!.state.data;

    await step!.run("search_in_event_report:explain", () => publishers.publishChunk(explanation));

    return await step!.run("search_in_event_report", async () => {
      const report = network!.state.data.report;
      if (!report) return "No event report available to search.";

      const index = report.indexOf(search_query);
      if (index === -1) return `No match found for: "${search_query}"`;

      const start = Math.max(0, index - CONTEXT_CHARS);
      const end = Math.min(report.length, index + search_query.length + CONTEXT_CHARS);
      const excerpt = report.slice(start, end);

      return `Match found at character ${index}:\n\n...${excerpt}...`;
    });
  },
});
