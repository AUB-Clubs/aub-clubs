import { createProject, createFile } from '../db/functions.ts'
import { prisma } from '../../db'
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import type { ProjectResult } from "./rag-utils.ts"
import { createEmbedding } from '../utils.ts'
import projects from './data/plugin-projects.json' assert { type: "json" }
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSV_PATH = path.join(__dirname, "data", "examples_embeddings.csv")

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

interface CsvRow {
  projectName: string
  fileName: string
  chunkIndex: number
  codeChunk: string
  embedding: number[]
  fileContent: string
}

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function parseCsvField(field: string): string {
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"')
  }
  return field
}

/** Parse CSV using proper field-level parsing that handles quoted fields with commas/newlines */
function parseCsvLine(csvContent: string): CsvRow[] {
  const rows: CsvRow[] = []
  const lines = csvContent.split('\n')

  // Skip header
  let i = 1
  while (i < lines.length) {
    if (lines[i].trim() === '') { i++; continue }

    // We need to handle fields that may contain newlines inside quotes
    let currentLine = lines[i]
    // Count unescaped quotes - if odd, we need to join with next line
    while ((currentLine.match(/"/g) || []).length % 2 !== 0 && i + 1 < lines.length) {
      i++
      currentLine += '\n' + lines[i]
    }

    // Parse fields from currentLine
    const fields: string[] = []
    let fieldStart = 0
    let inQuotes = false

    for (let j = 0; j <= currentLine.length; j++) {
      if (j === currentLine.length || (currentLine[j] === ',' && !inQuotes)) {
        fields.push(currentLine.slice(fieldStart, j))
        fieldStart = j + 1
      } else if (currentLine[j] === '"') {
        if (inQuotes && j + 1 < currentLine.length && currentLine[j + 1] === '"') {
          j++ // Skip escaped quote
        } else {
          inQuotes = !inQuotes
        }
      }
    }

    if (fields.length >= 6) {
      rows.push({
        projectName: parseCsvField(fields[0]),
        fileName: parseCsvField(fields[1]),
        chunkIndex: parseInt(fields[2], 10),
        codeChunk: parseCsvField(fields[3]),
        embedding: JSON.parse(parseCsvField(fields[4])),
        fileContent: parseCsvField(fields[5]),
      })
    }

    i++
  }

  return rows
}

function writeCsv(rows: CsvRow[]): void {
  const header = "projectName,fileName,chunkIndex,codeChunk,embedding,fileContent"
  const lines = rows.map(r =>
    [
      escapeCsvField(r.projectName),
      escapeCsvField(r.fileName),
      r.chunkIndex.toString(),
      escapeCsvField(r.codeChunk),
      escapeCsvField(JSON.stringify(r.embedding)),
      escapeCsvField(r.fileContent),
    ].join(',')
  )
  fs.writeFileSync(CSV_PATH, header + '\n' + lines.join('\n') + '\n')
}

function readCsv(): CsvRow[] {
  if (!fs.existsSync(CSV_PATH)) return []
  return parseCsvLine(fs.readFileSync(CSV_PATH, 'utf8'))
}

// ─── Text Splitting ───────────────────────────────────────────────────────────

async function splitDocument(data: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
    separators: ["\n\n", "\n", ".", " ", ""]
  })
  return await splitter.splitText(data)
}

// ─── Embedding Generation ─────────────────────────────────────────────────────

/** Generate embeddings for a project and return CSV rows (does NOT write to DB or CSV) */
async function generateProjectEmbeddings(project: ProjectResult, projectName: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = []

  for (const [fileName, fileContent] of Object.entries(project.files)) {
    console.log(`Processing file: ${fileName}\nFile size: ${fileContent.length} characters`)
    const chunkData = await splitDocument(fileContent)
    chunkData.push(`${projectName}`)

    for (let chunkIndex = 0; chunkIndex < chunkData.length; chunkIndex++) {
      const chunk = chunkData[chunkIndex]
      const embedding = await createEmbedding(chunk)
      rows.push({
        projectName,
        fileName,
        chunkIndex,
        codeChunk: chunk,
        embedding,
        fileContent,
      })
    }
    console.log(`Created ${chunkData.length} chunks for file: ${fileName}`)
    console.log(`Finished processing file: ${fileName}\n`)
  }

  return rows
}

/** Store CSV rows into the database using Prisma */
async function storeProjectInDb(projectName: string, rows: CsvRow[]): Promise<void> {
  if (rows.length === 0) return
  
  const project = (projects as Record<string, ProjectResult>)[projectName]
  const description = project?.project_description ?? ""

  const projectId = await createProject(projectName, description)
  console.log(`Created project with ID: ${projectId}`)

  // Group rows by fileName
  const fileGroups = new Map<string, CsvRow[]>()
  for (const row of rows) {
    const group = fileGroups.get(row.fileName) ?? []
    group.push(row)
    fileGroups.set(row.fileName, group)
  }

  for (const [fileName, fileRows] of fileGroups) {
    const fileContent = fileRows[0].fileContent
    const fileId = await createFile(projectId, fileName, fileContent)
    console.log(`Created file with ID: ${fileId}`)

    // Insert embedding examples using raw SQL for vector type
    for (const row of fileRows) {
      const embeddingStr = `[${row.embedding.join(",")}]`
      await prisma.$executeRaw`
        INSERT INTO "EmbeddingExample" (id, "projectId", "fileId", "codeChunk", vector, "createdAt")
        VALUES (${crypto.randomUUID()}, ${projectId}, ${fileId}, ${row.codeChunk}, ${embeddingStr}::vector, NOW())
      `
    }
    console.log(`Stored ${fileRows.length} embeddings for file: ${fileName}`)
  }
}

