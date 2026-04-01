import { openai } from '../config.ts'
import { prisma } from '../../db'
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { fileURLToPath } from "url"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const docsPath = path.join(__dirname, "./data/docs.md")
const guidePath = path.join(__dirname, "./data/SCRIPTING_GUIDE.md")
const CSV_PATH = path.join(__dirname, "data", "docs_embeddings.csv")
const HASHES_PATH = path.join(__dirname, "data", "docs_hashes.json")

// ─── Hash Helpers ─────────────────────────────────────────────────────────────

function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8")
  return crypto.createHash("sha256").update(content).digest("hex")
}

interface DocHashes {
  docs: string
  guide: string
}

function readHashes(): DocHashes | null {
  if (!fs.existsSync(HASHES_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(HASHES_PATH, "utf8"))
  } catch {
    return null
  }
}

function writeHashes(hashes: DocHashes): void {
  fs.writeFileSync(HASHES_PATH, JSON.stringify(hashes, null, 2))
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

interface CsvRow {
  chunkIndex: number
  content: string
  embedding: number[]
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

function parseCsvLine(csvContent: string): CsvRow[] {
  const rows: CsvRow[] = []
  const lines = csvContent.split('\n')

  let i = 1 // skip header
  while (i < lines.length) {
    if (lines[i].trim() === '') { i++; continue }

    let currentLine = lines[i]
    while ((currentLine.match(/"/g) || []).length % 2 !== 0 && i + 1 < lines.length) {
      i++
      currentLine += '\n' + lines[i]
    }

    const fields: string[] = []
    let fieldStart = 0
    let inQuotes = false

    for (let j = 0; j <= currentLine.length; j++) {
      if (j === currentLine.length || (currentLine[j] === ',' && !inQuotes)) {
        fields.push(currentLine.slice(fieldStart, j))
        fieldStart = j + 1
      } else if (currentLine[j] === '"') {
        if (inQuotes && j + 1 < currentLine.length && currentLine[j + 1] === '"') {
          j++
        } else {
          inQuotes = !inQuotes
        }
      }
    }

    if (fields.length >= 3) {
      rows.push({
        chunkIndex: parseInt(fields[0], 10),
        content: parseCsvField(fields[1]),
        embedding: JSON.parse(parseCsvField(fields[2])),
      })
    }

    i++
  }

  return rows
}

function writeCsv(rows: CsvRow[]): void {
  const header = "chunkIndex,content,embedding"
  const lines = rows.map(r =>
    [
      r.chunkIndex.toString(),
      escapeCsvField(r.content),
      escapeCsvField(JSON.stringify(r.embedding)),
    ].join(',')
  )
  fs.writeFileSync(CSV_PATH, header + '\n' + lines.join('\n') + '\n')
}

function readCsv(): CsvRow[] {
  if (!fs.existsSync(CSV_PATH)) return []
  return parseCsvLine(fs.readFileSync(CSV_PATH, 'utf8'))
}

// ─── Splitting & Embedding ────────────────────────────────────────────────────

async function splitDocument(text: string) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
    separators: ["\n\n", "\n", "##", "###", ".", " ", ""]
  })
  return await splitter.createDocuments([text])
}

async function generateDocsEmbeddings(): Promise<CsvRow[]> {
  const docsData = fs.readFileSync(docsPath, "utf8")
  const guideData = fs.readFileSync(guidePath, "utf8")
  const combinedData = docsData + "\n\n" + guideData + "\n\n"

  const documents = await splitDocument(combinedData)
  console.log(`Split into ${documents.length} chunks`)

  const rows: CsvRow[] = await Promise.all(documents.map(async (doc, index) => {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: doc.pageContent,
    })

    return {
      chunkIndex: index,
      content: doc.pageContent,
      embedding: embeddingResponse.data[0].embedding,
    }
  }))

  return rows
}

// ─── DB Publishing ────────────────────────────────────────────────────────────

async function publishDocsToDb(rows: CsvRow[]): Promise<void> {
  for (const row of rows) {
    const embeddingStr = `[${row.embedding.join(",")}]`
    await prisma.$executeRaw`
      INSERT INTO "GoPluginDoc" (id, content, embedding, "createdAt")
      VALUES (${crypto.randomUUID()}, ${row.content}, ${embeddingStr}::vector, NOW())
    `
  }
  console.log(`Inserted ${rows.length} doc embeddings into DB`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dbMode = args.includes('--db')
  const forceMode = args.includes('--force')

  if (dbMode) {
    // ── DB Mode: Read CSV and publish to database ──
    console.log("DB Mode: Publishing docs CSV data to database...")
    const csvRows = readCsv()
    if (csvRows.length === 0) {
      console.log("No CSV data found. Run without --db first to generate embeddings.")
      return
    }

    await publishDocsToDb(csvRows)
    console.log("DB publishing complete!")
  } else {
    // ── CSV Mode: Detect diffs, regenerate if needed ──
    const currentHashes: DocHashes = {
      docs: fileHash(docsPath),
      guide: fileHash(guidePath),
    }
    const storedHashes = readHashes()

    const hasDiffs = forceMode || !storedHashes ||
      storedHashes.docs !== currentHashes.docs ||
      storedHashes.guide !== currentHashes.guide

    if (!hasDiffs) {
      console.log("No changes detected in doc files. CSV is up to date.")
      return
    }

    if (forceMode) {
      console.log("Force mode: regenerating all doc embeddings...")
    } else {
      console.log("Changes detected in doc files. Regenerating ALL doc embeddings (overlap requires full regeneration)...")
      if (storedHashes) {
        if (storedHashes.docs !== currentHashes.docs) console.log("  - docs.md changed")
        if (storedHashes.guide !== currentHashes.guide) console.log("  - SCRIPTING_GUIDE.md changed")
      } else {
        console.log("  - No stored hashes found (first run)")
      }
    }

    const rows = await generateDocsEmbeddings()
    writeCsv(rows)
    writeHashes(currentHashes)

    console.log(`\nCSV updated at: ${CSV_PATH}`)
    console.log(`Total rows: ${rows.length}`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
