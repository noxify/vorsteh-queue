/**
 * Inspect command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "../options"

/**
 * Builds the inspect command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildInspectCommandStructure() {
  return new Command("inspect")
    .description("Show details of a specific job")
    .argument("<id>", "Job ID to inspect")
    .addOption(createJsonOption())
}