// ─── Diff Detection ───────────────────────────────────────────────────────────

interface DiffResult {
  newProjects: string[]
  modifiedProjects: string[]
  removedProjects: string[]
}

function detectDiffs(currentProjects: Record<string, ProjectResult>, existingRows: CsvRow[]): DiffResult {
  const existingProjectFiles = new Map<string, Map<string, string>>()
  for (const row of existingRows) {
    if (!existingProjectFiles.has(row.projectName)) {
      existingProjectFiles.set(row.projectName, new Map())
    }
    existingProjectFiles.get(row.projectName)!.set(row.fileName, row.fileContent)
  }

  const currentProjectNames = new Set(Object.keys(currentProjects))
  const existingProjectNames = new Set(existingProjectFiles.keys())

  const newProjects: string[] = []
  const modifiedProjects: string[] = []
  const removedProjects: string[] = []

  // New projects
  for (const name of currentProjectNames) {
    if (!existingProjectNames.has(name)) {
      newProjects.push(name)
    }
  }

  // Removed projects
  for (const name of existingProjectNames) {
    if (!currentProjectNames.has(name)) {
      removedProjects.push(name)
    }
  }

  // Modified projects (check file contents)
  for (const name of currentProjectNames) {
    if (!existingProjectNames.has(name)) continue // already in newProjects
    const currentFiles = currentProjects[name].files
    const existingFiles = existingProjectFiles.get(name)!

    // Check if file set changed or content changed
    const currentFileNames = new Set(Object.keys(currentFiles))
    const existingFileNames = new Set(existingFiles.keys())

    let modified = false
    if (currentFileNames.size !== existingFileNames.size) {
      modified = true
    } else {
      for (const fileName of currentFileNames) {
        if (!existingFileNames.has(fileName)) { modified = true; break }
        if (currentFiles[fileName] !== existingFiles.get(fileName)) { modified = true; break }
      }
    }

    if (modified) {
      modifiedProjects.push(name)
    }
  }

  return { newProjects, modifiedProjects, removedProjects }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dbMode = args.includes('--db')
  const projectsFlag = args.find(a => a.startsWith('--projects='))
  const specifiedProjects = projectsFlag ? projectsFlag.split('=')[1].split(',') : null

  const allProjects = projects as Record<string, ProjectResult>

  if (dbMode) {
    // ── DB Mode: Read CSV and publish to database ──
    console.log("DB Mode: Publishing CSV data to database...")
    const csvRows = readCsv()
    if (csvRows.length === 0) {
      console.log("No CSV data found. Run without --db first to generate embeddings.")
      return
    }

    // Group by project and store
    const projectGroups = new Map<string, CsvRow[]>()
    for (const row of csvRows) {
      const group = projectGroups.get(row.projectName) ?? []
      group.push(row)
      projectGroups.set(row.projectName, group)
    }

    for (const [projectName, rows] of projectGroups) {
      console.log(`Publishing project: ${projectName}`)
      await storeProjectInDb(projectName, rows)
    }

    console.log("DB publishing complete!")
  } else {
    // ── CSV Mode: Detect diffs, regenerate changed embeddings, update CSV ──
    const existingRows = readCsv()
    const diffs = detectDiffs(allProjects, existingRows)

    // Determine which projects to process
    let projectsToProcess: string[]
    if (specifiedProjects) {
      projectsToProcess = specifiedProjects
    } else if (existingRows.length === 0) {
      // First run: process all
      projectsToProcess = Object.keys(allProjects)
      console.log("No existing CSV found. Processing all projects...")
    } else {
      projectsToProcess = [...diffs.newProjects, ...diffs.modifiedProjects]
    }

    // Report diffs
    if (diffs.newProjects.length > 0) console.log(`New projects: ${diffs.newProjects.join(', ')}`)
    if (diffs.modifiedProjects.length > 0) console.log(`Modified projects: ${diffs.modifiedProjects.join(', ')}`)
    if (diffs.removedProjects.length > 0) console.log(`Removed projects: ${diffs.removedProjects.join(', ')}`)
    if (projectsToProcess.length === 0 && diffs.removedProjects.length === 0) {
      console.log("No changes detected. CSV is up to date.")
      return
    }

    // Start with existing rows, remove entries for projects we're regenerating or that were removed
    const projectsToRemoveFromCsv = new Set([...projectsToProcess, ...diffs.removedProjects])
    let updatedRows = existingRows.filter(r => !projectsToRemoveFromCsv.has(r.projectName))

    // Generate embeddings for changed/new projects
    for (const projectName of projectsToProcess) {
      const project = allProjects[projectName]
      if (!project) {
        console.warn(`Project ${projectName} not found in plugin-projects.json, skipping.`)
        continue
      }
      console.log(`\nGenerating embeddings for: ${projectName}`)
      const newRows = await generateProjectEmbeddings(project, projectName)
      updatedRows = updatedRows.concat(newRows)
    }

    // Write updated CSV
    writeCsv(updatedRows)
    console.log(`\nCSV updated at: ${CSV_PATH}`)
    console.log(`Total rows: ${updatedRows.length}`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})