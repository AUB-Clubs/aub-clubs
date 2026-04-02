import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const request_event_type = createTool<AgentState>({
  name: "request_event_type",
  description: "Asks the user to define the event type if not already provided.",
  parameters: z.object({
    explanation: z.string().describe("Brief message to the user explaining why event type is needed."),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { clubId, projectId, publishers } = network!.state.data;
    const channel = `club:${clubId}:project:${projectId}`;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-type", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventType: true },
      });
    });

    await publishers.publish({
      channel,
      topic: "ai",
      data: { type: "awaiting_event_type", clubId, projectId },
    });

    const response = await step!.waitForEvent("wait-for-type", {
      event: "event-generator/type-response",
      timeout: "15m",
      if: `async.data.clubId == '${clubId}' && async.data.projectId == '${projectId}'`,
    });

    await step!.run("clear-awaiting-type", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventType: false },
      });
    });

    await publishers.publish({
      channel,
      topic: "ai",
      data: { type: "hil_completed", hilType: "event_type", clubId, projectId },
    });

    return response?.data.type ?? "No response";
  },
});
