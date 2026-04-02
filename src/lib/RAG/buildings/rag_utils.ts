import { matchBuildingDocuments } from "../db/functions";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function findNearestMatchBuildings(embedding: number[]): Promise<string> {
  const data = await matchBuildingDocuments(embedding, 0.75, 10);
  if (!data || data.length === 0) return "";
  return data.map((obj) => obj.content).join("\n");
}

export const allBuildings: string = fs.readFileSync(path.join(__dirname, "buildings.md"), "utf8");
