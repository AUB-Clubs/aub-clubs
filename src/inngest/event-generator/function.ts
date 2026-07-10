import { createNetwork, createState } from "@inngest/agent-kit";
import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { createPublishers, type PublishFn } from "./publishers";
import { getMainAgentPrompt } from "./prompts/main-agent";
import { loadConversationHistory } from "./history";
import { createEventGeneratorAgent } from "./agent";
import type { AgentState } from "./types";

export const eventGeneratorFunction = inngest.createFunction(
  { id: "event-generator" },
  { event: "event-generator/run" },
  async ({ event, step, publish }: { event: any; step: any; publish: any }) => {
    const { projectId, value } = event.data as {
      projectId: string;
      value: string;
    };

    // ── 1. Load project + club ────────────────────────────────────────────────
    const project = await step.run("load-project", async () => {
      return prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        include: {
          club: {
            include: {
              _count: {
                select: { memberships: { where: { status: "ACCEPTED" } } },
              },
            },
          },
        },
      });
    });

    const { club } = project;
    const clubId = project.clubId;
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();

    // ── 2. Load conversation history ─────────────────────────────────────────
    const previousMessages = await step.run("load-history", async () => {
      return loadConversationHistory(projectId, 20);
    });

    // ── 3. Create placeholder ASSISTANT message ───────────────────────────────
    const assistantMessage = await step.run(
      "create-assistant-message",
      async () => {
        return prisma.message.create({
          data: { projectId, role: "ASSISTANT", content: null },
        });
      }
    );

    // ── 4. Create Fragment with rolled-over data from previous completed fragment
    const fragment = await step.run("create-fragment", async () => {
      const prev = await prisma.fragment.findFirst({
        where: { message: { projectId }, completedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        include: {
          eventDetails: true,
          eventReport: true,
          eventSpeakers: true,
          eventSponsors: true,
          eventBuildings: true,
          eventEmails: true,
          eventPosts: true,
          eventImage: true,
        },
      });

      return prisma.fragment.create({
        data: {
          messageId: assistantMessage.id,
          eventDetails: prev?.eventDetails
            ? {
                create: {
                  scale: prev.eventDetails.scale,
                  type: prev.eventDetails.type,
                  topic: prev.eventDetails.topic,
                  selectedIdea: prev.eventDetails.selectedIdea,
                },
              }
            : undefined,
          eventReport: prev?.eventReport
            ? { create: { markdown: prev.eventReport.markdown } }
            : undefined,
          eventSpeakers: prev?.eventSpeakers?.length
            ? {
                create: prev.eventSpeakers.map((s) => ({
                  name: s.name,
                  title: s.title,
                  sessionFocus: s.sessionFocus,
                  why: s.why,
                })),
              }
            : undefined,
          eventSponsors: prev?.eventSponsors?.length
            ? {
                create: prev.eventSponsors.map((s) => ({
                  name: s.name,
                  type: s.type,
                  specificContribution: s.specificContribution,
                  why: s.why,
                })),
              }
            : undefined,
          eventBuildings: prev?.eventBuildings?.length
            ? {
                create: prev.eventBuildings.map((b) => ({
                  name: b.name,
                  why: b.why,
                })),
              }
            : undefined,
          eventEmails: prev?.eventEmails?.length
            ? {
                create: prev.eventEmails.map((e) => ({
                  name: e.name,
                  content: e.content,
                })),
              }
            : undefined,
          eventPosts: prev?.eventPosts?.length
            ? {
                create: prev.eventPosts.map((p) => ({
                  platform: p.platform,
                  content: p.content,
                })),
              }
            : undefined,
          eventImage: prev?.eventImage
            ? {
                create: {
                  supabaseUrl: prev.eventImage.supabaseUrl,
                  prompt: prev.eventImage.prompt ?? undefined,
                },
              }
            : undefined,
        },
        include: {
          eventDetails: true,
          eventReport: true,
          eventSpeakers: true,
          eventSponsors: true,
          eventBuildings: true,
          eventEmails: true,
          eventPosts: true,
          eventImage: true,
        },
      });
    });

    // ── 5. Publish fragment_started ───────────────────────────────────────────
    // Every publish is wrapped in its own step.run so it runs inside a step
    // context (either the tool's parent step or a dedicated one here).
    const realtimeChannel = `club:${clubId}:project:${projectId}`;
    await step.run("publish:fragment-started", () =>
      publish({
        channel: realtimeChannel,
        topic: "ai",
        data: {
          type: "fragment_started",
          fragmentId: fragment.id,
          clubId,
          projectId,
        },
      })
    );

    // ── 6. Build publishers + initial state ──────────────────────────────────
    const publishFn: PublishFn = (opts) => publish(opts);

    const publishers = createPublishers({
      publish: publishFn,
      clubId,
      projectId,
      messageId: assistantMessage.id,
    });

    const initialState: AgentState = {
      clubId,
      projectId,
      fragmentId: fragment.id,
      club: {
        name: club.title,
        description: club.description,
        memberSize: club._count.memberships,
      },
      date,
      time,
      summary: "",
      publishers,
      // Rolled-over data
      scale: fragment.eventDetails?.scale ?? "",
      type: fragment.eventDetails?.type ?? "",
      topic: fragment.eventDetails?.topic ?? "",
      selectedIdea: fragment.eventDetails?.selectedIdea ?? "",
      speakers: (fragment.eventSpeakers ?? []).map((s) => ({
        name: s.name,
        title: s.title,
        sessionFocus: s.sessionFocus,
        why: s.why,
      })),
      sponsors: (fragment.eventSponsors ?? []).map((s) => ({
        name: s.name,
        type: s.type,
        specificContribution: s.specificContribution,
        why: s.why,
      })),
      buildings: (fragment.eventBuildings ?? []).map((b) => ({
        name: b.name,
        why: b.why,
      })),
      report: fragment.eventReport?.markdown ?? "",
      emails: (fragment.eventEmails ?? []).map((e) => ({
        name: e.name,
        content: e.content,
      })),
      posts: (fragment.eventPosts ?? []).map((p) => ({
        platform: p.platform,
        content: p.content,
      })),
      postImageUrl: fragment.eventImage?.supabaseUrl ?? "",
    };

    // ── 7. Build and run agent network ────────────────────────────────────────
    const systemPrompt = getMainAgentPrompt({
      clubName: club.title,
      clubDescription: club.description,
      memberSize: club._count.memberships,
      date,
      time,
    });

    const agent = createEventGeneratorAgent(systemPrompt);

    const state = createState<AgentState>(initialState, {
      messages: previousMessages,
    });

    const network = createNetwork<AgentState>({
      name: "event-generator-network",
      agents: [agent],
      maxIter: 50,
      defaultState: state,
      router: async ({ network }) => {
        if (network.state.data.summary) return;
        return agent;
      },
    });

    await network.run(value, { state });

    // ── 8. Mark fragment completed + update message content ───────────────────
    await step.run("complete-fragment", async () => {
      const cleanSummary = network.state.data.summary.trim();

      await prisma.fragment.update({
        where: { id: fragment.id },
        data: { completedAt: new Date() },
      });

      if (cleanSummary) {
        await prisma.message.update({
          where: { id: assistantMessage.id },
          data: { content: cleanSummary },
        });
      }
    });

    // ── 9. Publish fragment_completed ─────────────────────────────────────────
    await step.run("publish:fragment-completed", () =>
      publish({
        channel: realtimeChannel,
        topic: "ai",
        data: {
          type: "fragment_completed",
          fragmentId: fragment.id,
          clubId,
          projectId,
        },
      })
    );

    return { fragmentId: fragment.id };
  }
);
