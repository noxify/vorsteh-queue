import "server-only"
import { getCommandConfig } from "@vorsteh-queue/cli/commands-metadata"

export type {
  CommandConfig,
  CommandOptionMeta,
  CommandArgumentMeta,
} from "@vorsteh-queue/cli/commands-metadata"

export { getCommandConfig } from "@vorsteh-queue/cli/commands-metadata"

/**
 * Returns TOC-compatible section entries for a CLI command's options.
 * Options are nested under an "Options" heading.
 *
 * Marked server-only because it imports @vorsteh-queue/cli which depends on Node.js packages.
 */
export function getCliCommandTocSections(commandName: string) {
  const config = getCommandConfig(commandName)
  const sections: {
    id: string
    title: string
    depth: number
    children: { id: string; title: string; depth: number }[]
  }[] = []

  if (config.arguments.length > 0) {
    sections.push({
      children: config.arguments.map((arg) => ({
        id: arg.name,
        title: arg.name,
        depth: 3,
      })),
      depth: 2,
      id: "cli-arguments",
      title: "Arguments",
    })
  }

  if (config.options.length > 0) {
    sections.push({
      children: config.options.map((opt) => ({
        id: opt.long?.replace("--", "") ?? opt.flags,
        title: opt.flags,
        depth: 3,
      })),
      depth: 2,
      id: "cli-options",
      title: "Options",
    })
  }

  return sections
}
