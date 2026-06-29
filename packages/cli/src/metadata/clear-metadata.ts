/**
 * Clear command metadata — only the command structure, no action handlers.
 */
import { Command, Option } from "@commander-js/extra-typings"

import { createJsonOption } from "../options"

/**
 * Builds the clear command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildClearCommandStructure() {
  return new Command("clear")
    .description("Clear jobs from the queue")
    .addOption(
      new Option(
        "--status <status>",
        "Status to clear (pending, completed, failed, etc.)"
      )
    )
    .addOption(
      new Option("--all", "Clear all jobs regardless of status").default(false)
    )
    .addOption(createJsonOption())
}
