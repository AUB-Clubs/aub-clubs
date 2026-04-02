import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";
import { generateTextWithOpenAI } from "../../openai";
import { getAubAdminEmailPrompt } from "../../prompts/emails/aub-admin";
import { getAnnouncementEmailPrompt } from "../../prompts/emails/announcement";
import { getSponsorEmailPrompt } from "../../prompts/emails/sponsor";
import { getSpeakerEmailPrompt } from "../../prompts/emails/speaker";

function sanitizeEmailContent(content: string, clubName: string): string {
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const withoutPlaceholders = normalized
    .replace(/\[(?:your|insert)[^\]]*\]/gi, "")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/^\s*(?:my name is|i am)\s+[^\n]+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (/(?:best regards|kind regards|regards|sincerely),?\s*$/i.test(withoutPlaceholders)) {
    return `${withoutPlaceholders}\n${clubName} Team`;
  }

  return withoutPlaceholders;
}

function buildEmailPrompt(
  emailName: string,
  eventReport: string,
  clubName: string,
  state: AgentState,
  previousContent?: string,
  editsRequested?: string
): string {
  const base = { event_report: eventReport, club_name: clubName, previous_content: previousContent, edits_requested: editsRequested };

  if (emailName === "AUB Admin Email") return getAubAdminEmailPrompt(base);
  if (emailName === "Club Members Email") return getAnnouncementEmailPrompt(base);

  // Per-sponsor email
  if (emailName.startsWith("Sponsor: ")) {
    const sponsorName = emailName.replace("Sponsor: ", "");
    const sponsor = state.sponsors?.find((s) => s.name === sponsorName);
    return getSponsorEmailPrompt({
      ...base,
      sponsor_name: sponsorName,
      sponsor_type: sponsor?.type ?? "",
      specific_contribution: sponsor?.specificContribution ?? "",
    });
  }

  // Per-speaker email
  if (emailName.startsWith("Speaker: ")) {
    const speakerName = emailName.replace("Speaker: ", "");
    const speaker = state.speakers?.find((s) => s.name === speakerName);
    return getSpeakerEmailPrompt({
      ...base,
      speaker_name: speakerName,
      speaker_title: speaker?.title ?? "",
      session_focus: speaker?.sessionFocus ?? "",
      why: speaker?.why ?? "",
    });
  }

  return getAnnouncementEmailPrompt(base);
}

export const generate_batch_emails = createTool<AgentState>({
  name: "generate_batch_emails",
  description: "Generates or modifies outreach emails using direct OpenAI calls. For new emails generates all concurrently. For edits targets a specific email by name.",
  parameters: z.object({
    type: z.enum(["generate_new_emails", "modify_existing_email"]).describe("Whether to generate new emails or modify an existing one"),
    explanation: z.string().describe("Explanation of what is being done"),
    email_name: z.string().describe("Name of email to modify. Empty for new generation.").default(""),
    edits_requested: z.string().describe("Requested changes. Empty for new generation.").default(""),
  }),
  handler: async ({ type, explanation, email_name, edits_requested }, { network }) => {
    const state = network!.state.data as AgentState;
    const { fragmentId, projectId, publishers } = state;

    await publishers.publishChunk(explanation);

    // Resolve event report
    const eventReport =
      state.report ||
      (await prisma.fragment.findFirst({
        where: { message: { projectId }, completedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { eventReport: true },
      }))?.eventReport?.markdown ||
      "";

    const clubName = state.club.name;

    if (type === "generate_new_emails") {
      // Build email name list: fixed + one per sponsor + one per speaker
      const emailNames = [
        "AUB Admin Email",
        "Club Members Email",
        ...(state.sponsors ?? []).map((s) => `Sponsor: ${s.name}`),
        ...(state.speakers ?? []).map((s) => `Speaker: ${s.name}`),
      ];

      const emails = await Promise.all(
        emailNames.map(async (name) => {
          const content = await generateTextWithOpenAI({
            systemPrompt: buildEmailPrompt(name, eventReport, clubName, state),
            userPrompt:
              "Generate the final email now. Return only the final ready-to-send email text.",
          });
          return {
            name,
            content: sanitizeEmailContent(content, clubName),
          };
        })
      );

      // Save to state
      network!.state.data.emails = emails;

      // Save to DB
      if (fragmentId) {
        await prisma.eventEmail.deleteMany({ where: { fragmentId } });
        await prisma.eventEmail.createMany({
          data: emails.map((e) => ({ fragmentId, name: e.name, content: e.content })),
        });
      }

      await publishers.publishFragmentUpdate("emails", emails);
      return "All emails generated successfully.";
    }

    // Modify existing email
    const targetName = email_name ?? "";
    const existing = state.emails?.find((e) => e.name === targetName);
    const previousContent = existing?.content;

    const newContentRaw = await generateTextWithOpenAI({
      systemPrompt: buildEmailPrompt(
        targetName,
        eventReport,
        clubName,
        state,
        previousContent,
        edits_requested
      ),
      userPrompt:
        "Apply the edits and return the complete final ready-to-send email text only.",
    });
    const newContent = sanitizeEmailContent(newContentRaw, clubName);

    // Update state
    const updatedEmails = (state.emails ?? []).map((e) =>
      e.name === targetName ? { ...e, content: newContent } : e
    );
    if (!updatedEmails.find((e) => e.name === targetName)) {
      updatedEmails.push({ name: targetName, content: newContent });
    }
    network!.state.data.emails = updatedEmails;

    // Update DB
    if (fragmentId) {
      await prisma.eventEmail.upsert({
        where: { fragmentId_name: { fragmentId, name: targetName } } as any,
        create: { fragmentId, name: targetName, content: newContent },
        update: { content: newContent },
      });
    }

    await publishers.publishFragmentUpdate("emails", updatedEmails);
    return `Email "${targetName}" modified successfully.`;
  },
});
