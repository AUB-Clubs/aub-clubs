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

async function resolveEmailContext(
  state: AgentState,
  fragmentId: string | null,
  projectId: string
): Promise<Pick<AgentState, "report" | "sponsors" | "speakers">> {
  const hasReport = state.report.trim().length > 0;
  const hasSponsors = (state.sponsors ?? []).length > 0;
  const hasSpeakers = (state.speakers ?? []).length > 0;

  if (hasReport && hasSponsors && hasSpeakers) {
    return {
      report: state.report,
      sponsors: state.sponsors ?? [],
      speakers: state.speakers ?? [],
    };
  }

  const currentFragment = fragmentId
    ? await prisma.fragment.findUnique({
        where: { id: fragmentId },
        include: {
          eventReport: true,
          eventSponsors: true,
          eventSpeakers: true,
        },
      })
    : null;

  const previousCompleted = await prisma.fragment.findFirst({
    where: { message: { projectId }, completedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      eventReport: true,
      eventSponsors: true,
      eventSpeakers: true,
    },
  });

  const report =
    state.report ||
    currentFragment?.eventReport?.markdown ||
    previousCompleted?.eventReport?.markdown ||
    "";

  const sponsors =
    (state.sponsors ?? []).length > 0
      ? state.sponsors
      : (currentFragment?.eventSponsors ?? previousCompleted?.eventSponsors ?? []).map((s) => ({
          name: s.name,
          type: s.type,
          specificContribution: s.specificContribution,
          why: s.why,
        }));

  const speakers =
    (state.speakers ?? []).length > 0
      ? state.speakers
      : (currentFragment?.eventSpeakers ?? previousCompleted?.eventSpeakers ?? []).map((s) => ({
          name: s.name,
          title: s.title,
          sessionFocus: s.sessionFocus,
          why: s.why,
        }));

  return { report, sponsors, speakers };
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
  handler: async ({ type, explanation, email_name, edits_requested }, { step, network }) => {
    const state = network!.state.data as AgentState;
    const { fragmentId, projectId, publishers } = state;

    await step!.run("generate_batch_emails:explain", () => publishers.publishChunk(explanation));

    return await step!.run("generate_batch_emails", async () => {
      const context = await resolveEmailContext(state, fragmentId, projectId);
      network!.state.data.report = context.report;
      network!.state.data.sponsors = context.sponsors;
      network!.state.data.speakers = context.speakers;

      const generationState: AgentState = {
        ...state,
        report: context.report,
        sponsors: context.sponsors,
        speakers: context.speakers,
      };
      const eventReport = generationState.report;

      const clubName = state.club.name;

      if (type === "generate_new_emails") {
        // Build email name list: fixed + one per sponsor + one per speaker
        const emailNames = [
          "AUB Admin Email",
          "Club Members Email",
          ...generationState.sponsors
            .map((s) => s.name.trim())
            .filter((name) => name.length > 0)
            .map((name) => `Sponsor: ${name}`),
          ...generationState.speakers
            .map((s) => s.name.trim())
            .filter((name) => name.length > 0)
            .map((name) => `Speaker: ${name}`),
        ];

        const emails = await Promise.all(
          emailNames.map(async (name) => {
            const content = await generateTextWithOpenAI({
              systemPrompt: buildEmailPrompt(name, eventReport, clubName, generationState),
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
      const targetName = (email_name ?? "").trim();
      if (!targetName) {
        throw new Error("Email name is required when modifying an existing email.");
      }
      const existing = state.emails?.find((e) => e.name === targetName);
      const previousContent = existing?.content;

      const newContentRaw = await generateTextWithOpenAI({
        systemPrompt: buildEmailPrompt(
          targetName,
          eventReport,
          clubName,
          generationState,
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
        const updateResult = await prisma.eventEmail.updateMany({
          where: { fragmentId, name: targetName },
          data: { content: newContent },
        });

        if (updateResult.count === 0) {
          await prisma.eventEmail.create({
            data: { fragmentId, name: targetName, content: newContent },
          });
        }
      }

      await publishers.publishFragmentUpdate("emails", updatedEmails);
      return `Email "${targetName}" modified successfully.`;
    });
  },
});
