import { matchGoPluginDocuments } from "../db/functions.ts"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function findNearestMatchGoPluginDocs(embedding: Array<number>): Promise<string> {
  const data = await matchGoPluginDocuments(embedding, 0.5, 10)

  if (!data || data.length === 0) {
    console.warn("No data returned from matchGoPluginDocuments")
    return ""
  }

  const match = data.map((obj: any) => obj.content).join('\n')
  return match
}

export const allGoPluginDocs: string = [
  fs.readFileSync(path.join(__dirname, "./data/docs.md"), "utf8"),
  fs.readFileSync(path.join(__dirname, "./data/SCRIPTING_GUIDE.md"), "utf8")
].join("\n\n")