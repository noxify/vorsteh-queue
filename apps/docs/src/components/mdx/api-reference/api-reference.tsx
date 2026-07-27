// oxlint-disable react/react-compiler
import { resolveFileExports } from "@/lib/ts-morph-analysis"
import type { ResolvedExport } from "@/lib/ts-morph-analysis"

import {
  ReferenceSection,
  ReferenceSummary,
  ReferenceTable,
} from "./reference-section"
import { resolvePackagePath } from "./utils"

interface ApiReferenceProps {
  /** File path relative to packages directory, e.g. "query-builder/src/index" */
  file: string
  /** Specific export name to render (single item). When set, renders only that export. */
  name?: string
  /** Export names to include. If omitted, all exports are shown. */
  include?: string[]
  /** Export names to exclude. Applied after include filter. */
  exclude?: string[]
  /**
   * Render variant:
   * - "full" (default) — collapsible sections with full details
   * - "summary" — title + description only
   * - "table" — flat properties table (for single interface/type)
   */
  variant?: "full" | "summary" | "table"
}

/**
 * Unified API reference component for rendering TypeScript exports in MDX.
 *
 * @example
 * ```mdx
 * <!-- All exports from a file -->
 * <ApiReference file="query-builder/src/index" />
 *
 * <!-- Specific exports -->
 * <ApiReference file="query-builder/src/index" include={["GenerateQueryProps", "getSelectFields"]} />
 *
 * <!-- Single interface as flat table -->
 * <ApiReference file="query-builder/src/index" name="GenerateQueryProps" variant="table" />
 *
 * <!-- Summary mode -->
 * <ApiReference file="query-builder/src/index" variant="summary" />
 * ```
 */
export async function ApiReference({
  file,
  name,
  include,
  exclude,
  variant = "full",
}: ApiReferenceProps) {
  try {
    const filePath = resolvePackagePath(file)
    let exports: ResolvedExport[] = await resolveFileExports(filePath)

    // Single export by name
    if (name) {
      exports = exports.filter((exp) => exp.name === name)
    }

    // Include filter
    if (include && include.length > 0) {
      exports = exports.filter((exp) => include.includes(exp.name))
    }

    // Exclude filter
    if (exclude && exclude.length > 0) {
      exports = exports.filter((exp) => !exclude.includes(exp.name))
    }

    if (exports.length === 0) {
      return null
    }

    if (variant === "table") {
      // For table mode, render only the first matched export as a flat table
      return (
        <div className="not-prose my-6">
          {/* oxlint-disable-next-line typescript/no-non-null-assertion */}
          <ReferenceTable source={exports[0]!} />
        </div>
      )
    }

    if (variant === "summary") {
      return (
        <div className="not-prose my-6 flex flex-col gap-6">
          {exports.map((exp) => (
            <ReferenceSummary key={exp.name} source={exp} />
          ))}
        </div>
      )
    }

    // Full mode (default)
    return (
      <div className="not-prose my-6 flex flex-col">
        {exports.map((exp) => (
          <ReferenceSection key={exp.name} source={exp} />
        ))}
      </div>
    )
  } catch {
    return null
  }
}
