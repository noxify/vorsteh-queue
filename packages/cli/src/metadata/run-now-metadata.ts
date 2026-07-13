/**
 * Run-now command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "./global-options"

/**
 * Builds the run-now command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildRunNowCommandStructure() {
  return new Command("run-now")
    .description("Promote a delayed job to run immediately")
    .argument("<id>", "Job ID to promote")
    .addOption(createJsonOption())
}
