import express, { Router } from "express"
import { prisma } from "../utils/db"
import { addScript, isScriptNameUsed } from "../utils/inngest/utils"

const scriptsRouter: Router = express.Router()

scriptsRouter.post("/update", async (req, res) => {
  console.log(`[scriptsRouter.POST] Received request to update script`)
  // Handle both parsed array and stringified JSON
  let newFiles: { path: string; content: string }[] = []
  if (typeof req.body.files === 'string') {
    try {
      newFiles = JSON.parse(req.body.files)
    } catch (e) {
      console.error("[scriptsRouter.POST] Failed to parse files string:", e)
      res.status(400).json({ error: "Invalid files format" })
      return
    }
  } else {
    newFiles = req.body.files
  }

  const projectId = req.body.projectId
  console.log(`[scriptsRouter.POST] ProjectId: ${projectId}, New files count: ${newFiles?.length || 0}`)

  if (!projectId) {
    console.warn(`[scriptsRouter.POST] Validation failed - Missing required fields: files=${!!newFiles}, projectId=${!!projectId}`)
    res.status(400).json({ error: "files and projectId are required" })
  } else {
    try {
      console.log(`[scriptsRouter.POST] Fetching existing files from database`)
      const files = await prisma.aIIDEFile.findMany({
        where: {
          projectId: projectId
        }
      })
      console.log(`[scriptsRouter.POST] Found ${files.length} existing files`)

      console.log(`[scriptsRouter.POST] Fetching project details`)
      const project =  await prisma.aIIDEProject.findUnique({
        where: {
          id: projectId
        }
      })

      if (!project) {
        console.error(`[scriptsRouter.POST] Project not found: ${projectId}`)
        res.status(404).json({ error: "Project not found" })
        return
      }
      console.log(`[scriptsRouter.POST] Project found: ${project.name}, scriptName: ${project.scriptName}`)

      console.log(`[scriptsRouter.POST] Building files to update map`)
      const filesToUpdate: { [path: string]: string } = {}

      for (const file of files) {
        filesToUpdate[file.path] = file.content 
      }
      console.log(`[scriptsRouter.POST] Added ${files.length} existing files to update map`)

      for (const file of newFiles) {
        filesToUpdate[file.path] = file.content 
      }
      console.log(`[scriptsRouter.POST] Added ${newFiles.length} new files to update map, total files: ${Object.keys(filesToUpdate).length}`)

      let filesToDelete: string[] = []
      if (typeof req.body.deleteFiles === 'string') {
        try {
          filesToDelete = JSON.parse(req.body.deleteFiles)
        } catch {
          console.warn("[scriptsRouter.POST] Failed to parse deleteFiles string, defaulting to empty array")
        }
      } else if (Array.isArray(req.body.deleteFiles)) {
        filesToDelete = req.body.deleteFiles
      }
      
      console.log(`[scriptsRouter.POST] Files to delete: ${filesToDelete.length}`)

      for (const filePath of filesToDelete) {
        const existingFile = files.find(f => f.path === filePath)
        if (existingFile) {
          console.log(`[scriptsRouter.POST] Deleting file from database: ${filePath} (ID: ${existingFile.id})`)
          await prisma.aIIDEFile.delete({
            where: { id: existingFile.id }
          })
          delete filesToUpdate[filePath]
        } else {
          console.warn(`[scriptsRouter.POST] File to delete not found: ${filePath}`)
        }
      }

      console.log(`[scriptsRouter.POST] Processing ${newFiles.length} files for update/create`)
      for (const file of newFiles) {
        const existingFile = files.find(f => f.path === file.path)
        
        if (existingFile) {
          console.log(`[scriptsRouter.POST] Updating existing file: ${file.path} (ID: ${existingFile.id})`)
          await prisma.aIIDEFile.update({
            where: { id: existingFile.id },
            data: { content: file.content }
          })
        } else {
          console.log(`[scriptsRouter.POST] Creating new file: ${file.path}`)
          await prisma.aIIDEFile.create({
            data: {
              projectId: projectId,
              path: file.path,
              name: file.path.split("/").pop() || file.path,
              content: file.content
            }
          })
        }
      }
      console.log(`[scriptsRouter.POST] All file operations completed`)

      console.log(`[scriptsRouter.POST] Adding script with ${Object.keys(filesToUpdate).length} files`)
      const script = await addScript(filesToUpdate, project?.scriptName as string, project?.scriptDescription || "")
      console.log(`[scriptsRouter.POST] Script updated successfully, scriptConfigId: ${script.scriptConfigId}`)
      
      // Always create a new script record to maintain history
      await prisma.aIIDEAIScript.create({
        data: {
          projectId: projectId,
          scriptConfigId: script.scriptConfigId,
          created: script.created,
          createdBy: script.createdBy
        }
      })

      res.status(201).json({ message: "Script updated", scriptID: script.scriptConfigId })
    } catch (error) {
      console.error("Failed to update Script", error)
      res.status(500).json({ error: "Failed to update Script: " + error })
    }
  }
})

scriptsRouter.post("/validatescriptname", async (req, res) => {
  const scriptName = req.body.scriptName
  console.log(`[scriptsRouter.POST /validatescriptname] Validating script name: ${scriptName}`)

  if (typeof scriptName !== "string") {
    res.status(400).json({ error: "scriptName must be a string" })
    return
  }

  if (!scriptName) {
    console.warn(`[scriptsRouter.POST /validatescriptname] No script name provided`)
    res.status(400).json({ error: "scriptName is required" })
    return
  }

  if (!scriptNameRegexChecker(scriptName)) {
    console.log(`[scriptsRouter.POST /validatescriptname] Script name failed regex validation: ${scriptName}`)
    res.status(400).json({ isValid: false, error: "Script name is invalid. It must start with a letter and contain only alphanumeric characters and underscores." })
    return
  }
  
  if (await isScriptNameUsed(scriptName)) {
    console.log(`[scriptsRouter.POST /validatescriptname] Script name already used: ${scriptName}`)
    res.status(409).json({ isValid: false, error: "Script name is already in use" })
  } else {
    console.log(`[scriptsRouter.POST /validatescriptname] Script name is valid and available: ${scriptName}`)
    res.status(200).json({ isValid: true })
  }
})

const scriptNameRegexChecker = (scriptName: string): boolean => {
  // Script name must be alphanumeric, underscores, no spaces, starts with a letter
  const regex = /^[A-Za-z][A-Za-z0-9_]*$/
  return regex.test(scriptName)
}

export default scriptsRouter
