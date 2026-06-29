/**
 * Cancel command metadata — only the command structure, no action handlers.
 */
import { Command, Option } from "@commander-js/extra-typings"

import { createJsonOption } from "../options"

/**
 * Builds the cancel command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildCancelCommandStructure() {
  return new Command("cancel")
    .description("Cancel a job")
    .argument("<id>", "Job ID to cancel")
    .addOption(new Option("--reason <reason>", "Cancellation reason"))
    .addOption(createJsonOption())
}
