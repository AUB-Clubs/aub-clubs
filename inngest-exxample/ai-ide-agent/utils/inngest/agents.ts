import { createAgent, createTool, Tool } from "@inngest/agent-kit"
import z from "zod"
import { prisma } from "../db"
import { ProjectResult, findNearestMatchingProject } from "../RAG/Examples/rag-utils"
import { createEmbedding } from "../RAG/utils"
import { OVERMIND_ENGINEER_PROMPT } from "./prompt"
import { activateScriptOnRequest, deactivateScriptOnRequest, getActiveTrackAndAgvs, getScriptWorkloadLogs, lastAssistantTextMessageContent, sanitizeResponse, cleanLogOutput, addScript, checkIfScriptIsActive } from "./utils"
import { AIIDEProject } from "../../generated/prisma"
import { conversationHistoryAdapter } from "./history"
import { allGoPluginDocs, findNearestMatchGoPluginDocs } from "../RAG/Go Plugin Docs/rag-utils"
import { getConfiguredModel } from "../config"
import { parseDiff } from "./diffparser"

import { runVerification } from "./verification"

export interface AgentState {
  summary: string
  error: string
  files: { [path: string]: string }
  filesUpdated: boolean
  project: AIIDEProject
  publisher: (response: string, messageID?: string) => Promise<void>
  filePublisher: (files: { [path: string]: string }, deletedFiles?: string[]) => Promise<void>
  stepStartPublisher: (stepName: string, runId: string) => Promise<string | void>
  stepEndPublisher: (stepName: string, stepOutput: string, runId: string, stepId: string) => Promise<void>
  agentMessageID?: string
  agentRunID?: string
  publish: any
  scriptId?: string
  isScriptActive?: boolean
  logsArived?: boolean
}

export interface toolData {
  status: string
  filename: string
  output: string
  lines_changed_start?: number
  lines_changed_end?: number
  newfiles?: { [key: string]: string } | string
  scriptId?: string
}

