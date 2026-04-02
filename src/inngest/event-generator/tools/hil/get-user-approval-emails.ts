import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const get_user_approval_emails = createTool<AgentState>({
  name: "get_user_approval_emails",
  description: "Halts agent execution and waits for the user to approve or request edits to the generated emails.",
  parameters: z.object({
    explanation: z.string().describe("Brief message to the user requesting email approval."),
  }),
  handler: async ({ explanation }, { step, network }) => {
    const { projectId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-email-approval", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEmailApproval: true },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "awaiting_email_approval" },
    });

    const response = await step!.waitForEvent("wait-for-email-approval", {
      event: "event-generator/email-approval",
      timeout: "30m",
      if: `async.data.projectId == '${projectId}'`,
    });

    await step!.run("clear-awaiting-email-approval", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEmailApproval: false },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "hil_completed", hilType: "email_approval" },
    });

    const approved: boolean = response?.data.approved ?? false;
    const editNotes: string = response?.data.editNotes ?? "";

    return JSON.stringify({ approved, editNotes });
  },
});
