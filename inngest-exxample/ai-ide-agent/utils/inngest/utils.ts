import { AgentResult, TextMessage } from "@inngest/agent-kit"
import OpenAI from "openai"
import { GRAPHQL_ENDPOINT, OPENAI_API_KEY } from "../config.ts"
import { activateScriptMutation, activeTrackQuery, agvStateQuery, availableScriptsQuery, scriptMutation, wholeTrackQuery, deactivateScriptMutation, scriptLogsQuery, activeScriptConfigQuery } from "./graphqlquerries.ts"
import { GraphQLClient } from "graphql-request"

export function lastAssistantTextMessageContent(result: AgentResult) {
  console.log(`[lastAssistantTextMessageContent] Extracting last assistant message from ${result.output.length} messages`)
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message: any) => message.role === "assistant",
  )
  console.log(`[lastAssistantTextMessageContent] Last assistant message index: ${lastAssistantTextMessageIndex}`)

  const message = result.output[lastAssistantTextMessageIndex] as
    | TextMessage
    | undefined

  const content = message?.content
    ? typeof message.content === "string"
      ? message.content
      : message.content.map((c) => c.text).join("")
    : undefined

  console.log(`[lastAssistantTextMessageContent] Extracted content length: ${content?.length || 0}`)
  return content
}

export async function addScript(
  files: Record<string, string>,
  scriptName: string,
  scriptDescription: string,
) {
  console.log(`[addScript] Starting script creation: "${scriptName}"`)
  console.log(`[addScript] Files count: ${Object.keys(files).length}, Description: "${(scriptDescription || "").substring(0, 100)}..."`)



  if (!scriptName || !scriptDescription) {
    console.error(`[addScript] Validation failed: missing name or description`)
    throw new Error("Script name and description must exist")
  }

  console.log(`[addScript] Creating FormData for upload`)
  const form = new FormData()

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const operations = {
    query: scriptMutation,
    variables: {
      scriptConfig: {
        metadata: { name: scriptName, description: scriptDescription },
        scriptKind: "SCRIPT_KIND_GO_PLUGIN",
        dynamicWorkloadSpec: true,
        scriptConfigGoPlugin: {
          sourceTree: Object.keys(files).map((path) => ({
            path,
            file: null,
          })),
        },
      },
    },
  }
  console.log(`[addScript] Created operations with ${Object.keys(files).length} source tree entries`)

  form.append("operations", JSON.stringify(operations))

  const map: Record<string, string[]> = {}
  Object.keys(files).forEach((_, i) => {
    map[i] = [
      `variables.scriptConfig.scriptConfigGoPlugin.sourceTree.${i}.file`,
    ]
  })
  console.log(`[addScript] Created file map with ${Object.keys(map).length} entries`)
  form.append("map", JSON.stringify(map))

  console.log(`[addScript] Appending ${Object.keys(files).length} files to form`)
  Object.entries(files).forEach(([path, content], i) => {
    const blob = new Blob([content], { type: "text/plain" })
    if (blob.size > MAX_FILE_SIZE) {
      console.error(`[addScript] File ${path} exceeds size limit: ${blob.size} bytes`)
      throw new Error(`File ${path} exceeds size limit`)
    }
    console.log(`[addScript] Appending file ${i}: ${path} (${blob.size} bytes)`)
    form.append(String(i), blob, path.split("/").pop())
  })

  try {
    console.log(`[addScript] Sending POST request to GraphQL endpoint: ${GRAPHQL_ENDPOINT}`)
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      body: form
    })
    console.log(`[addScript] Received response with status: ${response.status}`)

    const data = await response.json()

    console.log("Script created successfully:", data)

    const created =
      data?.data?.scriptProvisioning?.createScriptConfig

    if (!created) {
      console.error(`[addScript] Unexpected response shape - missing createScriptConfig`)
      throw new Error("Unexpected GraphQL response shape.")
    }

    console.log("Script created successfully:", created)
    console.log(`[addScript] Script created with ID: ${created.id}`)

    return {
      scriptConfigId: created.id,
      scriptName: created.name,
      description: created.description,
      created: created.created,
      createdBy: created.createdBy,
    }
  } catch (error) {
    console.error("Error creating script:", error)
    throw error
  }
}

