/**
 * Doctor command metadata — only the command structure, no action handlers.
 */
import { Command } from "@commander-js/extra-typings"

/**
 * Builds the doctor command structure (options/arguments) without action handlers.
 * Used for documentation and metadata extraction.
 */
export function buildDoctorCommandStructure() {
  return new Command("doctor").description(
    "Check configuration and connectivity"
  )
}
