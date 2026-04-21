import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const log_event_details = createTool<AgentState>({
  name: "log_event_details",
  description: "Logs event scale, type, and topic to state and DB. Call once all three parameters are confirmed.",
  parameters: z.object({
    explanation: z.string(),
    scale: z.enum(["Small", "Medium", "Large"]),
    type: z.string().describe("e.g. Workshop, Seminar, Conference, Hackathon"),
    topic: z.string().describe("e.g. Artificial Intelligence, Sustainability"),
  }),
  handler: async ({ explanation, scale, type, topic }, { step, network }) => {
    const { fragmentId, publishers } = network!.state.data;

    await step!.run("log_event_details:explain", () => publishers.publishChunk(explanation));

    return await step!.run("log_event_details", async () => {
      // Save to state
      network!.state.data.scale = scale;
      network!.state.data.type = type;
      network!.state.data.topic = topic;

      // Save to DB (current incomplete fragment)
      if (fragmentId) {
        await prisma.eventDetails.upsert({
          where: { fragmentId },
          create: { fragmentId, scale, type, topic },
          update: { scale, type, topic },
        });
      }

      return "Event details logged successfully.";
    });
  },
});
