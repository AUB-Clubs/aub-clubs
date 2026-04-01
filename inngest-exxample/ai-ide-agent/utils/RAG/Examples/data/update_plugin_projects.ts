#!/usr/bin/env npx tsx

/**
 * Script to update plugin-projects.json based on current plugin directories.
 * Scans plugin directories across customer and public paths and generates the JSON structure.
 *
 * Plugin source directories:
 *   - customer/kerrigan/cmd/script/go_plugin/plugins
 *   - customer/rivian/cmd/script/go_plugin/plugins
 *   - public/cmd/script/go_plugin/plugins
 *
 * Port of update_plugin_projects.sh to Node/TypeScript.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Navigate up to the overmind root: data -> Examples -> RAG -> utils -> ai-ide-agent -> "AI IDE" -> sandpit -> overmind
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..")

// All plugin source directories to scan
const PLUGIN_SOURCES = [
  // Generate embeddings for only kerrigan plugins.
  { label: "kerrigan", dir: path.join(REPO_ROOT, "customer", "kerrigan", "cmd", "script", "go_plugin", "plugins") },
]

const DESCRIPTIONS_FILE = path.join(__dirname, "descriptions.json")
const OUTPUT_FILE = path.join(__dirname, "plugin-projects.json")

// Validate that at least one plugin directory exists
const existingSources = PLUGIN_SOURCES.filter(s => fs.existsSync(s.dir))
if (existingSources.length === 0) {
  console.error("Error: No plugin directories found. Searched:")
  for (const s of PLUGIN_SOURCES) console.error(`  - ${s.dir}`)
  process.exit(1)
}
if (!fs.existsSync(DESCRIPTIONS_FILE)) {
  console.error(`Error: descriptions.json not found: ${DESCRIPTIONS_FILE}`)
  process.exit(1)
}

function readDescriptions(): Record<string, string> {
  return JSON.parse(fs.readFileSync(DESCRIPTIONS_FILE, "utf-8"))
}

function writeDescriptions(descriptions: Record<string, string>): void {
  fs.writeFileSync(DESCRIPTIONS_FILE, JSON.stringify(descriptions, null, 2), "utf-8")
}

console.log("Building plugin-projects.json...")

const descriptions = readDescriptions()
const result: Record<string, { project_description: string; files: Record<string, string> }> = {}
const pluginNames: string[] = []

for (const source of existingSources) {
  console.log(`\nScanning [${source.label}]: ${source.dir}`)

  for (const entry of fs.readdirSync(source.dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const pluginName = entry.name
    const pluginDir = path.join(source.dir, pluginName)

    // Skip if no .go files exist
    const goFiles = fs.readdirSync(pluginDir).filter(f => f.endsWith(".go"))
    if (goFiles.length === 0) {
      console.log(`Skipping ${pluginName} (no .go files)`)
      continue
    }

    // Get description, add empty one if missing
    let description = descriptions[pluginName]
    if (description === undefined || description === null) {
      console.log(`Warning: No description found for ${pluginName}, adding empty description to descriptions.json...`)
      descriptions[pluginName] = ""
      writeDescriptions(descriptions)
      description = ""
    }

    console.log(`Processing plugin: ${pluginName}`)

    const files: Record<string, string> = {}
    for (const goFile of goFiles) {
      const filePath = path.join(pluginDir, goFile)
      files[goFile] = fs.readFileSync(filePath, "utf-8").replace(/\n$/, "")
    }

    result[pluginName] = {
      project_description: description,
      files,
    }
    pluginNames.push(pluginName)
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf-8")

console.log("")
console.log(`Successfully generated ${OUTPUT_FILE}`)
console.log(`Plugins processed (${pluginNames.length}):`)
for (const name of pluginNames) {
  console.log(`  ${name}`)
}
