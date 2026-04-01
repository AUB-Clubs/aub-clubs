import express from "express"
import { serve } from "inngest/express"
import { inngest } from "./utils/inngest/client"
import cors from "cors"
import morgan from "morgan"
import agentsRouter from "./controllers/agents"
import scriptsRouter from "./controllers/scripts"
import { functions } from "./utils/inngest/functions"
import { realtimeRouter } from "./controllers/realtime"

const app = express()

app.use(cors())
app.use(express.json({ limit: "500mb" }))

morgan.token('body', (req: express.Request) => {
  return JSON.stringify(req.body)
})

app.use(morgan(':method :url :status :res[content-length] :response-time ms :body'))

app.use("/api/inngest", serve({ client: inngest, functions }))
app.use("/api/agents", agentsRouter)
app.use("/api/scripts", scriptsRouter)
app.use("/api/get-subscribe-token", realtimeRouter)

// Log all registered routes for debugging
console.log("[app] Registered routes:")
console.log("  - /api/inngest")
console.log("  - /api/agents")
console.log("  - /api/scripts")
console.log("  - /api/get-subscribe-token")

export default app