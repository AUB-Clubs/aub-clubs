import { AgentResult, TextMessage } from "@inngest/agent-kit"

export function extractTaskSummary(text: string | null | undefined) {
  if (!text) return ""

  const tagged = text.match(/<task_summary>([\s\S]*?)<\/task_summary>/i)?.[1]
  if (tagged) {
    return tagged.trim()
  }

  return text.replaceAll("<task_summary>", "").replaceAll("</task_summary>", "").trim()
}

export function lastAssistantTextMessageContent(result: AgentResult) {
  const output = Array.isArray(result.output) ? result.output : []

  for (let i = output.length - 1; i >= 0; i -= 1) {
    const candidate = output[i]
    if (candidate?.role !== "assistant") {
      continue
    }

    const message = candidate as TextMessage
    if (!message.content) {
      continue
    }

    if (typeof message.content === "string") {
      return message.content
    }

    return message.content
      .map((part) =>
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("")
  }

  return undefined
}
