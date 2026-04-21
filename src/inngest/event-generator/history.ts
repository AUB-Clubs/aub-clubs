import { prisma } from "@/lib/prisma";
import type { Message } from "@inngest/agent-kit";

/**
 * Loads the last `limit` messages for a project and formats them
 * as agent-kit Message objects for use in createState({ messages }).
 */
export async function loadConversationHistory(
  projectId: string,
  limit = 20
): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return messages
    .filter((m) => m.content)
    .map((m): Message => ({
      type: "text",
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content!,
    }));
}
