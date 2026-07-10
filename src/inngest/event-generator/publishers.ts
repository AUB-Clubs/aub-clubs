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
// Called once in the main Inngest function. Returns a Publishers object used
// by all tools.
//
// Step wrapping policy:
//   - Publisher methods DO NOT call step.run themselves. Each tool handler
//     already wraps its body in step.run(...), so publish calls made from
//     inside a handler are covered by that parent step and do not need (and
//     must not add) their own step wrapping — otherwise we nest steps.
//   - The MessageChunk DB insert inside publishChunk is a plain async prisma
//     call, NOT a step. It's fine to await directly because it runs inside
//     the parent step.run of the calling tool.

export function createPublishers(opts: {
  publish: PublishFn;
  clubId: string;
  projectId: string;
  messageId: string;
}): Publishers {
  const { publish, clubId, projectId, messageId } = opts;

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
      data: {
        type: "fragment_update",
        clubId,
        projectId,
        updateType: type,
        payload: data,
      },
    });
  };

  return { publishChunk, publish, publishFragmentUpdate };
}
