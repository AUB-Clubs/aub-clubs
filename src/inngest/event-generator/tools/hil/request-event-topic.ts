import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const request_event_topic = createTool<AgentState>({
  name: "request_event_topic",
  description: "Asks the user to define the event topic if not already provided.",
  parameters: z.object({
    explanation: z.string().describe("Brief message to the user explaining why event topic is needed."),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { projectId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-topic", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventTopic: true },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "awaiting_event_topic" },
    });

    const response = await step!.waitForEvent("wait-for-topic", {
      event: "event-generator/topic-response",
      timeout: "15m",
      if: `async.data.projectId == '${projectId}'`,
    });

    await step!.run("clear-awaiting-topic", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventTopic: false },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "hil_completed", hilType: "event_topic" },
    });

    return response?.data.topic ?? "No response";
  },
});
