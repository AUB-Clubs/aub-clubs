import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublishFn = (opts: {
  channel: string;
  topic: string;
  data: Record<string, unknown>;
}) => Promise<void>;

export interface Publishers {
  /** Stream a thinking/status chunk to the chat left pane */
  publishChunk: (text: string) => Promise<void>;
  /** Send a realtime event (HIL awaiting / hil_completed) */
  publish: PublishFn;
  /** Push updated fragment data to the right pane workspace */
  publishFragmentUpdate: (
    type: FragmentUpdateType,
    data: unknown
  ) => Promise<void>;
}

export type FragmentUpdateType =
  | "event_details"
  | "report"
  | "emails"
  | "posts"
  | "image";

// ─── Factory ──────────────────────────────────────────────────────────────────
// Called once in the main Inngest function, receives the realtime publish fn
// and the messageId of the current assistant message (for chunk ordering).
// Returns a Publishers object that gets stored and used by all tools.

export function createPublishers(opts: {
  publish: PublishFn;
  clubId: string;
  projectId: string;
  messageId: string;
}): Publishers {
  const { publish, clubId, projectId, messageId } = opts;

  // Canonical channel: scoped to club → project so subscribers can filter at any level
  const channel = `club:${clubId}:project:${projectId}`;

  const publishChunk: Publishers["publishChunk"] = async (text) => {
    const chunk = await prisma.messageChunk.create({
      data: { messageId, response: text },
    });

    await publish({
      channel,
      topic: "ai",
      data: {
        type: "chunk",
        clubId,
        projectId,
        messageId,
        text,
        chunkId: chunk.id,
        sequence: chunk.sequence,
      },
    });
  };

  const publishFragmentUpdate: Publishers["publishFragmentUpdate"] = async (
    type,
    data
  ) => {
    await publish({
      channel,
      topic: "ai",
      data: { type: "fragment_update", clubId, projectId, updateType: type, payload: data },
    });
  };

  return { publishChunk, publish, publishFragmentUpdate };
}
