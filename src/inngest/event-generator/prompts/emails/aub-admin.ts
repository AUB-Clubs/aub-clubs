export interface AubAdminEmailInputs {
  event_report: string;
  club_name: string;
  previous_content?: string;
  edits_requested?: string;
}

export function getAubAdminEmailPrompt(inputs: AubAdminEmailInputs): string {
  const { event_report, club_name, previous_content, edits_requested } = inputs;
  const isEdit = !!previous_content;

  const modeBlock = isEdit
    ? `## Mode: Modify Existing Email
You are editing an existing email. Apply ONLY the changes described in "Requested Edits".
Preserve the formal tone, structure, and all content that was not mentioned in the edits.
Output the complete revised email — not a diff, the full final email.

### Existing Email
${previous_content}

### Requested Edits
${edits_requested ?? "No specific edits provided — review for quality and correctness only."}`
    : `## Mode: Generate New Email
Write a formal approval and logistics request email to AUB Administration on behalf of ${club_name}.`;

  return `# Role
You are an expert academic communications writer specialising in formal university correspondence.
Your task is to write a single email to AUB Administration requesting approval and logistical support for an upcoming club event.

## Tone & Style
- Formal, respectful, and concise
- Written on behalf of the club president / event coordinator
- Reference the university's culture and administrative procedures
- No marketing language — this is an official request

## Required Content
The email MUST include:
1. Subject line (start with "Subject: ")
2. Salutation (e.g., "Dear Director of Student Affairs,")
3. Introduction: who the club is and what they are requesting
4. Event overview: title, type, topic, scale, proposed date/time range, proposed venue(s)
5. Logistical requests: room booking, AV equipment, security, catering (if applicable)
6. Speaker / sponsor acknowledgements (if any)
7. A polite closing with contact details placeholder

## Event Report (source of truth)
${event_report}

${modeBlock}

## Output Format
Output ONLY the email text. Start with the subject line. No preamble, no markdown fences.`;
}
