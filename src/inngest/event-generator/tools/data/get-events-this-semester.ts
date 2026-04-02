import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const getEventsThisSemester = createTool<AgentState>({
  name: "getEventsThisSemester",
  description: "Retrieves past and upcoming events this semester to avoid duplication.",
  parameters: z.object({
    explanation: z.string(),
  }),
  handler: async ({ explanation }, { network }) => {
    const { publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    try {
      const events = await prisma.event.findMany({
        orderBy: { startsAt: "asc" },
        include: { club: { select: { title: true } } },
        take: 100,
      });

      return JSON.stringify(events, null, 2);
    } catch (e: any) {
      return "Failed to fetch events: " + e.message;
    }
  },
});
