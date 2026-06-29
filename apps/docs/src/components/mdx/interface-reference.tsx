import { readFile } from "node:fs/promises"

import { Markdown } from "renoun/components"
import type { ModuleExport } from "renoun/file-system"
import { Node, Project, SyntaxKind } from "ts-morph"

import { PackagesDirectory } from "@/collections"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { LinkHandler } from "./link-handler"

interface InterfaceReferenceProps {
  /** File path relative to PackagesDirectory, e.g. "schema-generator/src/endpoint-schema" */
  file: string
  /** Export name of the interface to render. */
  name: string
  /** Extraction mode. "declaration" avoids resolving external library types. */
  mode?: "declaration" | "resolved"
}

interface ResolvedProperty {
  name?: string
  kind: string
  type: { text: string }
  isOptional?: boolean
  isReadonly?: boolean
  description?: string
  tags?: { name: string; text?: string }[]
  /** Nested members for object/type-literal properties (rendered as sub-table). */
  nestedMembers?: ResolvedProperty[]
}

interface ResolvedType {
  kind: string
  members?: ResolvedProperty[]
  type?: { kind: string; members?: ResolvedProperty[] }
}

function extractMembers(resolvedType: ResolvedType): ResolvedProperty[] {
  if (resolvedType.kind === "Interface" && resolvedType.members) {
    return resolvedType.members.filter(
      (member) => member.kind === "PropertySignature"
    )
  }

  if (
    resolvedType.kind === "TypeAlias" &&
    resolvedType.type?.kind === "TypeLiteral" &&
    resolvedType.type.members
  ) {
    return resolvedType.type.members.filter(
      (member) => member.kind === "PropertySignature"
    )
  }

  return []
}

function normalizeJsDocTag(tagText: string) {
  const normalizedText = tagText.trim()
  const match = /^@(?<name>\S+)(?:\s+(?<text>[\s\S]*))?$/u.exec(normalizedText)

  if (!match?.groups?.name) {
    return {
      name: normalizedText.replace(/^@/u, ""),
    }
  }

  return {
    name: match.groups.name,
    text: match.groups.text?.trim() || undefined,
  }
}

function resolvePropertyDescription(property: {
  getJsDocs: () => { getDescription: () => string }[]
}) {
  const description = property
    .getJsDocs()
    .map((doc) => doc.getDescription().trim())
    .filter(Boolean)
    .join("\n\n")

  return description || undefined
}

function resolvePropertyTags(property: {
  getJsDocs: () => { getTags: () => { getText: () => string }[] }[]
}) {
  const tags = property
    .getJsDocs()
    .flatMap((doc) =>
      doc.getTags().map((tag) => normalizeJsDocTag(tag.getText()))
    )

  return tags.length > 0 ? tags : undefined
}

/**
 * Recursively resolves nested members from a ts-morph TypeNode.
 * Handles TypeLiteral, ArrayType wrapping a TypeLiteral, and TypeLiterals
 * whose own properties are again TypeLiterals or arrays of TypeLiterals.
 */
// oxlint-disable-next-line typescript/no-explicit-any
function resolveNestedMembers(typeNode: any): ResolvedProperty[] | undefined {
  if (!typeNode) {
    return undefined
  }

  // Direct TypeLiteral: { foo: string; bar: number }
  if (typeNode.getKind?.() === SyntaxKind.TypeLiteral) {
    const members = typeNode
      .getMembers?.()
      ?.filter?.(
        (m: { getKind?: () => number }) =>
          m.getKind?.() === SyntaxKind.PropertySignature
      )

    if (members && members.length > 0) {
      return members.map(toResolvedProperty)
    }

    return undefined
  }

  // ArrayType wrapping a TypeLiteral: { foo: string }[]
  if (typeNode.getKind?.() === SyntaxKind.ArrayType) {
    const elementType = typeNode.getElementTypeNode?.()

    return resolveNestedMembers(elementType)
  }

  return undefined
}

function toResolvedProperty(property: {
  getName: () => string
  getTypeNode: () => { getText: () => string } | undefined
  hasQuestionToken: () => boolean
  isReadonly: () => boolean
  getJsDocs: () => {
    getDescription: () => string
    getTags: () => { getText: () => string }[]
  }[]
}): ResolvedProperty {
  const typeNode = property.getTypeNode?.()
  const nestedMembers = resolveNestedMembers(typeNode)

  return {
    name: property.getName(),
    kind: "PropertySignature",
    type: {
      text: typeNode?.getText().trim() || "unknown",
    },
    isOptional: property.hasQuestionToken(),
    isReadonly: property.isReadonly(),
    description: resolvePropertyDescription(property),
    tags: resolvePropertyTags(property),
    nestedMembers,
  }
}

async function getDeclarationType(file: string, name: string) {
  const sourceEntry = await PackagesDirectory.getFile(file, "ts")
  const filePath = sourceEntry.absolutePath
  const fileContent = await readFile(filePath, "utf-8")
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true,
  })
  const sourceFile = project.createSourceFile(filePath, fileContent, {
    overwrite: true,
  })

  const interfaceDeclaration = sourceFile.getInterface(name)

  if (interfaceDeclaration) {
    return {
      kind: "Interface",
      members: interfaceDeclaration.getProperties().map(toResolvedProperty),
    } satisfies ResolvedType
  }

  const typeAliasDeclaration = sourceFile.getTypeAlias(name)
  const typeLiteral = typeAliasDeclaration
    ?.getTypeNode()
    ?.asKind(SyntaxKind.TypeLiteral)

  if (!typeLiteral) {
    return
  }

  return {
    kind: "TypeAlias",
    type: {
      kind: "TypeLiteral",
      members: typeLiteral
        .getMembers()
        .filter(Node.isPropertySignature)
        .map(toResolvedProperty),
    },
  } satisfies ResolvedType
}

