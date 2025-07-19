#!/usr/bin/env node
/* eslint-disable no-console */
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { resolve } from "path"
import { installPackage } from "@antfu/install-pkg"
import { cancel, confirm, intro, isCancel, outro, select, spinner, text } from "@clack/prompts"
import { downloadTemplate as download } from "giget"
import pc from "picocolors"
import { readPackage } from "read-pkg"
import terminalLink from "terminal-link"

interface Template {
  name: string
  description: string
  path: string
}

interface GitHubContent {
  name: string
  type: string
  download_url?: string
}

interface GitHubFile {
  content: string
}

interface NpmPackageData {
  version: string
}

type PackageJson = Awaited<ReturnType<typeof readPackage>>

async function fetchTemplates(): Promise<Template[]> {
  const s = spinner()
  s.start("Discovering templates...")

  try {
    // Fetch examples directory contents
    const response = await fetch(
      "https://api.github.com/repos/noxify/vorsteh-queue/contents/examples",
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const contents = (await response.json()) as GitHubContent[]
    const templates: Template[] = []

    // Process each directory in examples/
    for (const item of contents) {
      if (item.type === "dir") {
        try {
          // Fetch package.json for each example
          const pkgResponse = await fetch(
            `https://api.github.com/repos/noxify/vorsteh-queue/contents/examples/${item.name}/package.json`,
          )
          if (pkgResponse.ok) {
            const pkgData = (await pkgResponse.json()) as GitHubFile
            const pkgContent = JSON.parse(atob(pkgData.content)) as Partial<PackageJson>

            templates.push({
              name: pkgContent.name ?? item.name,
              description: pkgContent.description ?? `${item.name} example`,
              path: `examples/${item.name}`,
            })
          }
        } catch (error) {
          // Skip directories without valid package.json
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          console.warn(pc.yellow(`⚠️  Skipping ${item.name}: ${error}`))
        }
      }
    }

    s.stop(`Found ${templates.length} templates`)
    return templates
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    s.stop("Failed to fetch templates")
    // Fallback to hardcoded templates

    console.warn(pc.yellow("⚠️  Using fallback templates"))
    return [
      {
        name: "drizzle-postgres",
        description: "Drizzle ORM + postgres.js",
        path: "examples/drizzle-postgres",
      },
      {
        name: "drizzle-pglite",
        description: "Drizzle ORM + PGlite (Embedded)",
        path: "examples/drizzle-pglite",
      },
    ]
  }
}

async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as NpmPackageData
    return `^${data.version}`
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.warn(pc.yellow(`⚠️  Could not fetch latest version for ${packageName}, using '*'`))
    return "*"
  }
}

async function downloadTemplate(template: Template, targetDir: string): Promise<void> {
  const s = spinner()
  s.start("Downloading template...")

  try {
    await download(`github:noxify/vorsteh-queue/${template.path}`, {
      dir: targetDir,
      offline: false,
    })
    s.stop("Template downloaded successfully!")
  } catch (error) {
    s.stop("Failed to download template")
    throw error
  }
}

