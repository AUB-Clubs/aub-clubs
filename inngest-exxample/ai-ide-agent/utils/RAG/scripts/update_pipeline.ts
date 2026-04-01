#!/usr/bin/env npx tsx

/**
 * Automation Pipeline for AI IDE Embeddings Update
 * Usage: npx tsx update_pipeline.ts [-db]
 *
 * Without -db: Detects diffs in plugin files and doc files, regenerates embeddings
 *              for changed content, and updates local CSV files.
 * With -db:    Additionally cleans the database and publishes CSV data to it.
 *
 * Port of update_pipeline.sh to Node/TypeScript.
 */

import { execFileSync } from "child_process"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, "..", "Examples", "data")
const EXAMPLES_DIR = path.join(__dirname, "..", "Examples")
const DOCS_DIR = path.join(__dirname, "..", "Go Plugin Docs")
const DB_DIR = path.join(__dirname, "..", "db")

// ── Flag Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
let dbMode = false

for (const arg of args) {
  if (arg === "-db" || arg === "--db") {
    dbMode = true
  } else {
    console.error(`Unknown argument: ${arg}`)
    console.error("Usage: npx tsx update_pipeline.ts [-db]")
    process.exit(1)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(script: string, cwd: string, extraArgs: string[] = []): void {
  execFileSync("npx", ["tsx", script, ...extraArgs], {
    cwd,
    stdio: "inherit",
  })
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

console.log("==========================================")
console.log(" AI IDE Embeddings Update Pipeline")
console.log("==========================================")
console.log(`Mode: ${dbMode ? "DB + CSV" : "CSV only"}`)
console.log("")

// Step 1: Update plugin-projects.json
console.log("Step 1: Updating plugin-projects.json from source files...")
if (!fs.existsSync(DATA_DIR)) {
  console.error(`Error: Directory ${DATA_DIR} does not exist.`)
  process.exit(1)
}
run("update_plugin_projects.ts", DATA_DIR)
console.log("")

// Step 2: Detect & Regenerate Example Embeddings
console.log("Step 2: Detecting diffs and regenerating example embeddings...")
run("index.ts", EXAMPLES_DIR)
console.log("")

// Step 3: Detect & Regenerate Doc Embeddings
console.log("Step 3: Detecting diffs and regenerating doc embeddings...")
run("index.ts", DOCS_DIR)
console.log("")

// Steps 4-6 (DB Mode Only)
if (dbMode) {
  console.log("Step 4: Cleaning database...")
  run("clean.ts", DB_DIR)
  console.log("")

  console.log("Step 5: Publishing example embeddings to database...")
  run("index.ts", EXAMPLES_DIR, ["--db"])
  console.log("")

  console.log("Step 6: Publishing doc embeddings to database...")
  run("index.ts", DOCS_DIR, ["--db"])
  console.log("")
}

console.log("==========================================")
console.log(" Pipeline completed successfully!")
console.log("==========================================")
