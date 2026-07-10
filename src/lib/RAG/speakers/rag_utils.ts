import { matchSpeakerDocuments } from "../db/functions";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function findNearestMatchSpeakers(embedding: number[]): Promise<string> {
  // Threshold is intentionally permissive: text-embedding-3-small cosine
  // similarity between short topic queries and structured docs typically lands
  // in 0.3–0.6. The SQL ORDER BY already ranks best-first, so we just need a
  // floor that excludes clearly-irrelevant rows.
  const data = await matchSpeakerDocuments(embedding, 0.2, 10);
  if (!data || data.length === 0) return "";
  return data.map((obj) => obj.content).join("\n");
}

export const allSpeakers: string = fs.readFileSync(path.join(__dirname, "speakers.md"), "utf8");
