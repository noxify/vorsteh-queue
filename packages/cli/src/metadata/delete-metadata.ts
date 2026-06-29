/**
 * Delete command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "../options"

/**
 * Builds the delete command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildDeleteCommandStructure() {
  return new Command("delete")
    .description("Delete a single job")
    .argument("<id>", "Job ID to delete")
    .addOption(createJsonOption())
}
