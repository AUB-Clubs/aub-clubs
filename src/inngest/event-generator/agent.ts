import { createAgent, openai } from "@inngest/agent-kit";
import { extractTaskSummary, lastAssistantTextMessageContent } from "../utils";
import type { AgentState } from "./types";
import * as tools from "./tools";

/**
 * Creates the event-generator agent with all tools and a dynamic system prompt.
 * The lifecycle hook detects the <task_summary> tag and saves it to state,
 * which causes the network router to stop iteration.
 */
export function createEventGeneratorAgent(systemPrompt: string) {
  return createAgent<AgentState>({
    name: "event-generator-agent",
    description: "An expert AUB club event planning agent",
    system: systemPrompt,
    model: openai({ model: "gpt-5.5" }),
    tools: Object.values(tools),
    lifecycle: {
      onResponse: async ({ result, network }) => {
        const text = lastAssistantTextMessageContent(result);
        const summary = extractTaskSummary(text);
        if (summary && network) {
          network.state.data.summary = summary;
        }
        return result;
      },
    },
  });
}
