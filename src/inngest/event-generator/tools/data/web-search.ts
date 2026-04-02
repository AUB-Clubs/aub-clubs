import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { AgentState } from "../../types";

export const webSearch = createTool<AgentState>({
  name: "webSearch",
  description: "Searches the web for real-time information (speaker availability, trending topics, etc.).",
  parameters: z.object({
    explanation: z.string(),
    query: z.string().describe("The search query."),
  }),
  handler: async ({ explanation, query }, { network }) => {
    const { publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    try {
      const cheerio = await import("cheerio");
      const res = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      );
      const html = await res.text();
      const $ = cheerio.load(html);

      const results: { title: string; snippet: string; link: string }[] = [];
      $(".result__body").each((i, el) => {
        if (i >= 5) return;
        results.push({
          title: $(el).find(".result__title").text().trim(),
          snippet: $(el).find(".result__snippet").text().trim(),
          link: $(el).find(".result__url").text().trim(),
        });
      });

      return JSON.stringify({ results }, null, 2);
    } catch (e: any) {
      return "Web search failed: " + e.message;
    }
  },
});
