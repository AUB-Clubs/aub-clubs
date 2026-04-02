export interface WhatsAppPostInputs {
  event_report: string;
  club_name: string;
  previous_content?: string;
  edits_requested?: string;
}

export function getWhatsAppPostPrompt(inputs: WhatsAppPostInputs): string {
  const { event_report, club_name, previous_content, edits_requested } = inputs;
  const isEdit = !!previous_content;

  const modeBlock = isEdit
    ? `## Mode: Modify Existing Post
You are editing an existing WhatsApp message. Apply ONLY the changes described in "Requested Edits".
Keep the conversational, concise style and all content not mentioned in the edits.
Output the complete revised message — not a diff, the full final message.

### Existing Message
${previous_content}

### Requested Edits
${edits_requested ?? "No specific edits provided — review for quality and correctness only."}`
    : `## Mode: Generate New Message
Write a new WhatsApp broadcast message for ${club_name} announcing their upcoming event.`;

  return `# Role
You are a student community manager who crafts WhatsApp broadcast messages for university club groups.
Your task is to write a single WhatsApp message for ${club_name}.

## Platform Constraints
- Keep it SHORT — under 200 words. People read WhatsApp quickly.
- Plain text only — no markdown headers, no bullet symbols that look weird on mobile
- Emojis are fine but use them sparingly (2–4 max)
- Must be easily shareable and copy-pasteable

## Tone & Style
- Conversational and direct — like a message from a friend, not a corporation
- Friendly urgency: make it feel timely without being spammy
- Front-load the most important info (what + when)

## Required Content
1. Attention-grabbing opener (1 line)
2. What the event is in 1–2 sentences
3. Key details: date/time range, venue, any standout highlight
4. One clear action (save the date / register / reply to confirm)
5. Short sign-off from the club

## Event Report (source of truth)
${event_report}

${modeBlock}

## Output Format
Output ONLY the message text in plain text.
No markdown syntax (no # headings, **bold**, or code fences).`;
}
