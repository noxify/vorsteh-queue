/**
 * Shared option factories for CLI commands.
 * Reusable options that appear across multiple commands are defined here
 * to keep metadata files DRY.
 */
import { Option } from "@commander-js/extra-typings"

/**
 * Create the --json option used by most commands.
 *
 * @returns A Commander Option instance for JSON output
 */
export function createJsonOption() {
  return new Option("--json", "Output as JSON").default(false)
}