async function updatePackageJson(targetDir: string, projectName: string): Promise<void> {
  const s = spinner()
  s.start("Updating package.json...")

  try {
    if (!existsSync(targetDir)) {
      s.stop("Target directory not found")
      return
    }

    const packageJson = await readPackage({ cwd: targetDir })

    // Update project name
    const updatedPackageJson = {
      ...packageJson,
      name: projectName,
    }

    // Get latest versions
    const [coreVersion, adapterVersion] = await Promise.all([
      getLatestVersion("@vorsteh-queue/core"),
      getLatestVersion("@vorsteh-queue/adapter-drizzle"),
    ])

    // Replace workspace dependencies
    if (updatedPackageJson.dependencies) {
      if (updatedPackageJson.dependencies["@vorsteh-queue/core"]) {
        updatedPackageJson.dependencies["@vorsteh-queue/core"] = coreVersion
      }
      if (updatedPackageJson.dependencies["@vorsteh-queue/adapter-drizzle"]) {
        updatedPackageJson.dependencies["@vorsteh-queue/adapter-drizzle"] = adapterVersion
      }
    }

    // Remove workspace-specific fields
    delete updatedPackageJson.private

    writeFileSync(resolve(targetDir, "package.json"), JSON.stringify(updatedPackageJson, null, 2))
    s.stop("Package.json updated!")
  } catch (error) {
    s.stop("Failed to update package.json")
    throw error
  }
}

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2)
  let projectName = args.find((arg) => !arg.startsWith("-"))
  const pmFlag = args.find((arg) => arg.startsWith("--package-manager=") || arg.startsWith("-pm="))
  const templateFlag = args.find((arg) => arg.startsWith("--template=") || arg.startsWith("-t="))
  const quietMode = args.includes("--quiet") || args.includes("-q")
  const cliPackageManager = pmFlag?.split("=")[1]
  const cliTemplate = templateFlag?.split("=")[1]

  // Override console methods in quiet mode
  if (quietMode) {
    console.clear = () => null
    console.log = () => null
    console.warn = () => null
  }

  if (!quietMode) {
    console.clear()
    intro(pc.bgCyan(pc.black(" create-vorsteh-queue ")))
  }

  if (!projectName) {
    const result = await text({
      message: "What is your project name?",
      placeholder: "my-queue-app",
      validate: (value) => {
        if (!value) return "Project name is required"
        if (!/^[a-z0-9-_]+$/.test(value))
          return "Project name must contain only lowercase letters, numbers, hyphens, and underscores"
        return undefined
      },
    })

    if (isCancel(result)) {
      cancel("Operation cancelled")
      return process.exit(0)
    }

    projectName = result
  } else {
    // Validate CLI argument
    if (!/^[a-z0-9-_]+$/.test(projectName)) {
      cancel("Project name must contain only lowercase letters, numbers, hyphens, and underscores")
      return process.exit(1)
    }
  }

  // Fetch available templates dynamically
  const templates = await fetchTemplates()

  if (templates.length === 0) {
    cancel("No templates available")
    return process.exit(1)
  }

  let template
  if (cliTemplate) {
    // Find template by name or path
    template = templates.find(
      (t) =>
        t.name === cliTemplate ||
        t.path.endsWith(cliTemplate) ||
        t.path === `examples/${cliTemplate}`,
    )

    if (!template) {
      const availableTemplates = templates.map((t) => t.name).join(", ")
      cancel(`Template "${cliTemplate}" not found. Available templates: ${availableTemplates}`)
      return process.exit(1)
    }
  } else {
    template = await select({
      message: "Choose a template:",
      options: templates.map((t) => ({
        value: t,
        label: t.name,
        hint: t.description,
      })),
    })

    if (isCancel(template)) {
      cancel("Operation cancelled")
      return process.exit(0)
    }
  }

  const installDeps = await confirm({
    message: "Install dependencies?",
    initialValue: true,
  })

  if (isCancel(installDeps)) {
    cancel("Operation cancelled")
    return process.exit(0)
  }

  let packageManager = "npm"
  if (installDeps) {
    if (cliPackageManager) {
      // Validate CLI package manager
      const validManagers = ["npm", "pnpm", "yarn", "bun"]
      if (validManagers.includes(cliPackageManager)) {
        packageManager = cliPackageManager
      } else {
        cancel(
          `Invalid package manager: ${cliPackageManager}. Valid options: ${validManagers.join(", ")}`,
        )
        return process.exit(1)
      }
    } else {
      const result = await select({
        message: "Which package manager?",
        options: [
          { value: "npm", label: "npm" },
          { value: "pnpm", label: "pnpm" },
          { value: "yarn", label: "yarn" },
          { value: "bun", label: "bun", hint: "Experimental - some database drivers may not work" },
        ],
      })

      if (isCancel(result)) {
        cancel("Operation cancelled")
        return process.exit(0)
      }

      packageManager = result as string
    }
  }

  // Create project directory
  const targetDir = resolve(projectName)

  if (existsSync(targetDir)) {
    cancel(`Directory ${projectName} already exists`)
    return process.exit(1)
  }

  mkdirSync(targetDir, { recursive: true })

  try {
    // Download template
    await downloadTemplate(template, targetDir)

    // Update package.json
    await updatePackageJson(targetDir, projectName)

    // Install dependencies
    if (installDeps) {
      const s = spinner()
      s.start(`Installing dependencies with ${packageManager}...`)

      try {
        await installPackage([], {
          cwd: targetDir,
          silent: true,
          packageManager: packageManager,
        })
        s.stop("Dependencies installed!")
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        s.stop("Failed to install dependencies")
        console.log(pc.yellow("You can install them manually with:"))
        console.log(pc.cyan(`  cd ${projectName}`))
        console.log(pc.cyan(`  ${packageManager} install`))
      }
    }

    // Success message
    if (!quietMode) {
      outro(pc.green("🎉 Project created successfully!"))

      console.log()
      console.log("Next steps:")
      console.log(pc.cyan(`  cd ${projectName}`))
      if (!installDeps) {
        console.log(pc.cyan(`  ${packageManager} install`))
      }
      console.log(pc.cyan(`  ${packageManager} run dev`))
      console.log()
      console.log("Learn more:")
      console.log(
        `  ${terminalLink("Documentation", "https://github.com/vorsteh-queue/vorsteh-queue")}`,
      )
      console.log(
        `  ${terminalLink("Examples", "https://github.com/vorsteh-queue/vorsteh-queue/tree/main/examples")}`,
      )
    }
  } catch (error) {
    if (!quietMode) {
      console.error(pc.red("❌ Failed to create project:"), error)
    }
    process.exit(1)
  }
}

main().catch(console.error)
