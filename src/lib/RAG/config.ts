import { config } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

config({ path: path.resolve(__dirname, "../../../.env") })

import OpenAI from 'openai'

/** OpenAI config */
if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API key is missing or invalid.")
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})