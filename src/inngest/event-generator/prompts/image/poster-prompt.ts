import fs from "fs";
import path from "path";

// The system prompt loaded from image.md — instructs the sub-agent on how to
// construct Gemini-compatible image generation prompts using the design framework.
export const POSTER_GENERATION_PROMPT: string = fs.readFileSync(
  path.join(process.cwd(), "image.md"),
  "utf8"
);

// ─── User message builder ─────────────────────────────────────────────────────
// The sub-agent receives POSTER_GENERATION_PROMPT as its system prompt.
// This function builds the user message that is passed to agent.run().

export interface PosterPromptInputs {
  event_report: string;
  event_details: {
    scale: string;
    type: string;
    topic: string;
    selectedIdea?: string;
  };
  previous_prompt?: string;
  edits_requested?: string;
}

export function buildPosterUserMessage(inputs: PosterPromptInputs): string {
  const { event_report, event_details, previous_prompt, edits_requested } = inputs;
  const isEdit = !!previous_prompt;
  const outputConstraints = `## Output Constraints (MANDATORY)
- Generate a **standalone digital poster image only** (final poster asset).
- **No mockup scenes**: do not place the poster on a wall, billboard, desk, frame, hand, or room/environment.
- **No background scene** outside the poster itself.
- Use a **front-facing, flat 2D composition** (no perspective tilt, no camera angle).
- The final result must look like the poster file itself, ready to publish online.`;

  const detailsBlock = `## Event Details
- **Scale:** ${event_details.scale}
- **Type:** ${event_details.type}
- **Topic:** ${event_details.topic}
${event_details.selectedIdea ? `- **Concept:** ${event_details.selectedIdea}` : ""}`;

  if (isEdit) {
    return `${detailsBlock}

## Event Report
${event_report}

## Previous Image Prompt (what was used to generate the current poster)
${previous_prompt}

## Requested Edits
${edits_requested ?? "No specific edits — correct any factual details that differ from the current event report."}

${outputConstraints}

You are editing an existing poster image, NOT generating a new one from scratch.
The image will be passed directly to Gemini alongside your output.
Output an EDIT-STYLE prompt: describe only what should change and what should stay the same.
Be explicit — e.g. "Change the headline text to '...', keep the layout and color palette identical" or "Replace the background color with deep navy, preserve all typography positions".
Do NOT describe the full poster as if it doesn't exist yet.`;
  }

  return `${detailsBlock}

## Event Report
${event_report}

${outputConstraints}

Generate a complete image generation prompt for this event's poster following your design framework.`;
}
