/**
 * Status command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "./global-options"

/**
 * Builds the status command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildStatusCommandStructure() {
  return new Command("status")
    .description("Show queue status overview")
    .addOption(createJsonOption())
}
