import { prisma } from "../../db"

/**
 * Create a new embedding project and return its id.
 */
export async function createProject(name: string, description: string): Promise<string> {
  const project = await prisma.embeddingProject.create({
    data: {
      id: crypto.randomUUID(),
      name,
      description,
    },
  })
  return project.id
}

/**
 * Create a new embedding file linked to a project and return its id.
 */
export async function createFile(projectId: string, name: string, code: string): Promise<string> {
  const file = await prisma.embeddingFile.create({
    data: {
      id: crypto.randomUUID(),
      projectId,
      name,
      code,
    },
  })
  return file.id
}

interface MatchedProject {
  project_description: string | null
  files: Record<string, string | null>
}

/**
 * Find the nearest project by cosine similarity on embedding examples,
 * then return the matched project's description and all its files.
 */
export async function matchProjects(queryEmbedding: number[]): Promise<MatchedProject | null> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`

  // Find the project id of the closest embedding example
  const matchedRows = await prisma.$queryRaw<{ projectId: string }[]>`
    SELECT "projectId"
    FROM "EmbeddingExample"
    ORDER BY vector <=> ${embeddingStr}::vector
    LIMIT 1
  `

  if (matchedRows.length === 0) return null

  const matchedProjectId = matchedRows[0].projectId

  // Fetch the project with its files
  const project = await prisma.embeddingProject.findUnique({
    where: { id: matchedProjectId },
    include: { EmbeddingFile: true },
  })

  if (!project) return null

  const files: Record<string, string | null> = {}
  for (const f of project.EmbeddingFile) {
    files[f.name] = f.code
  }

  return {
    project_description: project.description,
    files,
  }
}

interface MatchedGoPluginDoc {
  id: string
  content: string | null
  similarity: number
}

/**
 * Find the nearest Go plugin documents by cosine similarity,
 * filtered by a minimum similarity threshold.
 */
export async function matchGoPluginDocuments(
  queryEmbedding: number[],
  matchThreshold: number,
  matchCount: number
): Promise<MatchedGoPluginDoc[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`

  const rows = await prisma.$queryRaw<MatchedGoPluginDoc[]>`
    SELECT
      id,
      content,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM "GoPluginDoc"
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${matchCount}
  `

  return rows
}
