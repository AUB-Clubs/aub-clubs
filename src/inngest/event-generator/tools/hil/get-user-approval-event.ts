import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const get_user_approval_event = createTool<AgentState>({
  name: "get_user_approval_event",
  description: "Halts agent execution and waits for the user to approve or request edits to the event report.",
  parameters: z.object({
    explanation: z.string().describe("Brief message to the user requesting approval."),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { projectId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-event-approval", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventApproval: true },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "awaiting_event_approval" },
    });

    const response = await step!.waitForEvent("wait-for-event-approval", {
      event: "event-generator/event-approval",
      timeout: "30m",
      if: `async.data.projectId == '${projectId}'`,
    });

    await step!.run("clear-awaiting-event-approval", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEventApproval: false },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "hil_completed", hilType: "event_approval" },
    });

    const approved: boolean = response?.data.approved ?? false;
    const editNotes: string = response?.data.editNotes ?? "";

    return JSON.stringify({ approved, editNotes });
  },
});