export async function responseGenerator(object: { stepName: string, default: string, prompt: string, request: string }) {
  console.log(`[responseGenerator] Starting generation for step: ${object.stepName}`)
  console.log(`[responseGenerator] Request: "${object.request.substring(0, 100)}...", Default: "${object.default}"`)

  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  })

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: object.prompt },
        { role: "user", content: object.request },
      ],
      model: "gpt-5.2",
    })

    const content = completion.choices[0].message.content

    if (!content) {
      console.warn(`[responseGenerator] No content in response, using default: "${object.default}"`)
      return object.default
    }

    console.log(`[responseGenerator] Generated response (length: ${content.length})`)
    console.log(`[responseGenerator] Returning response for ${object.stepName}: "${content.substring(0, 100)}..."`)
    return content
  } catch (error) {
    console.error("Error generating response:", error)
    return object.default
  }
}

export async function getActiveTrackAndAgvs() {
  console.log(`[getActiveTrackAndAgvs] Starting data retrieval from GraphQL endpoint: ${GRAPHQL_ENDPOINT}`)

  const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT)

  let activeTrackData

  try {
    console.log(`[getActiveTrackAndAgvs] Fetching active track configuration`)
    activeTrackData = await graphQLClient.request(activeTrackQuery)
    console.log(`[getActiveTrackAndAgvs] Active track ID: ${activeTrackData.trackManager.activeTrackConfig.id}`)
  } catch (error) {
    console.error("Error fetching active track configuration:", error)
    throw error
  }

  const wholeTrackQueryVariables = {
    trackId: activeTrackData.trackManager.activeTrackConfig.id,
  }

  let wholeTrackData

  try {
    console.log(`[getActiveTrackAndAgvs] Fetching whole track configuration for track: ${wholeTrackQueryVariables.trackId}`)
    wholeTrackData = await graphQLClient.request(
      wholeTrackQuery,
      wholeTrackQueryVariables,
    )
    console.log(`[getActiveTrackAndAgvs] Whole track data retrieved successfully`)
  } catch (error) {
    console.error("Error fetching whole track configuration:", error)
    throw error
  }

  let cursor: string | null = ""
  const nextN = 100


  const agvStates = []
  cursor = "" // Reset cursor
  
  try {
    console.log(`[getActiveTrackAndAgvs] Starting AGV State pagination (pageSize: ${nextN})`)
    let pageCount = 0
    do {
      pageCount++
      console.log(`[getActiveTrackAndAgvs] Fetching AGV States page ${pageCount}, cursor: ${cursor || 'initial'}`)
      const agvStateData: any = await graphQLClient.request(agvStateQuery, { nextN, cursor })
      const pageResults = agvStateData.agvQueries.listCompositeAgvState.results
      console.log(`[getActiveTrackAndAgvs] State Page ${pageCount} returned ${pageResults.length} AGV States`)
      agvStates.push(...pageResults)
      cursor = agvStateData.agvQueries.listCompositeAgvState.more
        ? agvStateData.agvQueries.listCompositeAgvState.cursor
        : null
    } while (cursor)
    console.log(`[getActiveTrackAndAgvs] AGV State pagination completed: ${agvStates.length} total states retrieved`)
  } catch (error) {
    console.error("Error fetching AGV States:", error)
    // We don't throw here to avoid breaking the whole flow if state query fails (e.g. no active system)
  }

  console.log(`[getActiveTrackAndAgvs] Building prompt with track and AGV data`)
  const prompt = `
    Here is the active track configuration:
    ${JSON.stringify(wholeTrackData, null, 2)}

    Here are the current AGV States:
    ${JSON.stringify(agvStates, null, 2)}
    `
  console.log(`[getActiveTrackAndAgvs] Prompt generated successfully (length: ${prompt.length})`)

  return prompt
}

