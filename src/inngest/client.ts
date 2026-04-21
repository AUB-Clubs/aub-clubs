import { Inngest } from "inngest"
import { realtimeMiddleware } from "@inngest/realtime/middleware"

export const inngest = new Inngest({
  id: "events-aub-clubs",
  name: "AUB Clubs Events",
  middleware: [realtimeMiddleware()],
})
