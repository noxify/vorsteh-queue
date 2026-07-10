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

/**
 * Create the --url option for specifying a remote server URL.
 *
 * @returns A Commander Option instance for the URL
 */
export function createUrlOption() {
  return new Option("--url <string>", "Remote server URL (GraphQL endpoint)")
}

/**
 * Create the --token option for specifying an authentication token.
 *
 * @returns A Commander Option instance for the token
 */
export function createTokenOption() {
  return new Option("--token <string>", "Authentication token")
}