async function getResolvedType(file: string, name: string) {
  const sourceFile = await PackagesDirectory.getFile(file, "ts")
  // oxlint-disable-next-line typescript/no-explicit-any
  const fileExports: ModuleExport<any>[] =
    // oxlint-disable-next-line typescript/no-explicit-any
    await (sourceFile as any).getExports()
  const targetExport = fileExports.find((exp) => exp.name === name)

  if (!targetExport) {
    return
  }

  return (await targetExport.getType()) as ResolvedType | undefined
}

/**
 * Renders a TypeScript interface as a properties table with description as sub-row
 * and @default tag support. Styled consistently with the InlineReference/Reference component.
 */
export async function InterfaceReference({
  file,
  name,
  mode = "declaration",
}: InterfaceReferenceProps) {
  try {
    const resolvedType =
      mode === "resolved"
        ? await getResolvedType(file, name)
        : await getDeclarationType(file, name)

    if (!resolvedType) {
      return null
    }

    const members = extractMembers(resolvedType)

    if (members.length === 0) {
      return null
    }

    return (
      <div className="not-prose my-6">
        <Table variant="outline">
          <TableHeader>
            <TableRow>
              <TableHead className="bg-muted font-bold">Property</TableHead>
              <TableHead className="bg-muted font-bold">Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const defaultTag = member.tags?.find(
                (tag: { name: string }) => tag.name === "default"
              )
              const hasSubRow = !!(member.description || defaultTag)

              return (
                <PropertyRow
                  key={member.name}
                  member={member}
                  defaultTag={defaultTag}
                  hasSubRow={hasSubRow}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  } catch {
    return null
  }
}

function PropertyRow({
  member,
  defaultTag,
  hasSubRow,
  depth = 0,
}: {
  member: ResolvedProperty
  defaultTag?: { name: string; text?: string }
  hasSubRow: boolean
  depth?: number
}) {
  const hasNestedMembers =
    member.nestedMembers && member.nestedMembers.length > 0

  // For properties with nested members, show a simplified type label
  const typeLabel = hasNestedMembers
    ? getSimplifiedTypeLabel(member.type.text)
    : member.type.text

  return (
    <>
      <TableRow>
        <TableCell className="max-w-75 font-mono text-xs font-semibold break-all whitespace-normal">
          {depth > 0 && (
            <span className="text-muted-foreground mr-1">{"└ "}</span>
          )}
          {member.name}
          {member.isOptional ? "?" : ""}
        </TableCell>
        <TableCell className="text-muted-foreground max-w-75 font-mono text-xs break-all whitespace-normal">
          <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
            {typeLabel}
          </code>
        </TableCell>
      </TableRow>
      {hasSubRow && (
        <TableRow>
          <TableCell
            colSpan={2}
            className="text-muted-foreground whitespace-normal"
          >
            <div className="ml-4 flex flex-col gap-1.5">
              {member.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <Markdown
                    components={{
                      // oxlint-disable-next-line react/no-unstable-nested-components
                      a: ({
                        href,
                        children,
                        ...props
                      }: React.ComponentPropsWithoutRef<"a">) => (
                        <LinkHandler href={href} {...props}>
                          {children}
                        </LinkHandler>
                      ),
                    }}
                  >
                    {member.description}
                  </Markdown>
                </div>
              )}
              {defaultTag && (
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  Default:{" "}
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                    {defaultTag.text ?? "—"}
                  </code>
                </span>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      {hasNestedMembers && (
        <TableRow>
          <TableCell colSpan={2} className="p-0">
            <NestedMembersTable
              // oxlint-disable-next-line typescript/no-non-null-assertion
              members={member.nestedMembers!}
              depth={depth + 1}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/**
 * Returns a simplified label for complex type literals, e.g. "Object" or "Object[]"
 * instead of the full inline type text.
 */
function getSimplifiedTypeLabel(typeText: string): string {
  const trimmed = typeText.trim()

  // Check if it's a top-level type literal: { ... }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return "Object"
  }

  // Check if it's a type literal wrapped in array: { ... }[]
  if (trimmed.startsWith("{") && trimmed.endsWith("}[]")) {
    return "Object[]"
  }

  // Fallback: return original text
  return typeText
}

/**
 * Renders nested members as an indented sub-table within the parent property row.
 */
function NestedMembersTable({
  members,
  depth,
}: {
  members: ResolvedProperty[]
  depth: number
}) {
  return (
    <div
      className="border-border/50 my-1 ml-4 border-l-2"
      style={{ marginLeft: `${depth * 1}rem` }}
    >
      <Table variant="outline">
        <TableHeader>
          <TableRow>
            <TableHead className="bg-muted/50 py-1.5 text-xs font-semibold">
              Property
            </TableHead>
            <TableHead className="bg-muted/50 py-1.5 text-xs font-semibold">
              Type
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((nestedMember) => {
            const nestedDefaultTag = nestedMember.tags?.find(
              (tag: { name: string }) => tag.name === "default"
            )
            const nestedHasSubRow = !!(
              nestedMember.description || nestedDefaultTag
            )

            return (
              <PropertyRow
                key={nestedMember.name}
                member={nestedMember}
                defaultTag={nestedDefaultTag}
                hasSubRow={nestedHasSubRow}
                depth={depth}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
