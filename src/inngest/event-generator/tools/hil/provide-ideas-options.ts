import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const provide_ideas_options = createTool<AgentState>({
  name: "provide_ideas_options",
  description: "Presents 3 generated event ideas to the user and waits for them to select one or provide a custom idea.",
  parameters: z.object({
    explanation: z.string().describe("Brief message to the user presenting the ideas."),
    ideas_list: z.array(z.string()).length(3).describe("Exactly 3 event idea strings to present."),
  }),
  handler: async ({ explanation, ideas_list }, { step, network }) => {
    const { projectId, fragmentId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    await step!.run("set-awaiting-idea", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingIdeaSelection: true },
      });
    });

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "awaiting_idea_selection", ideas: ideas_list },
    });

    const response = await step!.waitForEvent("wait-for-idea", {
      event: "event-generator/idea-response",
      timeout: "15m",
      if: `async.data.projectId == '${projectId}'`,
    });

    const selectedIdea: string =
      response?.data.selectedIdea ?? ideas_list[0];

    await step!.run("clear-awaiting-idea-and-save", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingIdeaSelection: false },
      });

      if (fragmentId) {
        await prisma.eventDetails.upsert({
          where: { fragmentId },
          create: { fragmentId, selectedIdea },
          update: { selectedIdea },
        });
      }
    });

    // Save to state
    network!.state.data.selectedIdea = selectedIdea;

    await publishers.publish({
      channel: `club:${network!.state.data.clubId}:project:${projectId}`,
      topic: "ai",
      data: { type: "hil_completed", hilType: "idea_selection" },
    });

    return selectedIdea;
  },
});
