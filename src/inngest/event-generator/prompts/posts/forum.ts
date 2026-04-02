export interface ForumPostInputs {
  event_report: string;
  club_name: string;
  previous_content?: string;
  edits_requested?: string;
}

export function getForumPostPrompt(inputs: ForumPostInputs): string {
  const { event_report, club_name, previous_content, edits_requested } = inputs;
  const isEdit = !!previous_content;

  const modeBlock = isEdit
    ? `## Mode: Modify Existing Post
You are editing an existing forum post. Apply ONLY the changes described in "Requested Edits".
Keep the comprehensive, formal style and all content not mentioned in the edits.
Output the complete revised post — not a diff, the full final post.

### Existing Post
${previous_content}

### Requested Edits
${edits_requested ?? "No specific edits provided — review for quality and correctness only."}`
    : `## Mode: Generate New Post
Write a new forum announcement post for ${club_name} on the AUB student forum.`;

  return `# Role
You are an experienced student affairs communicator writing for a university student forum (e.g., AUB Bulletin / Student Forum board).
Your task is to write a comprehensive forum announcement post for ${club_name}.

## Platform Constraints
- Formal forum post in plain text with clear spacing between sections
- Length: 300–500 words — include all relevant details since forum readers expect completeness
- No emoji clutter — one or two are fine in the title, none elsewhere

## Tone & Style
- Semi-formal, informative, and welcoming
- Comprehensive: include all details a student needs to decide whether to attend
- Structured with clear sections so readers can skim

## Required Structure
1. Title / Heading — event name and club name
2. About the Event — what it is, its purpose, and why students should care
3. Event Details — date/time range, venue, expected scale/attendance
4. Programme Highlights — speakers, agenda highlights, activities (if applicable)
5. Sponsors & Partners — acknowledge key supporters (if applicable)
6. Who Should Attend — target audience
7. About ${club_name} — one-sentence club description

## Event Report (source of truth)
${event_report}

${modeBlock}

## Output Format
Output ONLY the forum post text in plain text.
No markdown syntax (no # headings, no **bold**, no code fences).`;
}
