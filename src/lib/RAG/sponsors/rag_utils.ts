import {supabase} from "../config"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function findNearestMatchGoPluginDocs(embedding: Array<number>): Promise<string> {
  const { data } = await supabase.rpc('match_sponsors', {
    query_embedding: embedding,
    match_threshold: 0.75,
    match_count: 10
  })

  const match = data.map((obj: any) => obj.content).join('\n')
  return match
}

export const allSponsors: string = fs.readFileSync(path.join(__dirname, "data", "sponsors.md"), "utf8")