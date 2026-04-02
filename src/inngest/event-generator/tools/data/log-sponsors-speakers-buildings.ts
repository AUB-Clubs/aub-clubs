import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AgentState } from "../../types";

const SpeakerSchema = z.object({
  name: z.string(),
  title: z.string(),
  sessionFocus: z.string(),
  why: z.string(),
});

const SponsorSchema = z.object({
  name: z.string(),
  type: z.string(),
  specificContribution: z.string(),
  why: z.string(),
});

const BuildingSchema = z.object({
  name: z.string(),
  why: z.string(),
});

export const log_sponsors_speakers_buildings = createTool<AgentState>({
  name: "log_sponsors_speakers_buildings",
  description: "Logs the selected speakers, sponsors, and buildings from the research phase to state and DB.",
  parameters: z.object({
    explanation: z.string(),
    speakers_list: z.array(SpeakerSchema),
    sponsors_list: z.array(SponsorSchema),
    buildings_list: z.array(BuildingSchema),
  }),
  handler: async ({ explanation, speakers_list, sponsors_list, buildings_list }, { network }) => {
    const { fragmentId, publishers } = network!.state.data;

    await publishers.publishChunk(explanation);

    // Save to state
    network!.state.data.speakers = speakers_list;
    network!.state.data.sponsors = sponsors_list;
    network!.state.data.buildings = buildings_list;

    // Save to DB (current incomplete fragment)
    if (fragmentId) {
      await prisma.$transaction([
        prisma.eventSpeaker.deleteMany({ where: { fragmentId } }),
        prisma.eventSponsor.deleteMany({ where: { fragmentId } }),
        prisma.eventBuilding.deleteMany({ where: { fragmentId } }),
        prisma.eventSpeaker.createMany({
          data: speakers_list.map((s) => ({ fragmentId, ...s })),
        }),
        prisma.eventSponsor.createMany({
          data: sponsors_list.map((s) => ({ fragmentId, ...s })),
        }),
        prisma.eventBuilding.createMany({
          data: buildings_list.map((b) => ({ fragmentId, ...b })),
        }),
      ]);
    }

    return "Speakers, sponsors, and buildings logged successfully.";
  },
});
