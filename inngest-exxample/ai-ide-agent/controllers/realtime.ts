import { inngest } from "../utils/inngest/client"
import { getSubscriptionToken } from "@inngest/realtime"
import express, { Router } from "express"
import { prisma } from "../utils/db"

export const realtimeRouter: Router = express.Router()

realtimeRouter.post("/", async (req, res): Promise<void> => {
  const { projectId } = req.body

  // Verify project exists
  const project = await prisma.aIIDEProject.findUnique({
    where: { id: projectId }
  })

  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  const token = await getSubscriptionToken(inngest, {
    channel: `project:${projectId}`,
    topics: ["ai"],
  }) as any

  res.status(200).json({ token })
})

realtimeRouter.post("/agentlogs", async (req, res): Promise<void> => {
  // Verify project exists
  const { projectId } = req.body

  // Verify project exists
  const project = await prisma.aIIDEProject.findUnique({
    where: { id: projectId }
  })

  if (!project) {
    res.status(404).json({ error: "Project not found" })
    return
  }

  const token = await getSubscriptionToken(inngest, {
    channel: `project:${projectId}`,
    topics: ["agentlogs"],
  })

  res.status(200).json({ token })
})