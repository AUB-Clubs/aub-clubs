import { createTool, createAgent, openai } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";
import { getAubAdminEmailPrompt } from "../../prompts/emails/aub-admin";
import { getAnnouncementEmailPrompt } from "../../prompts/emails/announcement";
import { getSponsorEmailPrompt } from "../../prompts/emails/sponsor";
import { getSpeakerEmailPrompt } from "../../prompts/emails/speaker";

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
  description: "Generates or modifies outreach emails. For new emails generates all concurrently. For edits targets a specific email by name.",
  parameters: z.object({
    type: z.enum(["generate_new_emails", "modify_existing_email"]),
    explanation: z.string(),
    email_name: z.string().optional().describe("Name of email to modify. Empty for new generation."),
    edits_requested: z.string().optional().describe("Requested changes. Empty for new generation."),
  }),
  handler: async ({ type, explanation, email_name, edits_requested }, { network }) => {
    const { fragmentId, projectId, publishers } = network!.state.data;
    const state = network!.state.data;

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
          const agent = createAgent({
            name: `email-agent-${name}`,
            system: buildEmailPrompt(name, eventReport, clubName, state),
            model: openai({ model: "gpt-5.4" }),
          });
          const { output } = await agent.run("Generate the email now.");
          const content =
            output[0]?.type === "text"
              ? Array.isArray(output[0].content)
                ? output[0].content.join("")
                : output[0].content
              : "";
          return { name, content };
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

    const agent = createAgent({
      name: `email-agent-edit`,
      system: buildEmailPrompt(targetName, eventReport, clubName, state, previousContent, edits_requested),
      model: openai({ model: "gpt-5.4" }),
    });
    const { output } = await agent.run("Modify the email now.");
    const newContent =
      output[0]?.type === "text"
        ? Array.isArray(output[0].content)
          ? output[0].content.join("")
          : output[0].content
        : "";

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
