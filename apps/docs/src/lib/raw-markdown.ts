/**
 * MDX-to-Markdown rendering for the /raw/ route.
 *
 * Resolves custom components into plain Markdown so that AI tools
 * reading raw URLs get fully self-contained content.
 */
import "server-only"
import { readFile } from "node:fs/promises"

import {
  getCommandConfig,
  getGlobalOptions,
} from "@vorsteh-queue/cli/commands-metadata"
import type { CommandOptionMeta } from "@vorsteh-queue/cli/commands-metadata"
import { Node, Project, SyntaxKind } from "ts-morph"

import { PackagesDirectory } from "@/collections"

// ─── InterfaceReference → Markdown Table ─────────────────────────────────────

interface ResolvedProperty {
  name: string
  type: string
  description?: string
  isOptional: boolean
  defaultValue?: string
}

async function resolveInterface(
  file: string,
  name: string
): Promise<readonly ResolvedProperty[]> {
  try {
    const sourceEntry = await PackagesDirectory.getFile(file, "ts")
    const filePath = sourceEntry.absolutePath
    const fileContent = await readFile(filePath, "utf-8")
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      useInMemoryFileSystem: true,
    })
    const sourceFile = project.createSourceFile(filePath, fileContent, {
      overwrite: true,
    })

    const interfaceDecl = sourceFile.getInterface(name)
    const properties = interfaceDecl
      ? interfaceDecl.getProperties()
      : (() => {
          const typeAlias = sourceFile.getTypeAlias(name)
          const typeLiteral = typeAlias
            ?.getTypeNode()
            ?.asKind(SyntaxKind.TypeLiteral)
          return typeLiteral
            ? typeLiteral.getMembers().filter(Node.isPropertySignature)
            : []
        })()

    return properties.map((prop) => {
      const docs = prop.getJsDocs()
      const description = docs
        .map((d) => d.getDescription().trim())
        .filter(Boolean)
        .join(" ")
      const tags = docs.flatMap((d) => d.getTags())
      const defaultTag = tags.find((t) => t.getTagName() === "default")
      const defaultValue = defaultTag
        ? defaultTag.getCommentText()?.trim()
        : undefined

      return {
        defaultValue,
        description,
        isOptional: prop.hasQuestionToken(),
        name: prop.getName(),
        type: prop.getTypeNode()?.getText().trim() ?? "unknown",
      }
    })
  } catch {
    return []
  }
}

function renderInterfaceAsMarkdown(
  name: string,
  properties: readonly ResolvedProperty[]
): string {
  if (properties.length === 0) {
    return `<!-- Could not resolve interface: ${name} -->\n`
  }

  const lines: string[] = [
    `| Property | Type | Description |`,
    `| --- | --- | --- |`,
  ]

  for (const prop of properties) {
    const propName = `\`${prop.name}${prop.isOptional ? "?" : ""}\``
    const typeName = `\`${prop.type.replaceAll("|", "\\|")}\``
    const desc = prop.description
      ? prop.description.replaceAll("|", "\\|").replaceAll("\n", " ")
      : ""
    const defaultPart = prop.defaultValue
      ? ` (default: \`${prop.defaultValue}\`)`
      : ""
    lines.push(`| ${propName} | ${typeName} | ${desc}${defaultPart} |`)
  }

  return `${lines.join("\n")}\n`
}

// ─── CliCommandDetails → Markdown ────────────────────────────────────────────

