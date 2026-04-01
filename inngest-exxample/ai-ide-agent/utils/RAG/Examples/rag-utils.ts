import { matchProjects } from "../db/functions.ts"

export type ProjectResult = {
  project_description: string;
  files: Record<string, string>;
}

export async function findNearestMatchingProject(embedding: Array<number>): Promise<ProjectResult | null> {
  const result = await matchProjects(embedding)
  if (!result) return null

  // Map from Prisma result shape to ProjectResult
  const files: Record<string, string> = {}
  for (const [name, code] of Object.entries(result.files)) {
    if (code !== null) files[name] = code
  }

  return {
    project_description: result.project_description ?? "",
    files,
  }
}