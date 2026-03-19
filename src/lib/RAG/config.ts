import { config } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

config({ path: path.resolve(__dirname, "../../../.env") })

import OpenAI from 'openai'
import { createClient } from "@supabase/supabase-js"

/** OpenAI config */
if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API key is missing or invalid.")
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/** Supabase config */
const privateKey = process.env.SUPABASE_API_KEY
if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`)
const url = process.env.SUPABASE_API_URL
if (!url) throw new Error(`Expected env var SUPABASE_API_URL`)
export const supabase = createClient(url, privateKey)