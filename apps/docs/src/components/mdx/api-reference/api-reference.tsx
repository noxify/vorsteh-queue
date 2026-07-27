// oxlint-disable react/react-compiler
import { resolveFileExports } from "@/lib/ts-morph-analysis"
import type {
  ResolvedExport,
  ResolvedExportMember,
} from "@/lib/ts-morph-analysis"

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
  /**
   * Whether to resolve exported type links inline as nested sub-tables
   * instead of rendering anchor links (which may be dead when the target
   * type is not on the same page).
   *
   * Ignored when `referenceBaseUrl` is set (links will point to that URL instead).
   *
   * @default true for variant="table" (when referenceBaseUrl is not set), false otherwise
   */
  resolveTypeLinksInline?: boolean
  /**
   * Base URL for type reference links. When set, type links point to this
   * URL with an anchor (e.g. "/docs/api-reference/core/types#job") instead
   * of being resolved inline or linking to a local anchor.
   *
   * Takes precedence over `resolveTypeLinksInline`.
   *
   * @example "/docs/api-reference/core/types"
   */
  referenceBaseUrl?: string
}

/**
 * Resolves typeLink references in members by looking up the linked type
 * in the full exports list and converting it to inline typeMembers.
 */
function inlineTypeLinks(
  exports: ResolvedExport[],
  allFileExports: readonly ResolvedExport[]
): ResolvedExport[] {
  const exportsByName = new Map(allFileExports.map((exp) => [exp.name, exp]))

  function resolveMemberLinks(
    members: ResolvedExportMember[] | undefined
  ): ResolvedExportMember[] | undefined {
    if (!members) {
      return undefined
    }

    return members.map((m) => {
      if (!m.typeLink || m.typeMembers) {
        return m
      }

      const linkedExport = exportsByName.get(m.typeLink)

      if (!linkedExport?.members || linkedExport.members.length === 0) {
        // Cannot resolve — drop the dead link, keep plain type text
        return { ...m, typeLink: undefined }
      }

      // Convert linked export's members into inline typeMembers
      const inlined: ResolvedExportMember[] = linkedExport.members.map(
        (lm) => ({
          name: lm.name,
          type: lm.type,
          isOptional: lm.isOptional,
          isReadonly: lm.isReadonly,
          description: lm.description,
          tags: lm.tags,
        })
      )

      return { ...m, typeLink: undefined, typeMembers: inlined }
    })
  }

  return exports.map((exp) => ({
    ...exp,
    members: resolveMemberLinks(exp.members),
  }))
}

/**
 * Rewrites typeLink values to point to a base URL with an anchor fragment.
 * E.g. typeLink "Job" + baseUrl "/docs/api-reference/core/types" → "/docs/api-reference/core/types#job"
 */
function rebaseTypeLinks(
  exports: ResolvedExport[],
  baseUrl: string
): ResolvedExport[] {
  function rebaseMemberLinks(
    members: ResolvedExportMember[] | undefined
  ): ResolvedExportMember[] | undefined {
    if (!members) {
      return undefined
    }

    return members.map((m) => {
      if (!m.typeLink) {
        return m
      }

      const slug = m.typeLink
        .replaceAll(/(?<lower>[a-z\d])(?<upper>[A-Z])/gu, "$1-$2")
        .replaceAll(/(?<upper>[A-Z]+)(?<next>[A-Z][a-z])/gu, "$1-$2")
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, "-")
        .replaceAll(/^-+|-+$/gu, "")

      return { ...m, typeLink: `${baseUrl}#${slug}` }
    })
  }

  return exports.map((exp) => ({
    ...exp,
    members: rebaseMemberLinks(exp.members),
  }))
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
  resolveTypeLinksInline: resolveInlineProp,
  referenceBaseUrl,
}: ApiReferenceProps) {
  try {
    const filePath = resolvePackagePath(file)
    const allFileExports: readonly ResolvedExport[] =
      await resolveFileExports(filePath)
    let exports: ResolvedExport[] = [...allFileExports]

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

    // Type link resolution strategy:
    // 1. referenceBaseUrl set → rewrite links to point to that URL
    // 2. resolveTypeLinksInline (or default for table) → expand inline
    // 3. Otherwise → keep local #anchor links
    if (referenceBaseUrl) {
      exports = rebaseTypeLinks(exports, referenceBaseUrl)
    } else {
      const shouldInlineTypeLinks = resolveInlineProp ?? variant === "table"

      if (shouldInlineTypeLinks) {
        exports = inlineTypeLinks(exports, allFileExports)
      }
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
