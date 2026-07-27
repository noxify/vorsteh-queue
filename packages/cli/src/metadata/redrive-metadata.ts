/**
 * Redrive command metadata — only the command structure, no action handlers.
 */
import { Command, Option } from "@commander-js/extra-typings"

import { createJsonOption } from "./global-options"

/**
 * Builds the redrive command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildRedriveCommandStructure() {
  return new Command("redrive")
    .description("Redrive a dead job (or all dead jobs)")
    .argument("[id]", "Job ID to redrive (omit for --all)")
    .addOption(new Option("--all", "Redrive all dead jobs").default(false))
    .addOption(
      new Option("--name <name>", "Filter by job name (used with --all)")
    )
    .addOption(createJsonOption())
}
