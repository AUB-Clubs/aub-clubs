import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { fileURLToPath } from "url"

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the agent's working directory 
// We will look for SDK relative to us or in typical Docker locations
const PROJECT_ROOT = path.resolve(__dirname, "../../../../../")

// SDK Paths
const LOCAL_SDK_PATH = PROJECT_ROOT
const DOCKER_SDK_PATH = "/src" // As defined in overmind-base Dockerfile

export const runVerification = async (files?: Record<string, string>): Promise<string> => {
    let sandboxDir = ""
    try {
        // 1. Determine Environment (Local vs Docker)
        let sdkPath = LOCAL_SDK_PATH
        // We check for go.mod to ensure the SDK is actually present and valid
        if (fs.existsSync(path.join(DOCKER_SDK_PATH, "go.mod"))) {
            sdkPath = DOCKER_SDK_PATH
            console.log("Using Docker SDK Path: " + sdkPath)
        } else {
            console.log("Using Local SDK Path: " + sdkPath)
        }

        // 2. Setup Sandbox
        const sandboxId = Math.random().toString(36).substring(7)
        sandboxDir = path.join("/tmp", `agent-build-${sandboxId}`)
        fs.mkdirSync(sandboxDir, { recursive: true })

        console.log(`Sandbox created at ${sandboxDir}`)

        // 3. Scaffolding - Copy SDK files (go.mod, go.sum, lib, cmd)

        // Copy go.mod/sum
        fs.copyFileSync(path.join(sdkPath, "go.mod"), path.join(sandboxDir, "go.mod"))
        fs.copyFileSync(path.join(sdkPath, "go.sum"), path.join(sandboxDir, "go.sum"))

        // Copy lib
        fs.cpSync(path.join(sdkPath, "lib"), path.join(sandboxDir, "lib"), { recursive: true })

        // Copy cmd 
        fs.cpSync(path.join(sdkPath, "cmd"), path.join(sandboxDir, "cmd"), { recursive: true })

        // Copy public
        if (fs.existsSync(path.join(sdkPath, "public"))) {
            fs.cpSync(path.join(sdkPath, "public"), path.join(sandboxDir, "public"), { recursive: true })
        }

        // Clean up plugins in sandbox (remove everything in plugins dir)
        const sandPlugins = path.join(sandboxDir, "public/cmd/script/go_plugin/plugins")
        if (fs.existsSync(sandPlugins)) {
            // In node < 14, rmSync recursive was experimental or different. Assuming modern node.
            fs.rmSync(sandPlugins, { recursive: true, force: true })
        }
        fs.mkdirSync(sandPlugins, { recursive: true })

        // 4. Inject Dynamic Plugin from Memory
        const sandDynamic = path.join(sandPlugins, "dynamic")
        fs.mkdirSync(sandDynamic, { recursive: true })

        if (files) {
            let filesInjected = 0
            for (const [filePath, content] of Object.entries(files)) {
                // filePath is likely "script.go" or "subdir/helper.go"
                // Clean the path to be safe
                const safePath = path.join(sandDynamic, filePath)

                // Ensure we stay within sandDynamic
                if (!safePath.startsWith(sandDynamic)) {
                    console.warn(`[Verification] Skipping unsafe path: ${filePath}`)
                    continue
                }

                const dir = path.dirname(safePath)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

                fs.writeFileSync(safePath, content)
                filesInjected++
            }
            console.log(`Injected ${filesInjected} files from memory into sandbox`)
        } else {
            return "Error: No files provided for verification."
        }

        // 5. Create Main Entrypoint
        const mainGoContent = `package main
import _ "github.com/Kerrigan-Automation/overmind/public/cmd/script/go_plugin/plugins/dynamic"
func main() {}
`
        fs.writeFileSync(path.join(sandboxDir, "main.go"), mainGoContent)

        // 6. Compile
        console.log("Running go build...")
        // We set GOCACHE to a temp dir potentially if we want total isolation, but shared cache speeds it up.
        // We do set mod cache if we want to rely on the copied go.mod
        const { stdout } = await execAsync("go build -v main.go", { cwd: sandboxDir })

        // Cleanup
        fs.rmSync(sandboxDir, { recursive: true, force: true })

        return `Verification Passed! Compilation successful.\n${stdout}`

    } catch (e: any) {
        // Cleanup on error too
        if (sandboxDir && fs.existsSync(sandboxDir)) {
            try {
                fs.rmSync(sandboxDir, { recursive: true, force: true })
            } catch (cleanupErr) {
                console.error("Failed to cleanup sandbox:", cleanupErr)
            }
        }

        // Capture build errors
        const errorMsg = e.stderr || e.message
        return `COMPILATION ERROR:\n${errorMsg}\n\nReview the error above and fix your code.`
    }
}