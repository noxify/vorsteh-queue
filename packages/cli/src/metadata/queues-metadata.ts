/**
 * Queues command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "../options"

/**
 * Builds the queues command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildQueuesCommandStructure() {
  return new Command("queues")
    .description("List all available queues")
    .addOption(createJsonOption())
}
