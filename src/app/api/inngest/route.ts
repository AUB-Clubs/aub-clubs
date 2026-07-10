import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { eventFunction } from "@/inngest/function"
import { eventGeneratorFunction } from "@/inngest/event-generator/function"

export const maxDuration = 300;
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    eventFunction,
    eventGeneratorFunction,
  ],
})
