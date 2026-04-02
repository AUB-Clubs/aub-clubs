export interface SpeakerEmailInputs {
  event_report: string;
  club_name: string;
  speaker_name: string;
  speaker_title: string;
  session_focus: string;
  why: string;
  previous_content?: string;
  edits_requested?: string;
}

export function getSpeakerEmailPrompt(inputs: SpeakerEmailInputs): string {
  const {
    event_report,
    club_name,
    speaker_name,
    speaker_title,
    session_focus,
    why,
    previous_content,
    edits_requested,
  } = inputs;
  const isEdit = !!previous_content;

  const modeBlock = isEdit
    ? `## Mode: Modify Existing Email
You are editing an existing email. Apply ONLY the changes described in "Requested Edits".
Preserve the warm-professional tone, structure, and all content not mentioned in the edits.
Output the complete revised email — not a diff, the full final email.

### Existing Email
${previous_content}

### Requested Edits
${edits_requested ?? "No specific edits provided — review for quality and correctness only."}`
    : `## Mode: Generate New Email
Write a speaker invitation email to ${speaker_name} from ${club_name}.`;

  return `# Role
You are an experienced event coordinator and professional communicator.
Your task is to write a warm, respectful invitation email to a potential speaker on behalf of ${club_name}.

## Tone & Style
- Warm yet professional — show genuine admiration for the speaker's work
- Personalised: reference why this specific person is the right fit
- Clear about expectations: session topic, format, duration
- Respectful of their time: easy to say yes or no
- Do not use placeholders like [Your Name], [Your Email], or "my name is ..."
- The email must be ready to send as-is

## Speaker Details
- **Speaker Name:** ${speaker_name}
- **Title / Affiliation:** ${speaker_title}
- **Proposed Session Focus:** ${session_focus}
- **Why They Are a Great Fit:** ${why}

## Required Content
The email MUST include:
1. Subject line (start with "Subject: ")
2. Personalised salutation using the speaker's name
3. Introduction: who ${club_name} is and why they are reaching out to this specific person
4. The invitation: what the event is, the proposed session topic, and why they are the ideal speaker
5. Logistics: proposed date/time range, venue, format (in-person/virtual), session duration
6. What the club provides (travel, honorarium if applicable — use placeholders)
7. A clear and easy next step (reply to confirm interest)
8. Professional, grateful sign-off

## Event Report (source of truth)
${event_report}

${modeBlock}

## Output Format
Output ONLY the email text. Start with the subject line.
Use plain text line breaks (real new lines), no markdown fences, and no placeholder tokens.`;
}
