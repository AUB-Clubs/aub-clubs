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
    const { clubId, projectId, publishers } = network!.state.data;
    const channel = `club:${clubId}:project:${projectId}`;

    await step!.run("provide_ideas_options:explain", () => publishers.publishChunk(explanation));

    await step!.run("set-awaiting-idea", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingIdeaSelection: true },
      });
    });

    await step!.run("provide_ideas_options:publish-awaiting", () =>
      publishers.publish({
        channel,
        topic: "ai",
        data: { type: "awaiting_idea_selection", clubId, projectId, ideas: ideas_list },
      })
    );

    const response = await step!.waitForEvent("wait-for-idea", {
      event: "event-generator/idea-response",
      timeout: "15m",
      if: `async.data.clubId == '${clubId}' && async.data.projectId == '${projectId}'`,
    });

    const selectedIdea: string =
      response?.data.selectedIdea ?? ideas_list[0];

    network!.state.data.selectedIdea = selectedIdea;

    await step!.run("clear-awaiting-idea", async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { isAwaitingIdeaSelection: false },
      });
    });

    await step!.run("provide_ideas_options:publish-completed", () =>
      publishers.publish({
        channel,
        topic: "ai",
        data: { type: "hil_completed", hilType: "idea_selection", clubId, projectId },
      })
    );

    return selectedIdea;
  },
});
