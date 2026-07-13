/**
 * Retry command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "./global-options"

/**
 * Builds the retry command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildRetryCommandStructure() {
  return new Command("retry")
    .description("Retry a failed job")
    .argument("<id>", "Job ID to retry")
    .addOption(createJsonOption())
}
