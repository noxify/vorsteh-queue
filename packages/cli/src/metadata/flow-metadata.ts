/**
 * Flow command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

import { createJsonOption } from "./global-options"

/**
 * Builds the flow command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildFlowCommandStructure() {
  return new Command("flow")
    .description("Show a flow tree (parent-child job hierarchy)")
    .argument("<id>", "Flow ID to inspect")
    .addOption(createJsonOption())
}
