import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import type { AgentState } from "../../types";

export const queryRAG = createTool<AgentState>({
  name: "queryRAG",
  description: "Queries the RAG system for relevant speakers, sponsors, or buildings based on the event topic.",
  parameters: z.object({
    explanation: z.string(),
    type: z.enum(["speakers", "sponsors", "buildings"]),
    query: z.string().describe("Natural language query to find relevant documents."),
  }),
  handler: async ({ explanation, type, query }, { network }) => {
    const { publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    const { createEmbedding } = await import("@/lib/RAG/utils");
    const embedding = await createEmbedding(query);

    let results = "";

    switch (type) {
      case "buildings": {
        const { findNearestMatchBuildings } = await import("@/lib/RAG/buildings/rag_utils");
        results = await findNearestMatchBuildings(embedding);
        break;
      }
      case "sponsors": {
        const { findNearestMatchSponsors } = await import("@/lib/RAG/sponsors/rag_utils");
        results = await findNearestMatchSponsors(embedding);
        break;
      }
      case "speakers": {
        const { findNearestMatchSpeakers } = await import("@/lib/RAG/speakers/rag_utils");
        results = await findNearestMatchSpeakers(embedding);
        break;
      }
    }

    return results || "No relevant documents found.";
  },
});
