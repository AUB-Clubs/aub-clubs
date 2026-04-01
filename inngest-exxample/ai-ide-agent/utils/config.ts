import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { openai, gemini, anthropic } from "@inngest/agent-kit"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
export const LLM_PROVIDER = process.env.LLM_PROVIDER
export const LLM_MODEL = process.env.LLM_MODEL
export const LLM_TEMPERATURE = process.env.LLM_TEMPERATURE
export const VERBOSITY = process.env.LLM_VERBOSITY
export const REASONING_EFFORT = process.env.LLM_REASONING_EFFORT
export const INNGEST_SIGNING_KEY = process.env.INNGEST_SIGNING_KEY
export const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY
export const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL || "http://127.0.0.1:8288"
export const AI_IDE_ENV = process.env.AI_IDE_ENV || 'DEV'
export const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || "https://localhost:10000/pub/query"
export const AI_IDE_PORT = process.env.AI_IDE_PORT ? parseInt(process.env.AI_IDE_PORT) : 3000

const MODELS_WITHOUT_TEMPERATURE = [
  'o1',
  'o1-preview',
  'o1-mini',
  'o3-mini',
  `gpt-5-nano`,
  'gpt-5-mini',
  'gpt-5',
  `gpt-5.1-nano`,
  'gpt-5.1-mini',
  'gpt-5.1',
  'gpt-5.2',
]

const MODELS_WITH_VERBOSITY = [
  'gpt-5.2',
]

const MODELS_WITH_REASONING_EFFORT = [
  'gpt-5.2',
]

/**
 * Check if a model supports the temperature parameter
 */
function supportsTemperature(modelName: string): boolean {
  return !MODELS_WITHOUT_TEMPERATURE.some(prefix => 
    modelName.toLowerCase().startsWith(prefix)
  )
}

function supportsVerbosity(modelName: string): boolean {
  return MODELS_WITH_VERBOSITY.some(prefix => 
    modelName.toLowerCase().startsWith(prefix)
  )
}

function supportsReasoningEffort(modelName: string): boolean {
  return MODELS_WITH_REASONING_EFFORT.some(prefix => 
    modelName.toLowerCase().startsWith(prefix)
  )
}

/**
 * Create model configuration with appropriate parameters based on model capabilities
 */
function getModelConfig(modelName: string, temperature?: number, verbosity?: string, reasoning_effort?: string) {
  const baseConfig: any = { model: modelName }
  
  // Only add temperature if the model supports it and a value is provided
  if (temperature !== undefined && (supportsTemperature(modelName) || (supportsReasoningEffort(modelName) && reasoning_effort === "none"))) {
    baseConfig.temperature = temperature
  }
  // Only add verbosity if the model supports it and a value is provided
  if (verbosity !== undefined && supportsVerbosity(modelName)) {
    baseConfig.text = {
      "verbosity": verbosity
    }
  }
  // Only add reasoning_effort if the model supports it and a value is provided
  if (reasoning_effort !== undefined && supportsReasoningEffort(modelName)) {
    baseConfig.reasoning = {
      "effort": reasoning_effort
    }
  }
  
  return baseConfig
}

/**
 * Get the configured model with appropriate settings
 */
export function getConfiguredModel() {
  const provider = LLM_PROVIDER || 'openai'
  const modelName = LLM_MODEL || 'gpt-5.2'
  const temperature = LLM_TEMPERATURE ? parseFloat(LLM_TEMPERATURE) : undefined
  const verbosity = VERBOSITY || "high"
  const reasoning_effort = REASONING_EFFORT || "xhigh" 

  const modelConfig = getModelConfig(modelName, temperature, verbosity, reasoning_effort)

  switch (provider.toLowerCase()) {
    case 'anthropic':
      return anthropic(modelConfig)
    case 'google_genai':
      return gemini(modelConfig)
    case 'openai':
    default:
      return openai(modelConfig)
  }
}