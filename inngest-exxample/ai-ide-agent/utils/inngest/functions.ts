import { createNetwork, createState } from "@inngest/agent-kit"
import { inngest } from "./client"
import { availableScriptsNames, isScriptNameUsed, responseGenerator, sanitizeResponse, addScript } from "./utils"
import { DESCRIPTION_PROMPT, SCRIPT_NAME_PROMPT } from "./prompt"
import { prisma } from "../db"
import { AIIDEProject } from "../../generated/prisma"
import type { AgentState } from "./agents"
import { codeAgent } from "./agents"

const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step, publish }: { event: any; step: any, publish: any }) => {
    console.log(`[codeAgentFunction] Starting code agent function for project: ${event.data.projectId}`)
    console.log(`[codeAgentFunction] Request value: "${event.data.value}"`)

    const publisher = async (response: string, messageID?: string) => {
      console.log(`[codeAgentFunction/publisher] Publishing update to channel project:${event.data.projectId}, messageID: ${messageID}`)
      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "ai",
        data: {
          response,
        }
      })
      if (messageID) {
        // Sanitize response to remove problematic UTF-8 characters that can't be stored in WIN1252
        const sanitizedResponse = response
          ? sanitizeResponse(response)
          : response

        await prisma.aIIDEMessageChunk.create({
          data: {
            response: sanitizedResponse,
            messageId: messageID
          }
        })
      }
    }

    const stepStartPublisher = async (stepName: string, runId: string) => {
      console.log(`[codeAgentFunction/stepStartPublisher] Publishing step start update to channel run:${event.data.projectId}, runId: ${runId}`)

      const createdAt = new Date().toISOString()
      let stepId: string | undefined

      if (runId) {
        const step = await prisma.aIIDEAgentStep.create({
          data: {
            runId: runId,
            stepName: stepName,
            stepStatus: "STARTED",
            createdAt: createdAt,
            updatedAt: createdAt,
          }
        })
        stepId = step.id
      }

      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "agentlogs",
        data: {
          stepId: stepId,
          stepName: stepName,
          stepStatus: "STARTED",
          createdAt: createdAt,
          runId: runId
        }
      })

      return stepId
    }

    const stepEndPublisher = async (stepName: string, stepOutput: string, runId: string, stepId: string) => {
      console.log(`[codeAgentFunction/stepEndPublisher] Publishing step end update to channel run:${event.data.projectId}, runId: ${runId}`)

      const updatedAt = new Date().toISOString()

      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "agentlogs",
        data: {
          stepId: stepId,
          stepName: stepName,
          stepOutput: stepOutput,
          stepStatus: "ENDED",
          updatedAt: updatedAt,
          runId: runId
        }
      })

      if (runId && stepId) {
        await prisma.aIIDEAgentStep.update({
          where: { id: stepId },
          data: {
            stepOutput: stepOutput,
            stepStatus: "ENDED",
            updatedAt: updatedAt,
          }
        })
      }
    }

    const agentRunID: string = await step.run("create-agent-run", async () => {
      const latestUserMessage = await prisma.aIIDEMessage.findFirst({
        where: {
          projectId: event.data.projectId,
          role: "USER"
        },
        orderBy: {
          createdAt: "desc"
        }
      })

      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "ai",
        data: {
          type: "user_message_created",
          message: latestUserMessage
        }
      })

      console.log(`[codeAgentFunction] Creating agent run entry in database for project: ${event.data.projectId}`)
      const run = await prisma.aIIDEAgentRun.create({
        data: {
          projectId: event.data.projectId,
          runStatus: "RUNNING",
        }
      })

      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "agentlogs",
        data: {
          type: "agent_run_created",
          run: run
        }
      })

      console.log(`[codeAgentFunction] Agent run created with ID: ${run.id}`)
      const stepId = await stepStartPublisher("create-agent-run", run.id)
      await stepEndPublisher("create-agent-run", run.id, run.id, stepId as unknown as string)
      return run.id
    })

    const agentMessageID: string = await step.run("create-initial-message", async () => {
      console.log(`[codeAgentFunction] Creating initial message in database for project: ${event.data.projectId}`)
      const stepId = await stepStartPublisher("create-initial-message", agentRunID)
      const agentMessage = await prisma.aIIDEMessage.create({
        data: {
          projectId: event.data.projectId,
          content: "",
          role: "ASSISTANT",
          type: "RESULT",
        }
      })
      await stepEndPublisher("create-initial-message", agentMessage.id, agentRunID, stepId as unknown as string)

      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "ai",
        data: {
          type: "placeholder_agent_message_created",
          message: agentMessage
        }
      })

      return (agentMessage).id
    })

    const project = await step.run("get-project", async () => {
      const stepId = await stepStartPublisher("get-project", agentRunID)
      console.log(`[codeAgentFunction] Fetching project from database: ${event.data.projectId}`)
      const result = await prisma.aIIDEProject.findUnique({ where: { id: event.data.projectId } }) as AIIDEProject
      console.log(`[codeAgentFunction] Project retrieved:`, result?.name)
      await stepEndPublisher("get-project", JSON.stringify(result), agentRunID, stepId as unknown as string)
      return result
    })

    const generatedScriptName = await step.run("generate-script-name", async () => {
      if (!project.scriptName) {
        const stepId = await stepStartPublisher("generate-script-name", agentRunID)
        console.log(`[codeAgentFunction] Script name is missing, generating script name`)
        const usedScriptsNames = await availableScriptsNames()
        let generatedScriptName = await responseGenerator({
          stepName: "script-name-generator",
          prompt: SCRIPT_NAME_PROMPT(usedScriptsNames),
          default: project?.name || "automation-script",
          request: `Generate a unique script name for the following request: ${event.data.value}`,
        })

        generatedScriptName = generatedScriptName.replaceAll("\n", "").trim()

        if (await isScriptNameUsed(generatedScriptName)) {
          console.log(`[codeAgentFunction] Generated script name "${generatedScriptName}" is already used, retrying to ensure uniqueness`)
          let retryCount = 0
          const maxRetries = 5
          let uniqueNameFound = false

          while (retryCount < maxRetries && !uniqueNameFound) {
            generatedScriptName = await responseGenerator({
              stepName: `script-name-generator-retry-${retryCount + 1}`,
              prompt: SCRIPT_NAME_PROMPT(usedScriptsNames),
              default: project?.name || "automation-script",
              request: `Generate a unique script name for the following request: ${event.data.value} (This is retry ${retryCount + 1} because the previous name (${generatedScriptName}) was already used.)`,
            })

            generatedScriptName = (generatedScriptName || "").replaceAll("\n", "").trim()

            if (!(await isScriptNameUsed(generatedScriptName))) {
              uniqueNameFound = true
              console.log(`[codeAgentFunction] Unique script name found: "${generatedScriptName}"`)
            } else {
              console.log(`[codeAgentFunction] Script name "${generatedScriptName}" is still used, retrying...`)
              retryCount++
            }
          }

          if (!uniqueNameFound) {
            console.log(`[codeAgentFunction] Failed to generate a unique script name after ${maxRetries} retries, appending timestamp to ensure uniqueness`)
            generatedScriptName = `${generatedScriptName}_project_${event.data.projectId}`.replaceAll(" ", "_").replaceAll("-", "_").toLowerCase()
          }
        }

        await stepEndPublisher("generate-script-name", generatedScriptName, agentRunID, stepId as unknown as string)
        console.log(`[codeAgentFunction] Saving generated script name to database: "${generatedScriptName}"`)
        await prisma.aIIDEProject.update({
          where: { id: event.data.projectId },
          data: { scriptName: generatedScriptName }
        })

        await publish({
          channel: `project:${event.data.projectId}`,
          topic: "ai",
          data: {
            type: "project_updated",
            project: {
              scriptName: generatedScriptName
            }
          }
        })

        await publisher(`Generated script name: ${generatedScriptName}`, agentMessageID || undefined)
        return generatedScriptName
      }
      return project.scriptName
    })

    if (generatedScriptName) {
      project.scriptName = generatedScriptName
    }

    const generatedScriptDescription = await step.run("generate-script-description", async () => {
      if (!project.scriptDescription) {
        const stepId = await stepStartPublisher("generate-script-description", agentRunID)
        console.log(`[codeAgentFunction] Generating script description`)
        const genDesc = await responseGenerator({
          stepName: "description-generator",
          prompt: DESCRIPTION_PROMPT,
          default: "AI-generated automation script",
          request: `Generate a concise description for a script named "${project.scriptName}" that fulfills the following request: ${event.data.value}`,
        })
        console.log(`[codeAgentFunction] Description generated: "${genDesc.substring(0, 100)}..."`)
        await stepEndPublisher("generate-script-description", genDesc, agentRunID, stepId as unknown as string)

        console.log(`[codeAgentFunction] Saving script description to database`)
        await prisma.aIIDEProject.update({
          where: { id: event.data.projectId },
          data: { scriptDescription: genDesc }
        })

        await publish({
          channel: `project:${event.data.projectId}`,
          topic: "ai",
          data: {
            type: "project_updated",
            project: {
              scriptDescription: genDesc
            }
          }
        })

        await publisher(`Generated script description ${(genDesc || "").trim().substring(0, 50)}...`, agentMessageID || undefined)
        return genDesc
      }
      return project.scriptDescription
    })

    if (generatedScriptDescription) {
      project.scriptDescription = generatedScriptDescription
    }

    await step.run("provision-initial-script", async () => {
      console.log(`[codeAgentFunction] Provisioning initial empty script to Overmind`)
      console.log(`[codeAgentFunction] Name: ${project.scriptName}, Description: ${(project.scriptDescription || "").substring(0, 50)}...`)
      const stepId = await stepStartPublisher("provision-initial-script", agentRunID)

      const files = await prisma.aIIDEFile.findMany({ where: { projectId: event.data.projectId } })
      if (files.length !== 0) {
        console.log(`[codeAgentFunction] Project already has files, skipping initial script provisioning`)
        await stepEndPublisher("provision-initial-script", `Skipped provisioning initial script as project already has files`, agentRunID, stepId as unknown as string)
        return `Skipped provisioning initial script as project already has files`
      }

      try {
        const script = await addScript(
          {},
          project.scriptName as string,
          project.scriptDescription as string,
        )

        console.log(`[codeAgentFunction] Initial script provisioned with ID: ${script.scriptConfigId}`)

        await prisma.aIIDEAIScript.create({
          data: {
            projectId: event.data.projectId,
            scriptConfigId: script.scriptConfigId,
            created: script.created,
            createdBy: script.createdBy
          }
        })

        await publish({
          channel: `project:${event.data.projectId}`,
          topic: "ai",
          data: {
            type: "script_created",
            script: {
              scriptConfigId: script.scriptConfigId,
              created: script.created,
              createdBy: script.createdBy,
              projectId: event.data.projectId
            },
            files: {}
          }
        })

        await stepEndPublisher("provision-initial-script", `Provisioned initial script: ${script.scriptConfigId}`, agentRunID, stepId as unknown as string)
        return script.scriptConfigId
      } catch (e) {
        console.error(`[codeAgentFunction] Error provisioning initial script:`, e)
        await stepEndPublisher("provision-initial-script", `Error provisioning script: ${e instanceof Error ? e.message : String(e)}`, agentRunID, stepId as unknown as string)
        return `Error provisioning script: ${e instanceof Error ? e.message : String(e)}`
      }
    })

    const filePublisher = async (files: { [path: string]: string }, deletedFiles?: string[]) => {
      console.log(`[codeAgentFunction/filePublisher] Publishing file updates to channel project:${event.data.projectId}`)
      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "ai",
        data: {
          type: "files_updated",
          files: files,
          deletedFiles: deletedFiles || []
        }
      })
    }

    const latestScript = await prisma.aIIDEAIScript.findFirst({
      where: { projectId: event.data.projectId },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`[codeAgentFunction] Creating agent state for thread: ${event.data.projectId}`)
    const state = createState<AgentState>(
      {
        summary: "",
        error: "",
        files: await prisma.aIIDEFile.findMany({ where: { projectId: event.data.projectId } }).then(files => {
          const fileMap: { [path: string]: string } = {}
          files.forEach(file => {
            fileMap[file.path] = file.content
          })
          return fileMap
        }),
        filesUpdated: false,
        project: await prisma.aIIDEProject.findUnique({ where: { id: event.data.projectId } }) as AIIDEProject,
        publisher,
        filePublisher,
        stepStartPublisher,
        stepEndPublisher,
        agentMessageID: agentMessageID || undefined,
        agentRunID: agentRunID || undefined,
        scriptId: latestScript?.scriptConfigId || undefined,
        publish
      },
      {
        threadId: event.data.projectId,
      }
    )

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 100,
      defaultState: state,
      router: async ({ network }) => {
        if (network.state.data.summary || network.state.data.error) {
          console.log(`[codeAgentFunction/router] Task completed or error occurred, stopping router`)
          return undefined
        }
        return codeAgent
      },
    })

    console.log(`[codeAgentFunction] Running network with input value`)
    const result = await network.run(event.data.value, { state })
    console.log(`[codeAgentFunction] Network execution completed`)
    console.log(`[codeAgentFunction] Result - Error: ${!!result.state.data.error}, Files: ${Object.keys(result.state.data.files).length}`)

    const isError = !!result.state.data.error

    await step.run("save-result", async () => {
      console.log(`[codeAgentFunction] Saving result message, isError: ${isError}`)
      const stepId = await stepStartPublisher("save-result", agentRunID)
      let message

      if (isError) {
        console.log(`[codeAgentFunction] Creating error message in database`)
        if (agentMessageID) {
          message = await prisma.aIIDEMessage.update({
            where: {
              id: agentMessageID
            },
            data: {
              content: result.state.data.error.replaceAll("<agent_error>\n", "").replaceAll("<agent_error>", "").replaceAll("</agent_error>", "").replaceAll("\n</agent_error>", "") || "An unknown error occurred.",
              type: "ERROR"
            }
          })
        } else {
          message = await prisma.aIIDEMessage.create({
            data: {
              projectId: event.data.projectId,
              content: result.state.data.error.replaceAll("<agent_error>\n", "").replaceAll("<agent_error>", "").replaceAll("</agent_error>", "").replaceAll("\n</agent_error>", "") || "An unknown error occurred.",
              role: "ASSISTANT",
              type: "ERROR"
            }
          })
        }
      } else {
        console.log(`[codeAgentFunction] Creating success message in database`)
        if (agentMessageID) {
          message = await prisma.aIIDEMessage.update({
            where: {
              id: agentMessageID
            },
            data: {
              content: result.state.data.summary.replaceAll("<task_summary>\n", "").replaceAll("\n<task_summary>", "").replaceAll("<task_summary>", "").replaceAll("</task_summary>", "").replaceAll("\n</task_summary>", "").replaceAll("</task_summary>\n", "") || "Script generated successfully.",
              type: "RESULT"
            }
          })
        } else {
          message = await prisma.aIIDEMessage.create({
            data: {
              projectId: event.data.projectId,
              content: result.state.data.summary.replaceAll("<task_summary>\n", "").replaceAll("\n<task_summary>", "").replaceAll("<task_summary>", "").replaceAll("</task_summary>", "").replaceAll("\n</task_summary>", "").replaceAll("</task_summary>\n", "") || "Script generated successfully.",
              role: "ASSISTANT",
              type: "RESULT"
            }
          })
        }
      }
      await stepEndPublisher("save-result", JSON.stringify(message), agentRunID, stepId as unknown as string)
      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "ai",
        data: {
          type: "agent_message_closed",
          message: message
        }
      })
      await publish({
        channel: `project:${event.data.projectId}`,
        topic: "agentlogs",
        data: {
          type: "agent_run_closed",
          run: agentRunID
        }
      })
      await prisma.aIIDEAgentRun.update({
        where: { id: agentRunID },
        data: { runStatus: "COMPLETED", updatedAt: new Date() }
      })
      return message
    })

    console.log(`[codeAgentFunction] Function execution completed successfully`)
    console.log(`[codeAgentFunction] Returning result with title: ${result.state.data.project.scriptName}`)
    return {
      title: result.state.data.project.scriptName,
      files: result.state.data.files,
      summary: result.state.data.summary.replaceAll("<task_summary>\n", "").replaceAll("\n<task_summary>", "").replaceAll("<task_summary>", "").replaceAll("</task_summary>", "").replaceAll("\n</task_summary>", "").replaceAll("</task_summary>\n", "") || "Script generated successfully."
    }
  }
)

export const functions = [codeAgentFunction]