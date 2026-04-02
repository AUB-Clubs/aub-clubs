import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const request_event_scale = createTool<AgentState>({
  name: "request_event_scale",
  description: "Asks the user to define the event scale if not already provided.",
  parameters: z.object({
    explanation: z.string().describe("Brief message to the user explaining why scale is needed."),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { projectId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-scale", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventScale: true },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "awaiting_event_scale" },
    });

    const response = await step!.waitForEvent("wait-for-scale", {
      event: "event-generator/scale-response",
      timeout: "15m",
      if: `async.data.projectId == '${projectId}'`,
    });

    await step!.run("clear-awaiting-scale", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventScale: false },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "hil_completed", hilType: "event_scale" },
    });

    return response?.data.scale ?? "No response";
  },
});
