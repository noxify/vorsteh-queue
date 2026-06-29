import type { ModuleExport } from "renoun/file-system"

import { PackagesDirectory } from "@/collections"

import { References } from "./reference"

interface InlineReferenceProps {
  /** File path relative to PackagesDirectory, e.g. "trino-client/src/retry" */
  file: string
  /** Export names to include. If omitted, all exports are shown. */
  include?: string[]
  /** Export names to exclude. Applied after include filter. */
  exclude?: string[]
  /** Render variant: "full" (default) shows complete reference, "summary" shows only title + description. */
  variant?: "full" | "summary"
}

/**
 * Renders API reference documentation for specific exports inline within MDX content.
 *
 * @example
 * ```mdx
 * <InlineReference file="trino-client/src/retry" include={["RetryConfig"]} />
 * ```
 */
export async function InlineReference({
  file,
  include,
  exclude,
  variant = "full",
}: InlineReferenceProps) {
  try {
    const sourceFile = await PackagesDirectory.getFile(file, "ts")
    // oxlint-disable-next-line typescript/no-explicit-any
    let fileExports: ModuleExport<any>[] =
      await // oxlint-disable-next-line typescript/no-explicit-any
      (sourceFile as any).getExports()

    if (include && include.length > 0) {
      fileExports = fileExports.filter((exp) => include.includes(exp.name))
    }

    if (exclude && exclude.length > 0) {
      fileExports = fileExports.filter((exp) => !exclude.includes(exp.name))
    }

    if (fileExports.length === 0) {
      return null
    }

    return (
      <div className="not-prose my-6">
        <References fileExports={fileExports} variant={variant} />
      </div>
    )
  } catch {
    return null
  }
}