export async function availableScriptsNames() {
  const ScriptNames: string[] = []
  console.log(`[availableScriptsNames] Starting script names retrieval from GraphQL endpoint: ${GRAPHQL_ENDPOINT}`)

  const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT)

  let cursor: string | null = ""
  const nextN = 100

  try {
    console.log(`[availableScriptsNames] Starting script names pagination (pageSize: ${nextN})`)
    let pageCount = 0
    do {
      pageCount++
      console.log(`[availableScriptsNames] Fetching scripts page ${pageCount}, cursor: ${cursor || 'initial'}`)
      const scriptsData: any = await graphQLClient.request(availableScriptsQuery, { nextN, cursor })
      const pageResults = scriptsData.scriptProvisioning.availableLatestScriptConfigs.results
      console.log(`[availableScriptsNames] Page ${pageCount} returned ${pageResults.length} scripts`)
      pageResults.forEach((script: any) => {
        ScriptNames.push(script.name)
      })
      cursor = scriptsData.scriptProvisioning.availableLatestScriptConfigs.more
        ? scriptsData.scriptProvisioning.availableLatestScriptConfigs.cursor
        : null
    } while (cursor)
    console.log(`[availableScriptsNames] Script names pagination completed: ${ScriptNames.length} total scripts retrieved in ${pageCount} pages`)
  } catch (error) {
    console.error("Error fetching script names:", error)
    throw error
  }

  return ScriptNames
}

export async function isScriptNameUsed(scriptName: string) {
  console.log(`[isScriptNameUsed] Checking usage for script name: "${scriptName}"`)
  const scriptNames = await availableScriptsNames()
  const isUsed = scriptNames.includes(scriptName)
  console.log(`[isScriptNameUsed] Script name "${scriptName}" is ${isUsed ? 'used' : 'not used'}`)
  return isUsed
}

export async function activateScriptOnRequest(scriptId: string) {
  console.log(`[activateScriptOnRequest] Activating script on user request`)
  const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT)
  const scriptActivation = await graphQLClient.request(activateScriptMutation, { scriptId })
  console.log(`[activateScriptOnRequest] Script activated successfully: ${scriptActivation.scriptProvisioning.activateScriptConfig.id}`)
  return scriptActivation
}

export async function deactivateScriptOnRequest(scriptName: string) {
  console.log(`[deactivateScriptOnRequest] Deactivating script on user request: "${scriptName}"`)
  const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT)
  const scriptDeactivation = await graphQLClient.request(deactivateScriptMutation, { scriptId: scriptName })
  console.log(`[deactivateScriptOnRequest] Script deactivated successfully: ${scriptDeactivation.scriptProvisioning.deactivateScriptConfig}`)
  return scriptDeactivation
}

export async function getScriptWorkloadLogs(scriptName: string) {
  console.log(`[getScriptWorkloadLogs] Fetching workload logs for script Name: ${scriptName}`)
  const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT)
  const scriptLogsData: any = await graphQLClient.request(scriptLogsQuery, { scriptId: scriptName })
  console.log(`[getScriptWorkloadLogs] Workload logs retrieved successfully (length: ${scriptLogsData.scriptQueries.getScriptWorkloadLogs.length})`)
  return scriptLogsData.scriptQueries.getScriptWorkloadLogs
}

export function sanitizeResponse(input: string) {
  console.log(`[sanitizedResponse] Sanitizing input response (length: ${input.length})`)
  return input ? input
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/⇒/g, '=>')
    .replace(/⇐/g, '<=')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '*')
    // Remove null bytes and any remaining non-ASCII characters that can't be encoded in WIN1252
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x01-\x7F]/g, '') : input
}
export function cleanLogOutput(output: string): string {
  // Removes control characters (0x00-0x1F) except Tab (0x09), LF (0x0A), and CR (0x0D).
  // Also removes DEL (0x7F) and the Replacement Character (0xFFFD).
  // eslint-disable-next-line no-control-regex
  const CLEAN_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/g
  return output.replace(CLEAN_RE, "")
}

/**
 * Check if a script is currently active by querying Overmind's GraphQL API.
 * This is the source of truth for script activation status.
 * @param scriptName The name/id of the script to check
 * @returns true if the script is active, false otherwise
 */
export async function checkIfScriptIsActive(scriptName: string): Promise<boolean> {
  console.log(`[checkIfScriptIsActive] Checking activation status for script: "${scriptName}"`)
  const graphQLClient = new GraphQLClient(GRAPHQL_ENDPOINT)

  try {
    const result: any = await graphQLClient.request(activeScriptConfigQuery, { scriptName })
    const isActive = !!result?.scriptProvisioning?.activeScriptConfig?.id
    console.log(`[checkIfScriptIsActive] Script "${scriptName}" is ${isActive ? 'active' : 'not active'}`)
    return isActive
  } catch (error) {
    // If the query throws (e.g., script not found or not active), return false
    console.log(`[checkIfScriptIsActive] Script "${scriptName}" is not active (query returned error):`, error)
    return false
  }
}