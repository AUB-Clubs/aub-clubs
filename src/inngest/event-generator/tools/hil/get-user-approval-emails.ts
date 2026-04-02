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
    const { clubId, projectId, publishers } = network!.state.data;
    const channel = `club:${clubId}:project:${projectId}`;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-email-approval", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEmailApproval: true },
      });
    });

    await publishers.publish({
      channel,
      topic: "ai",
      data: { type: "awaiting_email_approval", clubId, projectId },
    });

    const response = await step!.waitForEvent("wait-for-email-approval", {
      event: "event-generator/email-approval",
      timeout: "30m",
      if: `async.data.clubId == '${clubId}' && async.data.projectId == '${projectId}'`,
    });

    await step!.run("clear-awaiting-email-approval", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingEmailApproval: false },
      });
    });

    await publishers.publish({
      channel,
      topic: "ai",
      data: { type: "hil_completed", hilType: "email_approval", clubId, projectId },
    });

    const approved: boolean = response?.data.approved ?? false;
    const editNotes: string = response?.data.editNotes ?? "";

    return JSON.stringify({ approved, editNotes });
  },
});