function renderCliCommandDetailsAsMarkdown(
  command?: string,
  scope?: string
): string {
  const isGlobal = scope === "global"
  const config = isGlobal
    ? {
        arguments: [] as {
          name: string
          description: string
          required: boolean
        }[],
        options: [...getGlobalOptions()],
      }
    : command
      ? getCommandConfig(command)
      : null

  if (!config) {
    return ""
  }

  const lines: string[] = []

  if (config.arguments.length > 0) {
    lines.push(
      "### Arguments\n",
      "| Name | Description | Required |",
      "| --- | --- | --- |"
    )
    for (const arg of config.arguments) {
      lines.push(
        `| \`${arg.name}\` | ${arg.description} | ${arg.required ? "Yes" : "No"} |`
      )
    }
    lines.push("")
  }

  if (config.options.length > 0) {
    lines.push(
      "### Options\n",
      "| Flag | Description | Default |",
      "| --- | --- | --- |"
    )
    for (const opt of config.options as readonly CommandOptionMeta[]) {
      const defaultVal =
        opt.defaultValueDescription ??
        (opt.defaultValue === undefined ? "—" : String(opt.defaultValue))
      lines.push(`| \`${opt.flags}\` | ${opt.description} | ${defaultVal} |`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ─── Command → Markdown Code Block ──────────────────────────────────────────

function renderCommandAsMarkdown(variant: string, content: string): string {
  const trimmed = content.trim()
  switch (variant) {
    case "install": {
      return [
        "```bash",
        `# npm`,
        `npm install ${trimmed}`,
        `# pnpm`,
        `pnpm add ${trimmed}`,
        "```\n",
      ].join("\n")
    }
    case "install-dev": {
      return [
        "```bash",
        `# npm`,
        `npm install --save-dev ${trimmed}`,
        `# pnpm`,
        `pnpm add -D ${trimmed}`,
        "```\n",
      ].join("\n")
    }
    case "exec": {
      return [
        "```bash",
        `# npm`,
        `npx ${trimmed}`,
        `# pnpm`,
        `pnpm dlx ${trimmed}`,
        "```\n",
      ].join("\n")
    }
    case "run": {
      return [
        "```bash",
        `# npm`,
        `npm run ${trimmed}`,
        `# pnpm`,
        `pnpm ${trimmed}`,
        "```\n",
      ].join("\n")
    }
    case "create": {
      return [
        "```bash",
        `# npm`,
        `npm create ${trimmed}`,
        `# pnpm`,
        `pnpm create ${trimmed}`,
        "```\n",
      ].join("\n")
    }
    default: {
      return `\`\`\`bash\n${trimmed}\n\`\`\`\n`
    }
  }
}

// ─── Note → Markdown Blockquote ──────────────────────────────────────────────

function renderNoteAsMarkdown(title: string, content: string): string {
  const lines = content
    .trim()
    .split("\n")
    .map((line) => `> ${line}`)
  return `> **${title}:** ${lines.join("\n> ").replace(`> **${title}:** > `, `> **${title}:** `)}\n`
}

// ─── Main: Transform MDX text ────────────────────────────────────────────────

/**
 * Transform raw MDX content into plain Markdown by resolving custom components.
 *
 * Processes:
 * - `<InterfaceReference file="..." name="..." />` → Markdown table
 * - `<Command variant="...">...</Command>` → code block
 * - `<Note title="...">...</Note>` → blockquote
 * - `<CliCommandDetails command="..." />` → options table
 *
 * Strips frontmatter and returns clean Markdown.
 */
export async function renderMdxToMarkdown(mdxContent: string): Promise<string> {
  let result = mdxContent

  // Strip frontmatter
  result = result.replace(/^---[\s\S]*?---\n*/u, "")

  // Resolve <InterfaceReference file="..." name="..." />
  const interfaceRefs = [
    ...result.matchAll(
      /<InterfaceReference\s+file="(?<file>[^"]+)"\s+name="(?<name>[^"]+)"\s*\/>/gu
    ),
  ]

  for (const match of interfaceRefs) {
    const { file, name } = match.groups as { file: string; name: string }
    // eslint-disable-next-line no-await-in-loop
    const properties = await resolveInterface(file, name)
    const markdown = renderInterfaceAsMarkdown(name, properties)
    result = result.replace(match[0], markdown)
  }

  // Resolve <CliCommandDetails command="..." /> and <CliCommandDetails scope="..." />
  result = result.replaceAll(
    /<CliCommandDetails\s+(?:command="(?<command>[^"]+)"|scope="(?<scope>[^"]+)")\s*\/>/gu,
    (_match, command?: string, scope?: string) =>
      renderCliCommandDetailsAsMarkdown(command, scope)
  )

  // Resolve <Command variant="...">...</Command>
  result = result.replaceAll(
    /<Command\s+variant="(?<variant>[^"]+)">\s*(?<content>[\s\S]*?)\s*<\/Command>/gu,
    (_match, variant: string, content: string) =>
      renderCommandAsMarkdown(variant, content.replaceAll(/\{`|`\}/gu, ""))
  )

  // Resolve <Note title="...">...</Note>
  result = result.replaceAll(
    /<Note\s+title="(?<title>[^"]+)">\s*(?<content>[\s\S]*?)\s*<\/Note>/gu,
    (_match, title: string, content: string) =>
      renderNoteAsMarkdown(title, content)
  )

  // Remove any remaining JSX-style component tags that we don't handle
  result = result.replaceAll(/<[A-Z]\w+[^>]*\/>/gu, "")
  result = result.replaceAll(/<[A-Z]\w+[^>]*>[\s\S]*?<\/[A-Z]\w+>/gu, "")

  // Clean up excessive blank lines
  result = result.replaceAll(/\n{3,}/gu, "\n\n")

  return `${result.trim()}\n`
}
