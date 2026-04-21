import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const log_selected_idea = createTool<AgentState>({
  name: "log_selected_idea",
  description:
    "Logs the selected event idea in state and DB after the user chooses from provided ideas.",
  parameters: z.object({
    explanation: z
      .string()
      .describe("Brief message to the user explaining that the selected idea is being logged."),
    selected_idea: z
      .string()
      .describe("The exact idea selected by the user (or user's custom idea)."),
  }),
  handler: async ({ explanation, selected_idea }, { step, network }) => {
    const state = network!.state.data as AgentState;
    const { fragmentId, publishers } = state;

    await step!.run("log_selected_idea:explain", () => publishers.publishChunk(explanation));

    return await step!.run("log_selected_idea", async () => {
      const selectedIdea = selected_idea.trim();
      if (!selectedIdea) {
        return "No selected idea provided to log.";
      }

      state.selectedIdea = selectedIdea;

      if (fragmentId) {
        await prisma.eventDetails.upsert({
          where: { fragmentId },
          create: { fragmentId, selectedIdea },
          update: { selectedIdea },
        });
        await publishers.publishFragmentUpdate("event_details", { selectedIdea });
      }

      return `Logged selected idea: ${selectedIdea}`;
    });
  },
});
