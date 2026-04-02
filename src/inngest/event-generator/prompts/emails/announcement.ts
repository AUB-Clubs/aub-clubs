export interface AnnouncementEmailInputs {
  event_report: string;
  club_name: string;
  previous_content?: string;
  edits_requested?: string;
}

export function getAnnouncementEmailPrompt(inputs: AnnouncementEmailInputs): string {
  const { event_report, club_name, previous_content, edits_requested } = inputs;
  const isEdit = !!previous_content;

  const modeBlock = isEdit
    ? `## Mode: Modify Existing Email
You are editing an existing email. Apply ONLY the changes described in "Requested Edits".
Preserve the excited tone, structure, and all content that was not mentioned in the edits.
Output the complete revised email — not a diff, the full final email.

### Existing Email
${previous_content}

### Requested Edits
${edits_requested ?? "No specific edits provided — review for quality and correctness only."}`
    : `## Mode: Generate New Email
Write an exciting announcement email to ${club_name} members about an upcoming event.`;

  return `# Role
You are an enthusiastic student communications writer who knows how to get fellow students excited about club events.
Your task is to write a single announcement email sent to all ${club_name} club members.

## Tone & Style
- Energetic, warm, and inviting — this is a peer-to-peer message
- Use casual-but-clear language suited for university students
- Build excitement and a sense of community
- Keep it concise — students skim emails
- Do not use placeholders like [Your Name], [Your Email], or "my name is ..."
- The email must be ready to send as-is

## Required Content
The email MUST include:
1. Subject line (start with "Subject: " — make it punchy and compelling)
2. Friendly greeting (e.g., "Hey [Club Name] fam! 👋")
3. The big news: what the event is and why members should care
4. Key details: date/time range, venue, what to expect
5. Featured speakers or highlights (if applicable)
6. Clear call-to-action (e.g., save the date, register, share with friends)
7. Warm sign-off from the club

## Event Report (source of truth)
${event_report}

${modeBlock}

## Output Format
Output ONLY the email text. Start with the subject line.
Use plain text line breaks (real new lines), no markdown fences, and no placeholder tokens.`;
}
