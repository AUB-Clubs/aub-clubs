import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

export const get_logged_event_data = createTool<AgentState>({
  name: "get_logged_event_data",
  description: "Retrieves all logged event data: scale, type, topic, selected idea, speakers, sponsors, and buildings.",
  parameters: z.object({
    explanation: z.string(),
  }),
  handler: async ({ explanation }, { network }) => {
    const { projectId, publishers } = network!.state.data;
    const state = network!.state.data;

    await publishers.publishChunk(explanation);

    const hasStateData =
      state.scale || state.type || state.topic ||
      state.speakers?.length || state.sponsors?.length || state.buildings?.length;

    if (hasStateData) {
      return JSON.stringify({
        scale: state.scale,
        type: state.type,
        topic: state.topic,
        selectedIdea: state.selectedIdea,
        speakers: state.speakers,
        sponsors: state.sponsors,
        buildings: state.buildings,
      });
    }

    // DB fallback: latest completed fragment for this project
    const prevFragment = await prisma.fragment.findFirst({
      where: {
        message: { projectId },
        completedAt: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: {
        eventDetails: true,
        eventSpeakers: true,
        eventSponsors: true,
        eventBuildings: true,
      },
    });

    if (!prevFragment) return "No event data logged yet.";

    const { eventDetails, eventSpeakers, eventSponsors, eventBuildings } = prevFragment;

    // Populate state cache
    if (eventDetails) {
      network!.state.data.scale = eventDetails.scale ?? "";
      network!.state.data.type = eventDetails.type ?? "";
      network!.state.data.topic = eventDetails.topic ?? "";
      network!.state.data.selectedIdea = eventDetails.selectedIdea ?? "";
    }
    network!.state.data.speakers = eventSpeakers.map((s) => ({
      name: s.name, title: s.title, sessionFocus: s.sessionFocus, why: s.why,
    }));
    network!.state.data.sponsors = eventSponsors.map((s) => ({
      name: s.name, type: s.type, specificContribution: s.specificContribution, why: s.why,
    }));
    network!.state.data.buildings = eventBuildings.map((b) => ({
      name: b.name, why: b.why,
    }));

    return JSON.stringify({
      scale: eventDetails?.scale,
      type: eventDetails?.type,
      topic: eventDetails?.topic,
      selectedIdea: eventDetails?.selectedIdea,
      speakers: network!.state.data.speakers,
      sponsors: network!.state.data.sponsors,
      buildings: network!.state.data.buildings,
    });
  },
});
