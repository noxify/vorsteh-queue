/**
 * Serve command metadata — only the command structure, no action handlers.
 */
import { Command, Option } from "@commander-js/extra-typings"

/**
 * Builds the serve command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildServeCommandStructure() {
  return new Command("serve")
    .description("Start the queue server")
    .addOption(new Option("-p, --port <port>", "Port to listen on"))
}
