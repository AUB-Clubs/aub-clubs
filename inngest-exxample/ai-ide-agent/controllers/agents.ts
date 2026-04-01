import express, { Router } from "express"
import { inngest } from "../utils/inngest/client"

const agentsRouter: Router = express.Router()

agentsRouter.post("/run", async (req, res) => {
  console.log(`[agentsRouter.POST] Received request to run code agent`)
  const { message, projectId } = req.body
  console.log(`[agentsRouter.POST] ProjectId: ${projectId}, Message length: ${message?.length || 0}`)

  if (!message || !projectId) {
    console.warn(`[agentsRouter.POST] Validation failed - Missing required fields: message=${!!message}, projectId=${!!projectId}`)
    res.status(400).json({ error: "message and projectId are required" })
  } else {
    try {
      console.log(`[agentsRouter.POST] Sending event to Inngest: code-agent/run`)
      await inngest.send({
        name: "code-agent/run",
        data: {
          value: message,
          projectId: projectId,
        },
      })
      console.log(`[agentsRouter.POST] Event sent successfully to Inngest for project: ${projectId}`)
  
      res.status(201).json({ message: "Event sent to Inngest!" })
    } catch (error) {
      console.error("Failed to send Inngest event:", error)
      res.status(500).json({ error: "Failed to trigger agent" })
    }
  }
})

agentsRouter.post("/activation-request", async (req, res) => {
  console.log(`[agentsRouter.POST] Received request to run code agent`)
  const { choice, projectId, agentRunID } = req.body
  console.log(`[agentsRouter.POST] Choice: ${choice}, ProjectId: ${projectId}`)

  if (!choice || !projectId) {
    console.warn(`[agentsRouter.POST] Validation failed - Missing required field: choice=${!!choice}`)
    res.status(400).json({ error: "choice is required" })
  } else {
    try {
      console.log(`[agentsRouter.POST] Sending event to Inngest: code-agent-activation-request/run`)
      await inngest.send({
        name: "code-agent-activation-request/run",
        data: {
          projectId: projectId,
          choice: choice,
          agentRunID: agentRunID,
        },
      })

      console.log(`[agentsRouter.POST] Event sent successfully to Inngest for choice: ${choice}`)
  
      res.status(201).json({ message: "Event sent to Inngest!" })
    } catch (error) {
      console.error("Failed to send Inngest event:", error)
      res.status(500).json({ error: "Failed to trigger agent" })
    }
  }
})

export default agentsRouter