const tools = [
  createTool({
    name: "goPluginDocsQueryOrRead",
    description: "Use this tool to get context and documentation about the whole graphql documentation.",
    parameters: z.object({
      query: z.string().describe("The specific question or topic to search for in the knowledge base."),
      readOrQueryOption: z.enum(["read", "query"]).describe("Choose 'read' to read the documentation directly, or 'query' to search for specific information using embeddings."),
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request. Mention the toolname in the explanation. Don't mention it as a step in the workflow, this is a reason for invoking this very specific tool.")
    }),
    handler: async ({ query, readOrQueryOption, explanation }, { step, network }) => {
      console.log(`[goPluginDocsQueryOrRead] Starting with option: ${readOrQueryOption}, query: "${query}"`)

      if (readOrQueryOption === "read") {
        return await step?.run("go-plugin-docs-read", async () => {
          await network.state.data.publisher(explanation, network.state.data.agentMessageID)
          const stepId = await network.state.data.stepStartPublisher("go-plugin-docs-read", network.state.data.agentRunID)
          try {
            console.log(`[goPluginDocsQueryOrRead] Reading all Go plugin documentation`)
            await network.state.data.publisher("Successfully read all Go plugin documentation.", network.state.data.agentMessageID)
            await network.state.data.stepEndPublisher("go-plugin-docs-read", `Here is all the Documentation: ${allGoPluginDocs}`, network.state.data.agentRunID, stepId as unknown as string)
            return `Here is all the Documentation: ${allGoPluginDocs}`
          } catch (e) {
            console.error(`[goPluginDocsQueryOrRead] Error reading docs:`, e)
            await network.state.data.publisher(`Error reading docs: ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentMessageID)
            await network.state.data.stepEndPublisher("go-plugin-docs-read", `Error: Could not retrieve context. ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentRunID, stepId as unknown as string)
            return `Error: Could not retrieve context. ${e instanceof Error ? e.message : String(e)}`
          }
        })
      }
      return await step?.run("go-plugin-docs-query", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("go-plugin-docs-query", network.state.data.agentRunID)
        try {
          console.log(`[goPluginDocsQueryOrRead] Creating embedding for query`)
          const embedding: Array<number> = await createEmbedding(query)
          console.log(`[goPluginDocsQueryOrRead] Searching for nearest match in Go plugin docs`)
          const context: string = await findNearestMatchGoPluginDocs(embedding)
          console.log(`[goPluginDocsQueryOrRead] Found context, length: ${context.length}`)
          await network.state.data.publisher("Successfully retrieved context from Go plugin documentation.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("go-plugin-docs-query", `Here is the relevant context for your query "${query}":\n\n${context}`, network.state.data.agentRunID, stepId as unknown as string)
          return `Here is the relevant context for your query "${query}":\n\n${context}`
        } catch (e) {
          console.error(`[goPluginDocsQueryOrRead] Error querying docs:`, e)
          await network.state.data.publisher(`Error querying docs: ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("go-plugin-docs-query", `Error: Could not retrieve context. ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentRunID, stepId as unknown as string)
          return `Error: Could not retrieve context. ${e instanceof Error ? e.message : String(e)}`
        }
      })
    },
  }),
  createTool({
    name: "examplesQuery",
    description: "Use this tool to get an example project with all the code. Just specify what you want in your example.",
    parameters: z.object({
      query: z.string().describe("The description of the specific example you need according to user query."),
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ query, explanation }, { step, network }) => {
      console.log(`[examplesQuery] Starting example search for query: "${query}"`)

      return await step?.run("examples-query", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("examples-query", network.state.data.agentRunID)
        try {
          console.log(`[examplesQuery] Creating embedding for query`)
          const embedding: Array<number> = await createEmbedding(query)
          console.log(`[examplesQuery] Searching for nearest matching project`)
          const context: ProjectResult | null = await findNearestMatchingProject(embedding)

          if (!context) {
            console.log(`[examplesQuery] No example found for query: "${query}"`)
            await network.state.data.stepEndPublisher("examples-query", "No Example found! Please refine your query.", network.state.data.agentRunID, stepId as unknown as string)
            return "No Example found! Please refine your query."
          }
          console.log(`[examplesQuery] Found matching project.`)
          await network.state.data.publisher("Successfully retrieved example project.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("examples-query", JSON.stringify(context), network.state.data.agentRunID, stepId as unknown as string)
          return context
        } catch (e) {
          console.error(`[examplesQuery] Error retrieving example:`, e)
          await network.state.data.publisher(`Error retrieving example: ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("examples-query", `Error: Could not retrieve context. ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentRunID, stepId as unknown as string)
          return `Error: Could not retrieve context. ${e instanceof Error ? e.message : String(e)}`
        }
      })
    },
  }),
  createTool({
    name: "apply_patch",
    description: "Create or update files in the sandbox.",
    parameters: z.object({
      filename: z.string().describe("The name of the file to create or update, including any sub-directory paths if applicable (e.g., script.go or subdir/helper.go). Must be a valid .go file."),
      type: z.enum(['create_file', 'update_file', 'delete_file']).describe("Specify whether to create a new file, update an existing file, or delete a file."),
      patch: z.string().describe(
        "For 'update_file': The V4A-formatted diff string containing context anchors (@@) and code changes.\n" +
        "For 'create_file': The full literal content of the new file.\n" +
        "For 'delete_file': You MUST pass the literal string 'delete'."
      ),
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ filename, type, patch, explanation }, { step, network }) => {
      console.log(`[apply_patch] Starting file operations for ${filename}, project: ${network.state.data.project.id}`)
      const lineStartAndEnd = [0, 0]
      const toolData: toolData = await step?.run("apply_patch", async () => {
        const updatedFiles: { [key: string]: string } = network.state.data.files || {}
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("apply_patch", network.state.data.agentRunID as unknown as string)
        try {
          console.log(`[apply_patch] Processing file: ${filename}`)
          const n = filename.split('/').pop() || ''

          if (!n || !n.includes('.go')) {
            console.error(`[apply_patch] Invalid filename: ${filename}`)
            throw new Error(`Invalid filename: ${filename}. Must be a valid .go file (e.g., script.go or subdir/helper.go)`)
          }

          if (filename.includes('cmd/script/go_plugin/plugins/')) {
            console.error(`[apply_patch] Invalid path includes forbidden directory: ${filename}`)
            throw new Error(`Invalid path: ${filename}. Include ONLY file name in path. (alongside any sub-directories you added)`)
          }

          console.log(`[apply_patch] Checking if file exists in database: ${filename}`)
          const dbFile = await prisma.aIIDEFile.findFirst({
            where: {
              path: filename,
              projectId: network.state.data.project.id
            }
          })

          if (!dbFile && (type === 'update_file' || type === 'delete_file')) {
            console.error(`[apply_patch] File not found for update: ${filename}`)
            throw new Error(`Could not apply patch to ${filename} — file not found on disk`)
          }

          if (type === 'create_file' && dbFile) {
            console.error(`[apply_patch] File already exists for creation: ${filename}`)
            throw new Error(`Cannot create ${filename} — file already exists`)
          }

          if (dbFile && type === 'delete_file') {
            console.log(`[apply_patch] Deleting file from database: ${filename} (ID: ${dbFile.id})`)
            await prisma.aIIDEFile.delete({
              where: { id: dbFile.id }
            })
            delete updatedFiles[filename]
            console.log(`[apply_patch] Successfully deleted file: ${filename}`)
            network.state.data.filesUpdated = true
            await network.state.data.filePublisher(updatedFiles, [filename])
            await network.state.data.stepEndPublisher("apply_patch", JSON.stringify({
              status: "success",
              filename: filename,
              output: "File deleted successfully.",
              newfiles: updatedFiles
            }), network.state.data.agentRunID, stepId)
            return {
              status: "success",
              filename: filename,
              output: "File deleted successfully.",
              newfiles: updatedFiles
            }
          }

          let parseResult: [string, number, number] = ['', 0, 0]

          if (type === 'update_file') {
            console.log(`[apply_patch] Applying patch to existing file: ${filename}`)
            parseResult = parseDiff(patch, dbFile!.content)
          }

          const fileContent = type === 'create_file' ? patch : parseResult[0]

          if (!dbFile) {
            console.log(`[apply_patch] Creating new file in database: ${filename}`)
            await prisma.aIIDEFile.create({
              data: {
                name: n,
                path: filename,
                content: fileContent,
                projectId: network.state.data.project.id
              }
            })
            lineStartAndEnd[0] = 1
            lineStartAndEnd[1] = countLines(fileContent)
            console.log(`[apply_patch] Successfully created file: ${filename}`)
          } else {
            console.log(`[apply_patch] Updating existing file in database: ${filename} (ID: ${dbFile.id})`)
            await prisma.aIIDEFile.update({
              where: { id: dbFile.id },
              data: {
                content: fileContent,
                name: n,
                path: filename
              }
            })
            lineStartAndEnd[0] = parseResult[1]
            lineStartAndEnd[1] = parseResult[2]
          }

          updatedFiles[filename] = fileContent

          console.log(`[apply_patch] Successfully processed ${filename}`)
          network.state.data.filesUpdated = true
          console.log(`[apply_patch] Publishing file updates`)
          await network.state.data.filePublisher(updatedFiles)
          await network.state.data.publisher("Successfully created or updated files.", network.state.data.agentMessageID)
          // --- AUTO-VERIFICATION ---
          console.log(`[apply_patch] Triggering automatic verification...`)
          await network.state.data.publisher("Verifying compilation...", network.state.data.agentMessageID)

          let verificationOutput = ""
          try {
            // Invoke verification with the Virtual File System (memory-to-sandbox)
            // 'updatedFiles' contains the latest state including the patch applied above.
            verificationOutput = await runVerification(updatedFiles)

          } catch (verErr) {
            console.error("[apply_patch] Auto-verification failed to run:", verErr)
            verificationOutput = `\n\n[Auto-Verification System Error]: Could not run verification. ${verErr}`
          }

          // --- AUTO-PROVISIONING TO OVERMIND ---
          console.log(`[apply_patch] Provisioning script to Overmind...`)
          await network.state.data.publisher("Provisioning script to Overmind...", network.state.data.agentMessageID)

          let scriptAuthId: string | undefined

          try {
            const script = await addScript(
              updatedFiles,
              network.state.data.project.scriptName as string,
              network.state.data.project.scriptDescription as string,
            )

            scriptAuthId = script.scriptConfigId
            network.state.data.scriptId = script.scriptConfigId

            await prisma.aIIDEAIScript.create({
              data: {
                projectId: network.state.data.project.id,
                scriptConfigId: script.scriptConfigId,
                created: script.created,
                createdBy: script.createdBy
              }
            })

            console.log(`[apply_patch] Script provisioned successfully with ID: ${script.scriptConfigId}`)
            verificationOutput += `\n\nScript provisioned to Overmind (ID: ${script.scriptConfigId})`

            await network.state.data.publish({
              channel: `project:${network.state.data.project.id}`,
              topic: "ai",
              data: {
                type: "script_created",
                script: {
                  scriptConfigId: script.scriptConfigId,
                  created: script.created,
                  createdBy: script.createdBy,
                  projectId: network.state.data.project.id
                },
                files: updatedFiles
              }
            })
          } catch (provisionErr) {
            console.error("[apply_patch] Auto-provisioning failed:", provisionErr)
            verificationOutput += `\n\n[Auto-Provisioning Error]: Could not provision to Overmind. ${provisionErr}`
          }

          await network.state.data.stepEndPublisher("apply_patch", JSON.stringify({
            status: "success",
            filename: filename,
            output: "File created/updated successfully.\n" + verificationOutput,
            lines_changed_start: lineStartAndEnd[0],
            lines_changed_end: lineStartAndEnd[1],
            newfiles: updatedFiles,
            scriptId: scriptAuthId
          }), network.state.data.agentRunID, stepId)
          return {
            status: "success",
            filename: filename,
            output: "File created/updated successfully.\n" + verificationOutput,
            lines_changed_start: lineStartAndEnd[0],
            lines_changed_end: lineStartAndEnd[1],
            newfiles: updatedFiles,
            scriptId: scriptAuthId
          }
        } catch (e) {
          console.error(`[apply_patch] Error processing files:`, e)
          await network.state.data.publisher(`Error processing files: ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("apply_patch", e instanceof Error ? e.message : String(e), network.state.data.agentRunID, stepId)
          const newFiles = `Error: ${e instanceof Error ? e.message : String(e)}`
          return {
            status: "failed",
            filename: filename,
            newfiles: newFiles,
            output: newFiles,
          }
        }
      }) as toolData

      const newFiles = toolData?.newfiles

      if (type === "delete_file" && toolData?.status === "success") {
        delete network.state.data.files[filename]
      }

      const scriptId = toolData?.scriptId
      if (scriptId) {
        console.log(`[apply_patch] Updating network state with scriptId: ${scriptId}`)
        network.state.data.scriptId = scriptId
      }

      if (typeof newFiles === "object" && Object.keys(newFiles).length !== 0) {
        console.log(`[apply_patch] Updating network state with ${Object.keys(newFiles).length} files`)
        network.state.data.filesUpdated = true
        for (const path of Object.keys(newFiles)) {
          network.state.data.files[path] = newFiles[path]
        }
        console.log(`[apply_patch] Operation completed successfully for file: ${filename}`)
        delete toolData.newfiles
        return toolData
      } else if (typeof newFiles === "string") {
        console.log(`[apply_patch] Operation failed for file: ${filename}`)
        delete toolData.newfiles
        return toolData
      } else {
        console.log(`[apply_patch] Operation resulted in unknown error for file: ${filename}`)
        delete toolData.newfiles
        return toolData
      }
    }
  }),
  createTool({
    name: "readProjectFiles",
    description: "Read the current state of all project files in the sandbox.",
    parameters: z.object({
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ explanation }, { step, network }: Tool.Options<AgentState>) => {
      console.log(`[readProjectFiles] Read state of code for project: ${network.state.data.project.id}`)
      const newFiles = await step?.run("readProjectFiles", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("readProjectFiles", network.state.data.agentRunID as unknown as string)
        try {
          const updatedFiles = network.state.data.files || {}

          if (network.state.data.filesUpdated) {
            console.log(`[readProjectFiles] Using cached files from network state (${Object.keys(updatedFiles).length} files)`)
            return updatedFiles
          }

          console.log(`[readProjectFiles] Fetching files from database`)
          const files = await prisma.aIIDEFile.findMany({
            where: {
              projectId: network.state.data.project.id
            }
          })
          console.log(`[readProjectFiles] Retrieved ${files.length} files from database`)

          for (const file of files) {
            updatedFiles[file.path] = file.content
          }

          await network.state.data.publisher("Successfully read and prepared AI code files.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("readProjectFiles", sanitizeResponse(JSON.stringify(updatedFiles)), network.state.data.agentRunID as unknown as string, stepId as unknown as string)
          return updatedFiles
        } catch (e) {
          console.error(`[readProjectFiles] Error reading files:`, e)
          await network.state.data.publisher(`Error reading files: ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("readProjectFiles", e instanceof Error ? e.message : String(e), network.state.data.agentRunID as unknown as string, stepId as unknown as string)
          return e instanceof Error ? e.message : String(e)
        }
      })

      if (typeof newFiles === "object") {
        console.log(`[readProjectFiles] Updating network state with ${Object.keys(newFiles).length} files`)
        for (const path of Object.keys(newFiles)) {
          network.state.data.files[path] = newFiles[path]
        }
      }

      console.log(`[readProjectFiles] Operation completed`)
      return newFiles
    }
  }),
  createTool({
    name: "readFileLines",
    description: "Read a specific range of lines from a file. Useful for examining specific code blocks or error locations.",
    parameters: z.object({
      filename: z.string().describe("The name of the file to read lines from."),
      startLine: z.number().int().min(1).describe("The starting line number (1-based index)."),
      endLine: z.number().int().min(1).describe("The ending line number (1-based index)."),
      explanation: z.string().describe("Mandatory explanation of why this specific range is needed.")
    }),
    handler: async ({ filename, startLine, endLine, explanation }, { step, network }) => {
      console.log(`[readFileLines] Reading lines ${startLine}-${endLine} from file: ${filename}`)

      return await step?.run("readFileLines", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("readFileLines", network.state.data.agentRunID)

        try {
          const file = await prisma.aIIDEFile.findFirst({
            where: {
              projectId: network.state.data.project.id,
              path: filename,
              name: filename.split('/').pop() || ''
            }
          })

          // 1. Check if file exists
          if (typeof file?.content !== 'string') {
            throw new Error(`File not found: ${filename}`)
          }

          // 2. Robust Split (Handles CRLF and Empty Files)
          const fileLines = file.content === "" ? [] : file.content.split(/\r?\n/)
          const totalLines = fileLines.length

          // 3. Validation
          if (startLine > totalLines) {
            throw new Error(`Start line ${startLine} is out of bounds. File only has ${totalLines} lines.`)
          }
          if (endLine < startLine) {
            throw new Error(`End line (${endLine}) cannot be smaller than start line (${startLine}).`)
          }

          // 4. Safe Slicing (slice handles endLine > totalLines automatically)
          // Note: startLine is 1-based, so we subtract 1 for the 0-based array index.
          const selectedText = fileLines.slice(startLine - 1, endLine).join('\n')

          console.log(`[readFileLines] Successfully read ${startLine}-${endLine} from ${filename}`)

          await network.state.data.publisher("Successfully read lines.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("readFileLines", sanitizeResponse(selectedText), network.state.data.agentRunID, stepId)

          return selectedText

        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          console.error(`[readFileLines] Error:`, errorMsg)

          await network.state.data.publisher(`Error reading lines: ${errorMsg}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("readFileLines", `Error: ${errorMsg}`, network.state.data.agentRunID, stepId)

          return `Error: Could not read file lines. ${errorMsg}`
        }
      })
    }
  }),
  createTool({
    name: "searchInFiles",
    description: "Search for exact text matches across all project files. Returns filenames and line numbers containing the text, and line snippets.",
    parameters: z.object({
      query: z.string().describe("The exact text string to search for within the project files."),
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ explanation, query }, { step, network }) => {
      console.log(`[searchInFiles] Searching files for query: ${query}`)
      return await step?.run("searchInFiles", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("searchInFiles", network.state.data.agentRunID)
        try {
          const files = await prisma.aIIDEFile.findMany({
            where: {
              projectId: network.state.data.project.id
            }
          })
          console.log(`[searchInFiles] Retrieved ${files.length} files from database for searching`)

          const results: { [filename: string]: { lineNumber: number, lineText: string }[] } = {}

          for (const file of files) {
            const fileLines = file.content === "" ? [] : file.content.split(/\r?\n/)
            fileLines.forEach((line, index) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                if (!results[file.path]) {
                  results[file.path] = []
                }
                results[file.path].push({
                  lineNumber: index + 1,
                  lineText: line.trim()
                })
              }
            })
          }
          console.log(`[searchInFiles] Search completed with ${Object.keys(results).length} files containing matches`)
          await network.state.data.publisher("Search completed.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("searchInFiles", JSON.stringify(results), network.state.data.agentRunID, stepId)
          return results
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          console.error(`[searchInFiles] Error:`, errorMsg)
          await network.state.data.publisher(`Error during search: ${errorMsg}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("searchInFiles", `Error: ${errorMsg}`, network.state.data.agentRunID, stepId)
          return `Error: Could not complete search. ${errorMsg}`
        }
      })
    }
  }),
  createTool({
    name: "activateScriptWithRequest",
    description: "Activate the provisioning script based on user request. This tool waits for user confirmation before proceeding.",
    parameters: z.object({
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ explanation }, { step, network }) => {
      console.log(`[activateScriptWithRequest] Awaiting user activation request`)
      const activationData = await step?.run("activateScriptWithRequest", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("activateScriptWithRequest", network.state.data.agentRunID)

        // Check actual script status from Overmind (source of truth) and persist it
        const scriptName = network.state.data.project.scriptName
        if (scriptName) {
          const isActive = await checkIfScriptIsActive(scriptName)
          if (isActive) {
            console.log(`[activateScriptWithRequest] Script "${scriptName}" is active, deactivating before re-activation...`)
            await deactivateScriptOnRequest(scriptName)

            // Wait for deactivation to complete
            console.log(`[activateScriptWithRequest] Waiting for script "${scriptName}" to deactivate...`)
            let retries = 0
            const maxRetries = 30 // Wait up to 60 seconds (30 * 2000ms)
            while (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000))
              const stillActive = await checkIfScriptIsActive(scriptName)
              if (!stillActive) {
                console.log(`[activateScriptWithRequest] Script "${scriptName}" is now inactive. Proceeding.`)
                break
              }
              retries++
              console.log(`[activateScriptWithRequest] Script still active, retrying (${retries}/${maxRetries})...`)
            }

            if (retries >= maxRetries) {
              console.warn(`[activateScriptWithRequest] Timeout waiting for script "${scriptName}" to deactivate. Proceeding anyway, but race condition possible.`)
            }
          }

        }

        await prisma.aIIDEProject.update({
          where: {
            id: network.state.data.project.id
          },
          data: {
            isAwaitingScriptActivation: true
          }
        }).catch((e) => {
          console.error(`[activateScriptWithRequest] Error updating project awaiting activation:`, e)
        })

        await network.state.data.publish({
          channel: `project:${network.state.data.project.id}`,
          topic: "ai",
          data: {
            type: "awaiting_user_activation",
          }
        })
        console.log(`[activateScriptWithRequest] Published awaiting activation message for project: ${network.state.data.project.id}`)

        return { stepId, isScriptActive: false }
      })

      const stepId = activationData?.stepId

      if (activationData?.isScriptActive !== undefined) {
        network.state.data.isScriptActive = activationData.isScriptActive
      }

      const userChoice: { choice: boolean, projectId: string, agentRunID: string } = (await (step as any).waitForEvent(
        "user.code-agent-activation-response",
        {
          event: "code-agent-activation-request/run",
          timeout: "15m",
          if: `async.data.projectId == '${network.state.data.project.id}' && async.data.agentRunID == '${network.state.data.agentRunID}'`,
        }
      )).data

      if (userChoice) {
        if (userChoice.choice) {
          console.log(`[activateScriptWithRequest] User chose to activate the script for project: ${network.state.data.project.id}`)
          await network.state.data.publish({
            channel: `project:${network.state.data.project.id}`,
            topic: "ai",
            data: { type: "user_activation_response_received_true" }
          })
          network.state.data.codeEditedWithoutActivation = false

        } else {
          console.log(`[activateScriptWithRequest] User chose NOT to activate the script for project: ${network.state.data.project.id}`)
          await network.state.data.publish({
            channel: `project:${network.state.data.project.id}`,
            topic: "ai",
            data: { type: "user_activation_response_received_false" }
          })
        }
      } else {
        await network.state.data.publish({
          channel: `project:${network.state.data.project.id}`,
          topic: "ai",
          data: { type: "user_activation_response_timeout" }
        })
      }

      await step?.run("activateScriptWithRequest-postResponse", async () => {
        await prisma.aIIDEProject.update({
          where: {
            id: network.state.data.project.id
          },
          data: {
            isAwaitingScriptActivation: false
          }
        }).catch((e) => {
          console.error(`[activateScriptWithRequest] Error updating project awaiting activation:`, e)
        })
      })

      if (!userChoice || typeof userChoice.choice !== "boolean" || !userChoice.choice) {
        await step?.run("activateScriptWithRequest-noActivation", async () => {
          await network.state.data.publisher("No activation received or user chose not to activate. Resuming without activation.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("activateScriptWithRequest", "No activation received or user chose not to activate. Resume without activation.", network.state.data.agentRunID as unknown as string, stepId as unknown as string)
          return "No developer response, or user choose to not activate the script. Resume without activation."
        })
        return "No developer response, or user choose to not activate the script. Resume without activation."
      } else if (userChoice.choice) {
        const data = await step?.run("activateScriptWithRequest-activationReceived", async () => {
          const scriptId = network.state.data.scriptId as string
          if (!scriptId) {
            console.error(`[activateScriptWithRequest] scriptId is missing. This should not happen since apply_patch auto-provisions.`)
            await network.state.data.publisher("Error: No script has been provisioned yet. Please apply code changes first.", network.state.data.agentMessageID)
            await network.state.data.stepEndPublisher("activateScriptWithRequest", "Error: No script provisioned.", network.state.data.agentRunID as unknown as string, stepId as unknown as string)
            return "Error: No script has been provisioned. Apply code changes first."
          }

          await activateScriptOnRequest(scriptId)
          await network.state.data.publisher("Script activated successfully. Resuming operations.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("activateScriptWithRequest", "Script activated successfully. Resuming operations.", network.state.data.agentRunID as unknown as string, stepId as unknown as string)
          return "Script activated successfully. Resuming operations."
        })
        network.state.data.isScriptActive = true
        console.log(`[activateScriptWithRequest] User activated the script for project: ${network.state.data.project.id}`)
        return data
      }

      console.log(`[activateScriptWithRequest] Unknown error in activation flow`)
      await step?.run("activateScriptWithRequest-unknownError", async () => {
        await network.state.data.publisher("Unknown error in activation flow. Trying again later.", network.state.data.agentMessageID)
        await network.state.data.stepEndPublisher("activateScriptWithRequest", "Unknown error in activation flow. Trying again later.", network.state.data.agentRunID as unknown as string, stepId as unknown as string)
        return "Unknown error in activation flow. Try again later."
      })
      return "Unknown error in activation flow. Try again later."
    }
  }),
  createTool({
    name: "getScriptWorkloadLogs",
    description: "Retrieve the latest logs from the active provisioning script workload.",
    parameters: z.object({
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ explanation }, { step, network }) => {
      console.log(`[getScriptWorkloadLogs] Fetching workload logs`)
      return await step?.run("getScriptWorkloadLogs", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("getScriptWorkloadLogs", network.state.data.agentRunID as unknown as string)

        let logs: any = ""
        let tries: number = 0

        try {
          if (!network.state.data.logsArived) {
            console.log("[getScriptWorkloadLogs] Logs have not arrived yet. Polling...")

            while (tries < 60) {
              tries += 1
              try {
                const scriptName = network.state.data.project.scriptName
                if (!scriptName) {
                  throw new Error("Script name is missing.")
                }
                logs = await getScriptWorkloadLogs(scriptName)

                const hasLogs = Array.isArray(logs) ? logs.length > 0 : (typeof logs === 'string' ? logs.trim() !== "" : !!logs)

                if (hasLogs) {
                  console.log("[getScriptWorkloadLogs] Logs arrived!")
                  network.state.data.logsArived = true
                  await new Promise(r => setTimeout(r, 2000))
                  logs = await getScriptWorkloadLogs(scriptName)
                  break
                }

                await new Promise(r => setTimeout(r, 2000))

              } catch (e) {
                console.error("[getScriptWorkloadLogs] Error polling logs:", e)
                const msg = "Please activate a script first."
                await network.state.data.publisher(msg, network.state.data.agentMessageID)
                await network.state.data.stepEndPublisher("getScriptWorkloadLogs", msg, network.state.data.agentRunID as unknown as string, stepId as unknown as string)
                return msg
              }
            }
            if (!network.state.data.logsArived) {
              console.log("[getScriptWorkloadLogs] Logs did not arrive within the expected time.")
              const msg = "Logs did not arrive within the expected time. Trying again later."
              await network.state.data.publisher(msg, network.state.data.agentMessageID)
              await network.state.data.stepEndPublisher("getScriptWorkloadLogs", "Logs did not arrive within the expected time. Please Try again later.", network.state.data.agentRunID as unknown as string, stepId as unknown as string)
              return msg
            }
          } else {
            console.log("[getScriptWorkloadLogs] Logs already arrived. Fetching once.")
            try {
              const scriptName = network.state.data.project.scriptName
              if (!scriptName) {
                throw new Error("Script name is missing.")
              }
              logs = await getScriptWorkloadLogs(scriptName)
            } catch (e) {
              const msg = "Please activate a script first. Error: " + (e instanceof Error ? e.message : String(e))
              await network.state.data.publisher(msg, network.state.data.agentMessageID)
              await network.state.data.stepEndPublisher("getScriptWorkloadLogs", msg, network.state.data.agentRunID as unknown as string, stepId as unknown as string)
              return msg
            }
          }

          console.log(`[getScriptWorkloadLogs] Successfully retrieved logs`)
          const output = typeof logs === 'string' ? logs : JSON.stringify(logs)
          const sanitizedOutput = cleanLogOutput(output)

          await network.state.data.publisher("Successfully retrieved script workload logs.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("getScriptWorkloadLogs", sanitizedOutput, network.state.data.agentRunID as unknown as string, stepId as unknown as string)
          return sanitizedOutput

        } catch (e) {
          console.error(`[getScriptWorkloadLogs] Unexpected error:`, e)
          const msg = `Unexpected error: ${e instanceof Error ? e.message : String(e)}`
          await network.state.data.publisher(msg, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("getScriptWorkloadLogs", msg, network.state.data.agentRunID as unknown as string, stepId as unknown as string)
          return msg
        }
      })
    }
  }),
  createTool({
    name: "getActiveTrackAndAgvs",
    description: "Get the active track and AGVs information from the Overmind system.",
    parameters: z.object({
      explanation: z.string().describe("This is a mandatory field explaining specifically why this tool is being invoked and how it addresses the user's request.")
    }),
    handler: async ({ explanation }, { step, network }) => {
      console.log(`[getActiveTrackAndAgvs] Fetching active track and AGVs data`)
      return await step?.run("getActiveTrackAndAgvs", async () => {
        await network.state.data.publisher(explanation, network.state.data.agentMessageID)
        const stepId = await network.state.data.stepStartPublisher("getActiveTrackAndAgvs", network.state.data.agentRunID)
        try {
          const prompt = await getActiveTrackAndAgvs()
          console.log(`[getActiveTrackAndAgvs] Successfully retrieved track and AGVs data`)
          await network.state.data.publisher("Successfully retrieved active track and AGVs data.", network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("getActiveTrackAndAgvs", JSON.stringify(prompt), network.state.data.agentRunID, stepId as unknown as string)
          return prompt
        } catch (e) {
          console.error(`[getActiveTrackAndAgvs] Error retrieving data:`, e)
          await network.state.data.publisher(`Error retrieving data: ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentMessageID)
          await network.state.data.stepEndPublisher("getActiveTrackAndAgvs", `Error: Could not retrieve data. ${e instanceof Error ? e.message : String(e)}`, network.state.data.agentRunID, stepId as unknown as string)
          return `Error: Could not retrieve data. ${e instanceof Error ? e.message : String(e)}`
        }
      })
    }
  })
]

const onResponse = async ({ result, network }: { result: any, network: any }) => {
  console.log(`[onResponse] Processing agent response`)
  const lastAssistantMessageText =
    lastAssistantTextMessageContent(result)
  if (lastAssistantMessageText && network) {
    if (lastAssistantMessageText.includes("<task_summary>")) {
      console.log(`[onResponse] Task summary detected, updating network state`)
      network.state.data.summary = lastAssistantMessageText
    }
    else if (lastAssistantMessageText.includes("<agent_error>")) {
      console.log(`[onResponse] Agent error detected, updating network state`)
      network.state.data.error = lastAssistantMessageText
    }
  }
  console.log(`[onResponse] Response processing completed`)
  return result
}

export const codeAgent = createAgent<AgentState>({
  name: "code-agent",
  description: "An expert coding agent",
  system: OVERMIND_ENGINEER_PROMPT,
  model: getConfiguredModel(),
  tools,
  history: conversationHistoryAdapter,
  lifecycle: {
    onResponse: onResponse as any
  }
})

function countLines(content: string): number {
  if (content === "") return 0
  return content.split(/\r?\n/).length
}