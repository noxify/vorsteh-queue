/**
 * Dashboard command metadata — only the command structure, no action handlers.
 */
import { Command, Option } from "@commander-js/extra-typings"

/**
 * Builds the dashboard command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildDashboardCommandStructure() {
  return new Command("dashboard")
    .description("Interactive TUI dashboard for monitoring and managing jobs")
    .addOption(
      new Option(
        "-r, --refresh <ms>",
        "Auto-refresh interval in milliseconds"
      ).default("2000")
    )
    .addOption(
      new Option("--no-sidebar", "Hide the sidebar (use Ctrl+K to navigate)")
    )
}
