import { prisma } from "../../db"

/**
 * Delete all embedding examples, files, and projects from the DB.
 */
export async function cleanExamples(): Promise<void> {
  // Delete in order: examples -> files -> projects (due to FK constraints)
  await prisma.embeddingExample.deleteMany({})
  await prisma.embeddingFile.deleteMany({})
  await prisma.embeddingProject.deleteMany({})
  console.log("Cleaned all embedding examples, files, and projects from DB")
}

/**
 * Delete all GoPluginDoc rows from the DB.
 */
export async function cleanDocs(): Promise<void> {
  await prisma.goPluginDoc.deleteMany({})
  console.log("Cleaned all GoPluginDoc rows from DB")
}

/**
 * Clean everything when run directly.
 */
async function main() {
  await cleanExamples()
  await cleanDocs()
  await prisma.$disconnect()
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("clean.ts") || process.argv[1]?.endsWith("clean")
if (isMain) {
  main().catch((err) => {
    console.error("Clean failed:", err)
    process.exit(1)
  })
}
