import { Node, Project, SyntaxKind } from "ts-morph"

/**
 * Shared ts-morph project for analysis.
 * Uses the real file system so that imports can be resolved for type inference.
 * skipLibCheck and skipAddingFilesFromTsConfig keep startup fast.
 */
const _project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: {
    skipLibCheck: true,
    types: [],
  },
})

// ---------------------------------------------------------------------------
// Source file resolution
// ---------------------------------------------------------------------------

/**
 * Get or create a source file in the shared project.
 * Uses addSourceFileAtPath so the project can resolve imports from disk.
 */
function getSourceFile(filePath: string) {
  const existing = _project.getSourceFile(filePath)

  if (existing) {
    return existing
  }

  return _project.addSourceFileAtPath(filePath)
}

// ---------------------------------------------------------------------------
// Full export resolution for Reference component rendering
// ---------------------------------------------------------------------------

export interface ResolvedTypeParam {
  name: string
  constraint?: string
  defaultType?: string
}

export interface ResolvedExportParam {
  name: string
  type: string
  isOptional: boolean
  description?: string
  defaultValue?: string
  /** If the type is an exported type in the same file, its slug for linking */
  typeLink?: string
  /** If the type is an internal (non-exported) type, its resolved members */
  typeMembers?: ResolvedExportMember[]
}

export interface ResolvedExportMember {
  name: string
  type: string
  isOptional: boolean
  isReadonly: boolean
  description?: string
  tags?: { name: string; text?: string }[]
  /** If the type is an exported type in the same file, its slug for linking */
  typeLink?: string
  /** If the type is an internal (non-exported) type, its resolved members */
  typeMembers?: ResolvedExportMember[]
}

export interface ResolvedExportSignature {
  text: string
  params: ResolvedExportParam[]
  returnType: string
  returnsDescription?: string
}

export interface ResolvedExport {
  name: string
  kind: string
  description?: string
  tags?: { name: string; text?: string }[]
  /** Whether the function/method is async */
  isAsync?: boolean
  /** Generic type parameters (e.g. <T extends Foo = Bar>) */
  typeParams?: ResolvedTypeParam[]
  /** Function/method signatures */
  signatures?: ResolvedExportSignature[]
  /** Interface/TypeAlias/Class property members */
  members?: ResolvedExportMember[]
  /** Class constructor info */
  classConstructor?: {
    description?: string
    params: ResolvedExportParam[]
  }
  /** Class methods (each is a full ResolvedExport with signatures) */
  methods?: ResolvedExport[]
  /** Enum members */
  enumMembers?: { name: string; value?: string; description?: string }[]
  /** Variable type text */
  typeText?: string
  /** Names of exported types referenced in typeText (for linking) */
  referencedTypes?: string[]
  /** Source file path (for "View Source" links) */
  filePath?: string
  /** Line number in source */
  line?: number
}

/**
 * Cache for fully-resolved file exports.
 */
const _resolvedExportsCache = new Map<string, Promise<ResolvedExport[]>>()

/**
 * Resolves all exports from a source file with full type, signature, and JSDoc info.
 * Used to render API reference documentation.
 *
 * Results are cached per file path for the lifetime of the process.
 */
export async function resolveFileExports(
  filePath: string
): Promise<ResolvedExport[]> {
  const existing = _resolvedExportsCache.get(filePath)

  if (existing) {
    return existing
  }

  const promise = _resolveFileExportsImpl(filePath)
  _resolvedExportsCache.set(filePath, promise)
  return promise
}

// ---------------------------------------------------------------------------
// Lightweight syntactic export analysis (derived from resolveFileExports)
// ---------------------------------------------------------------------------

export interface SyntacticExportInfo {
  name: string
  kind: string | null
  methods?: string[]
}

/**
 * Syntactically analyze a source file to extract export kinds and class methods.
 * This is a lightweight view derived from the full resolveFileExports result.
 *
 * Results share the same underlying cache so no double-parsing occurs.
 */
export async function analyzeSyntacticExports(
  filePath: string
): Promise<SyntacticExportInfo[]> {
  const exports = await resolveFileExports(filePath)

  return exports.map((exp) => ({
    name: exp.name,
    kind: exp.kind,
    methods:
      exp.kind === "Class" && exp.methods
        ? exp.methods.map((m) => m.name)
        : undefined,
  }))
}

// ---------------------------------------------------------------------------
// Type resolution (interface/type alias members) for InterfaceReference
// ---------------------------------------------------------------------------

export interface ResolvedProperty {
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

export interface ResolvedType {
  kind: string
  members?: ResolvedProperty[]
  type?: { kind: string; members?: ResolvedProperty[] }
}

/**
 * Resolves an interface or type alias declaration from a source file,
 * returning its property members for documentation rendering.
 *
 * Reuses the shared project instance and file content cache.
 */
export async function resolveTypeDeclaration(
  filePath: string,
  name: string
): Promise<ResolvedType | undefined> {
  const sourceFile = getSourceFile(filePath)

  const interfaceDeclaration = sourceFile.getInterface(name)

  if (interfaceDeclaration) {
    return {
      kind: "Interface",
      members: interfaceDeclaration.getProperties().map(toResolvedProperty),
    }
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
  }
}

/**
 * Extracts property signature members from a resolved type.
 */
export function extractMembers(resolvedType: ResolvedType): ResolvedProperty[] {
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
 * Handles TypeLiteral and ArrayType wrapping a TypeLiteral.
 */
// oxlint-disable-next-line typescript/no-explicit-any
function resolveNestedMembers(typeNode: any): ResolvedProperty[] | undefined {
  if (!typeNode) {
    return undefined
  }

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

function getJsDocDescription(node: {
  getJsDocs: () => { getDescription: () => string }[]
}): string | undefined {
  const description = node
    .getJsDocs()
    .map((doc) => doc.getDescription().trim())
    .filter(Boolean)
    .join("\n\n")

  return description || undefined
}

function getJsDocTags(node: {
  getJsDocs: () => { getTags: () => { getText: () => string }[] }[]
}): { name: string; text?: string }[] | undefined {
  const tags = node
    .getJsDocs()
    .flatMap((doc) =>
      doc.getTags().map((tag) => normalizeJsDocTag(tag.getText()))
    )

  return tags.length > 0 ? tags : undefined
}

function resolveParamDescription(
  node: { getJsDocs: () => { getTags: () => { getText: () => string }[] }[] },
  paramName: string
): string | undefined {
  const tags = node.getJsDocs().flatMap((doc) => doc.getTags())

  for (const tag of tags) {
    const text = tag.getText().trim()
    const match =
      /^@param\s+(?:\{[^}]*\}\s+)?(?<name>\S+)\s+(?<desc>[\s\S]*)$/u.exec(text)

    if (match?.groups?.name === paramName) {
      const desc = match.groups.desc?.trim() || undefined
      // Strip leading "- " (JSDoc convention) and trailing "*" (JSDoc block artifact)
      return (
        desc
          ?.replace(/^-\s+/u, "")
          .replace(/\s*\*\s*$/u, "")
          .trim() || undefined
      )
    }
  }

  return undefined
}

function resolveReturnsDescription(node: {
  getJsDocs: () => { getTags: () => { getText: () => string }[] }[]
}): string | undefined {
  const tags = node.getJsDocs().flatMap((doc) => doc.getTags())

  for (const tag of tags) {
    const text = tag.getText().trim()
    const match = /^@returns?\s+(?<desc>[\s\S]*)$/u.exec(text)

    if (match?.groups?.desc) {
      const desc = match.groups.desc.trim()
      return desc.replace(/^-\s+/u, "") || undefined
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Full export resolution implementation
// ---------------------------------------------------------------------------

/**
 * Infers a simple type from a parameter's default value initializer.
 * Handles literals like `false`, `true`, `0`, `""`, `[]`, `{}`.
 */
// oxlint-disable-next-line typescript/no-explicit-any
function inferTypeFromInitializer(param: any): string | undefined {
  const init = param.getInitializer()

  if (!init) {
    return undefined
  }

  const kind = init.getKind()

  if (kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword) {
    return "boolean"
  }

  if (kind === SyntaxKind.NumericLiteral) {
    return "number"
  }

  if (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return "string"
  }

  if (kind === SyntaxKind.ArrayLiteralExpression) {
    return "unknown[]"
  }

  if (kind === SyntaxKind.NullKeyword) {
    return "null"
  }

  if (kind === SyntaxKind.UndefinedKeyword) {
    return "undefined"
  }

  return undefined
}

/**
 * Extracts generic type parameters from a declaration (function, class, interface, type alias).
 */
// oxlint-disable-next-line typescript/no-explicit-any
function resolveTypeParams(decl: any): ResolvedTypeParam[] | undefined {
  const typeParams = decl.getTypeParameters?.()

  if (!typeParams || typeParams.length === 0) {
    return undefined
  }

  // oxlint-disable-next-line typescript/no-explicit-any
  const resolved = typeParams.map((tp: any) => ({
    name: tp.getName(),
    constraint: tp.getConstraint()?.getText().trim() || undefined,
    defaultType: tp.getDefault()?.getText().trim() || undefined,
  }))

  return resolved.length > 0 ? resolved : undefined
}

/**
 * Resolves type link/members for a parameter type reference.
 * - If the type is exported in the same file → returns { typeLink: slug }
 * - If the type is internal (not exported) → returns { typeMembers: [...] }
 * - If external or primitive → returns {}
 */
// oxlint-disable-next-line typescript/no-explicit-any
function resolveParamTypeInfo(
  typeName: string,
  // oxlint-disable-next-line typescript/no-explicit-any
  sourceFile: any,
  // oxlint-disable-next-line typescript/no-explicit-any
  entrySourceFile?: any
): { typeLink?: string; typeMembers?: ResolvedExportMember[] } {
  // Strip generics and array suffix: "SortInput<T>[]" → "SortInput"
  const baseTypeName = typeName.replaceAll("[]", "").replace(/<.*>/u, "").trim()

  // Skip primitives and built-in types
  if (
    /^(?:string|number|boolean|void|null|undefined|never|any|unknown|object|bigint|symbol)$/u.test(
      baseTypeName
    )
  ) {
    return {}
  }

  // Check interfaces
  const iface = sourceFile.getInterface(baseTypeName)

  if (iface) {
    if (iface.isExported()) {
      return { typeLink: baseTypeName }
    }

    // Internal interface — resolve members
    const members: ResolvedExportMember[] = iface
      .getProperties()
      // oxlint-disable-next-line typescript/no-explicit-any
      .map((prop: any) => ({
        name: prop.getName(),
        type: prop.getTypeNode()?.getText().trim() || "unknown",
        isOptional: prop.hasQuestionToken(),
        isReadonly: prop.isReadonly(),
        description: getJsDocDescription(prop),
        tags: getJsDocTags(prop),
      }))

    return { typeMembers: members.length > 0 ? members : undefined }
  }

  // Check type aliases
  const typeAlias = sourceFile.getTypeAlias(baseTypeName)

  if (typeAlias) {
    if (typeAlias.isExported()) {
      return { typeLink: baseTypeName }
    }

    // Internal type alias — try to resolve as type literal
    const typeLiteral = typeAlias.getTypeNode()?.asKind(SyntaxKind.TypeLiteral)

    if (typeLiteral) {
      const members: ResolvedExportMember[] = typeLiteral
        .getMembers()
        .filter(Node.isPropertySignature)
        // oxlint-disable-next-line typescript/no-explicit-any
        .map((prop: any) => ({
          name: prop.getName(),
          type: prop.getTypeNode()?.getText().trim() || "unknown",
          isOptional: prop.hasQuestionToken(),
          isReadonly: prop.isReadonly(),
          description: getJsDocDescription(prop),
          tags: getJsDocTags(prop),
        }))

      return { typeMembers: members.length > 0 ? members : undefined }
    }
  }

  // External type or not found locally — no link, no members
  // Check if it's a re-exported type (export { X } from "./module")
  const entry = entrySourceFile ?? _currentEntrySourceFile
  const filesToCheck =
    entry && entry !== sourceFile ? [sourceFile, entry] : [sourceFile]

  for (const file of filesToCheck) {
    for (const exportDecl of file.getExportDeclarations()) {
      for (const namedExport of exportDecl.getNamedExports()) {
        const exportName =
          namedExport.getAliasNode()?.getText() ?? namedExport.getName()

        if (exportName === baseTypeName) {
          return { typeLink: baseTypeName }
        }
      }
    }
  }

  return {}
}

/**
 * Extracts names of exported types referenced in a type expression text.
 * Used to show "Referenced Types" links for complex type aliases.
 */
function resolveReferencedTypes(
  typeText: string | undefined,
  // oxlint-disable-next-line typescript/no-explicit-any
  sourceFile: any
): string[] | undefined {
  if (!typeText) {
    return undefined
  }

  // Extract all PascalCase identifiers from the type text
  const identifiers = typeText.match(/\b[A-Z]\w+/gu) ?? []
  const unique = [...new Set(identifiers)]

  // Filter to only those that are exported from the same file
  const exportedRefs = unique.filter((name) => {
    const iface = sourceFile.getInterface(name)

    if (iface?.isExported()) {
      return true
    }

    const typeAlias = sourceFile.getTypeAlias(name)

    if (typeAlias?.isExported()) {
      return true
    }

    const enumDecl = sourceFile.getEnum(name)

    if (enumDecl?.isExported()) {
      return true
    }

    return false
  })

  return exportedRefs.length > 0 ? exportedRefs : undefined
}

/**
 * Module-level reference to the entry source file being resolved.
 * Used by resolveParamTypeInfo to check re-exports across the entry point.
 */
// oxlint-disable-next-line typescript/no-explicit-any
let _currentEntrySourceFile: any = null

async function _resolveFileExportsImpl(
  filePath: string
): Promise<ResolvedExport[]> {
  const sourceFile = getSourceFile(filePath)
  // Store entry source file for resolveParamTypeInfo to check re-exports
  _currentEntrySourceFile = sourceFile

  const results: ResolvedExport[] = []

  // Exported interfaces
  for (const decl of sourceFile.getInterfaces()) {
    if (decl.isExported()) {
      results.push(resolveInterfaceExport(decl, filePath))
    }
  }

  // Exported type aliases
  for (const decl of sourceFile.getTypeAliases()) {
    if (decl.isExported()) {
      results.push(resolveTypeAliasExport(decl, filePath))
    }
  }

  // Exported functions
  for (const decl of sourceFile.getFunctions()) {
    if (decl.isExported()) {
      results.push(resolveFunctionExport(decl, filePath))
    }
  }

  // Exported classes
  for (const decl of sourceFile.getClasses()) {
    if (decl.isExported()) {
      results.push(resolveClassExport(decl, filePath))
    }
  }

  // Exported enums
  for (const decl of sourceFile.getEnums()) {
    if (decl.isExported()) {
      results.push(resolveEnumExport(decl, filePath))
    }
  }

  // Exported variable declarations
  for (const stmt of sourceFile.getVariableStatements()) {
    if (stmt.isExported()) {
      for (const decl of stmt.getDeclarations()) {
        results.push(resolveVariableExport(decl, stmt, filePath))
      }
    }
  }

  // Re-exports: export { X } from "./module" and export type { X } from "./module"
  resolveReExports(sourceFile, results)

  return results
}

/**
 * Resolves re-exported declarations from `export { X } from "./module"` statements.
 */
function resolveReExports(
  // oxlint-disable-next-line typescript/no-explicit-any
  sourceFile: any,
  results: ResolvedExport[]
) {
  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = exportDecl.getModuleSpecifierSourceFile()

    if (!moduleSpecifier) {
      continue
    }

    const reExportedFilePath = moduleSpecifier.getFilePath()
    const reExportedSource = getSourceFile(reExportedFilePath)
    const namedExports = exportDecl.getNamedExports()

    for (const namedExport of namedExports) {
      const exportName =
        namedExport.getAliasNode()?.getText() ?? namedExport.getName()
      const resolved = resolveNamedExportFromSource(
        namedExport.getName(),
        reExportedSource,
        reExportedFilePath
      )

      if (resolved) {
        results.push({ ...resolved, name: exportName })
      }
    }
  }
}

/**
 * Finds and resolves a named declaration from a source file.
 */
function resolveNamedExportFromSource(
  name: string,
  // oxlint-disable-next-line typescript/no-explicit-any
  sourceFile: any,
  filePath: string
): ResolvedExport | undefined {
  const iface = sourceFile.getInterface(name)

  if (iface) {
    return resolveInterfaceExport(iface, filePath)
  }

  const typeAlias = sourceFile.getTypeAlias(name)

  if (typeAlias) {
    return resolveTypeAliasExport(typeAlias, filePath)
  }

  const func = sourceFile.getFunction(name)

  if (func) {
    return resolveFunctionExport(func, filePath)
  }

  const classDecl = sourceFile.getClass(name)

  if (classDecl) {
    return resolveClassExport(classDecl, filePath)
  }

  const enumDecl = sourceFile.getEnum(name)

  if (enumDecl) {
    return resolveEnumExport(enumDecl, filePath)
  }

  // Variable export
  for (const varStmt of sourceFile.getVariableStatements()) {
    for (const varDecl of varStmt.getDeclarations()) {
      if (varDecl.getName() === name) {
        return resolveVariableExport(varDecl, varStmt, filePath)
      }
    }
  }

  // oxlint-disable-next-line unicorn/no-useless-undefined
  return undefined
}

// oxlint-disable-next-line typescript/no-explicit-any
function resolveInterfaceExport(decl: any, filePath: string): ResolvedExport {
  const sourceFile = decl.getSourceFile()
  const members: ResolvedExportMember[] = decl.getProperties().map(
    // oxlint-disable-next-line typescript/no-explicit-any
    (prop: any) => {
      const type = prop.getTypeNode()?.getText().trim() || "unknown"
      const typeInfo = resolveParamTypeInfo(type, sourceFile)

      return {
        name: prop.getName(),
        type,
        isOptional: prop.hasQuestionToken(),
        isReadonly: prop.isReadonly(),
        description: getJsDocDescription(prop),
        tags: getJsDocTags(prop),
        ...typeInfo,
      }
    }
  )

  return {
    name: decl.getName(),
    kind: "Interface",
    description: getJsDocDescription(decl),
    tags: getJsDocTags(decl),
    typeParams: resolveTypeParams(decl),
    members,
    filePath,
    line: decl.getStartLineNumber(),
  }
}

// oxlint-disable-next-line typescript/no-explicit-any
function resolveTypeAliasExport(decl: any, filePath: string): ResolvedExport {
  const typeNode = decl.getTypeNode()
  const typeLiteral = typeNode?.asKind(SyntaxKind.TypeLiteral)
  const sourceFile = decl.getSourceFile()

  let members: ResolvedExportMember[] | undefined

  if (typeLiteral) {
    members = typeLiteral
      .getMembers()
      .filter(Node.isPropertySignature)
      // oxlint-disable-next-line typescript/no-explicit-any
      .map((prop: any) => {
        const type = prop.getTypeNode()?.getText().trim() || "unknown"
        const typeInfo = resolveParamTypeInfo(type, sourceFile)

        return {
          name: prop.getName(),
          type,
          isOptional: prop.hasQuestionToken(),
          isReadonly: prop.isReadonly(),
          description: getJsDocDescription(prop),
          tags: getJsDocTags(prop),
          ...typeInfo,
        }
      })
  }

  return {
    name: decl.getName(),
    kind: "TypeAlias",
    description: getJsDocDescription(decl),
    tags: getJsDocTags(decl),
    members,
    typeText: typeNode?.getText().trim(),
    referencedTypes: resolveReferencedTypes(
      typeNode?.getText().trim(),
      decl.getSourceFile()
    ),
    filePath,
    line: decl.getStartLineNumber(),
  }
}

// oxlint-disable-next-line typescript/no-explicit-any
function resolveFunctionExport(decl: any, filePath: string): ResolvedExport {
  const params: ResolvedExportParam[] = decl.getParameters().map(
    // oxlint-disable-next-line typescript/no-explicit-any
    (param: any) => {
      let type = param.getTypeNode()?.getText().trim()

      if (!type) {
        // Try inferring from initializer literal
        type = inferTypeFromInitializer(param)
      }

      if (!type) {
        // Try type checker inference
        try {
          type = param.getType()?.getText(param) || "unknown"
        } catch {
          type = "unknown"
        }
      }

      // For destructured params ({ catalog, schema, ... }: Type),
      // use a clean name derived from the type or fallback to "props"
      let name = param.getName()

      if (name.startsWith("{") || name.startsWith("[")) {
        name =
          type === "unknown"
            ? "props"
            : type.replace(
                /^(?:Readonly<)?(?<typeName>\w+).*$/u,
                (_: string, n: string) => n.charAt(0).toLowerCase() + n.slice(1)
              )
      }

      return {
        name,
        type,
        isOptional: param.isOptional(),
        description: resolveParamDescription(decl, name),
        defaultValue: param.getInitializer()?.getText(),
        ...resolveParamTypeInfo(type, decl.getSourceFile()),
      }
    }
  )

  const returnTypeNode = decl.getReturnTypeNode()?.getText().trim()
  let returnType = returnTypeNode || undefined

  // If no explicit return type annotation, try to infer from the type checker
  if (!returnType) {
    try {
      const [signature] = decl.getType().getCallSignatures()
      const inferredReturnType = signature?.getReturnType()

      if (inferredReturnType) {
        const text = inferredReturnType.getText(decl)
        if (text && text !== "void" && text !== "any") {
          returnType = text
        }
      }
    } catch {
      // Type inference not available — fallback to void
    }
  }

  const returnsDescription = resolveReturnsDescription(decl)
  const signatureText = decl.getText().split("{")[0]?.trim() || decl.getName()

  return {
    name: decl.getName() ?? "default",
    kind: "Function",
    description: getJsDocDescription(decl),
    tags: getJsDocTags(decl),
    typeParams: resolveTypeParams(decl),
    signatures: [
      {
        text: signatureText,
        params,
        returnType: returnType || "void",
        returnsDescription,
      },
    ],
    filePath,
    line: decl.getStartLineNumber(),
  }
}

// oxlint-disable-next-line typescript/no-explicit-any
function resolveClassExport(decl: any, filePath: string): ResolvedExport {
  const sourceFile = decl.getSourceFile()

  // --- Properties (public, non-static) ---
  const members: ResolvedExportMember[] = decl
    .getProperties()
    .filter(
      // oxlint-disable-next-line typescript/no-explicit-any
      (p: any) =>
        !p.isStatic() &&
        p.getScope?.() !== "private" &&
        p.getScope?.() !== "protected"
    )
    // oxlint-disable-next-line typescript/no-explicit-any
    .map((prop: any) => {
      const type = prop.getTypeNode()?.getText().trim() || "unknown"
      const typeInfo = resolveParamTypeInfo(type, sourceFile)

      return {
        name: prop.getName(),
        type,
        isOptional: prop.hasQuestionToken?.() ?? false,
        isReadonly: prop.isReadonly?.() ?? false,
        description: getJsDocDescription(prop),
        tags: getJsDocTags(prop),
        ...typeInfo,
      }
    })

  // --- Constructor ---
  const ctor = decl.getConstructors()?.[0]
  let constructorInfo: ResolvedExport["classConstructor"]

  if (ctor) {
    const ctorParams: ResolvedExportParam[] = ctor.getParameters().map(
      // oxlint-disable-next-line typescript/no-explicit-any
      (param: any) => {
        let type = param.getTypeNode()?.getText().trim()

        if (!type) {
          type = inferTypeFromInitializer(param)
        }

        if (!type) {
          try {
            type = param.getType()?.getText(param) || "unknown"
          } catch {
            type = "unknown"
          }
        }

        let name = param.getName()

        if (name.startsWith("{") || name.startsWith("[")) {
          name =
            type === "unknown"
              ? "props"
              : type.replace(
                  /^(?:Readonly<)?(?<typeName>\w+).*$/u,
                  (_: string, n: string) =>
                    n.charAt(0).toLowerCase() + n.slice(1)
                )
        }

        return {
          name,
          type: type ?? "unknown",
          isOptional: param.isOptional(),
          description: resolveParamDescription(ctor, name),
          defaultValue: param.getInitializer()?.getText(),
          ...resolveParamTypeInfo(type ?? "unknown", sourceFile),
        }
      }
    )

    constructorInfo = {
      description: getJsDocDescription(ctor),
      params: ctorParams,
    }
  }

  // --- Methods (public, non-static) ---
  const methods: ResolvedExport[] = decl
    .getMethods()
    .filter(
      // oxlint-disable-next-line typescript/no-explicit-any
      (m: any) =>
        !m.isStatic() &&
        m.getScope?.() !== "private" &&
        m.getScope?.() !== "protected"
    )
    // oxlint-disable-next-line typescript/no-explicit-any
    .map((method: any) => {
      const params: ResolvedExportParam[] = method.getParameters().map(
        // oxlint-disable-next-line typescript/no-explicit-any
        (param: any) => {
          let type = param.getTypeNode()?.getText().trim()

          if (!type) {
            type = inferTypeFromInitializer(param)
          }

          if (!type) {
            try {
              type = param.getType()?.getText(param) || "unknown"
            } catch {
              type = "unknown"
            }
          }

          // Destructuring cleanup
          let name = param.getName()

          if (name.startsWith("{") || name.startsWith("[")) {
            name =
              type === "unknown"
                ? "props"
                : type.replace(
                    /^(?:Readonly<)?(?<typeName>\w+).*$/u,
                    (_: string, n: string) =>
                      n.charAt(0).toLowerCase() + n.slice(1)
                  )
          }

          return {
            name,
            type: type ?? "unknown",
            isOptional: param.isOptional(),
            description: resolveParamDescription(method, name),
            defaultValue: param.getInitializer()?.getText(),
            ...resolveParamTypeInfo(type ?? "unknown", sourceFile),
          }
        }
      )

      // Return type: explicit annotation first, then type checker inference
      let returnType = method.getReturnTypeNode()?.getText().trim()

      if (!returnType) {
        try {
          const [sig] = method.getType().getCallSignatures()
          const inferred = sig?.getReturnType()

          if (inferred) {
            const text = inferred.getText(method)
            if (text && text !== "void" && text !== "any") {
              returnType = text
            }
          }
        } catch {
          // inference not available
        }
      }

      returnType ||= "void"

      const returnsDescription = resolveReturnsDescription(method)
      const methodTypeParams = resolveTypeParams(method)

      return {
        name: method.getName(),
        kind: "Method",
        description: getJsDocDescription(method),
        tags: getJsDocTags(method),
        isAsync: method.isAsync(),
        typeParams: methodTypeParams,
        signatures: [{ text: "", params, returnType, returnsDescription }],
        filePath,
        line: method.getStartLineNumber(),
      } satisfies ResolvedExport
    })

  return {
    name: decl.getName() ?? "default",
    kind: "Class",
    description: getJsDocDescription(decl),
    tags: getJsDocTags(decl),
    typeParams: resolveTypeParams(decl),
    classConstructor: constructorInfo,
    members: members.length > 0 ? members : undefined,
    methods: methods.length > 0 ? methods : undefined,
    filePath,
    line: decl.getStartLineNumber(),
  }
}

// oxlint-disable-next-line typescript/no-explicit-any
function resolveEnumExport(decl: any, filePath: string): ResolvedExport {
  // oxlint-disable-next-line typescript/no-explicit-any
  const enumMembers = decl.getMembers().map((member: any) => ({
    name: member.getName(),
    value: member.getInitializer()?.getText(),
    description: getJsDocDescription(member),
  }))

  return {
    name: decl.getName(),
    kind: "Enum",
    description: getJsDocDescription(decl),
    tags: getJsDocTags(decl),
    enumMembers,
    filePath,
    line: decl.getStartLineNumber(),
  }
}

function resolveVariableExport(
  // oxlint-disable-next-line typescript/no-explicit-any
  decl: any,
  // oxlint-disable-next-line typescript/no-explicit-any
  stmt: any,
  filePath: string
): ResolvedExport {
  const init = decl.getInitializer()
  const isFunction =
    init &&
    (init.getKind() === SyntaxKind.ArrowFunction ||
      init.getKind() === SyntaxKind.FunctionExpression)

  if (isFunction) {
    const params: ResolvedExportParam[] = init.getParameters().map(
      // oxlint-disable-next-line typescript/no-explicit-any
      (param: any) => ({
        name: param.getName(),
        type:
          param.getTypeNode()?.getText().trim() ||
          inferTypeFromInitializer(param) ||
          "unknown",
        isOptional: param.isOptional(),
        description: resolveParamDescription(stmt, param.getName()),
        defaultValue: param.getInitializer()?.getText(),
      })
    )

    const returnType =
      init.getReturnTypeNode?.()?.getText().trim() ||
      decl.getTypeNode()?.getText().trim() ||
      "void"

    const signatureText = `${decl.getName()}(${params.map((p) => `${p.name}${p.isOptional ? "?" : ""}: ${p.type}`).join(", ")}): ${returnType}`

    return {
      name: decl.getName(),
      kind: "Function",
      description: getJsDocDescription(stmt),
      tags: getJsDocTags(stmt),
      signatures: [{ text: signatureText, params, returnType }],
      filePath,
      line: stmt.getStartLineNumber(),
    }
  }

  return {
    name: decl.getName(),
    kind: "Variable",
    description: getJsDocDescription(stmt),
    tags: getJsDocTags(stmt),
    typeText: decl.getTypeNode()?.getText().trim() || init?.getText().trim(),
    filePath,
    line: stmt.getStartLineNumber(),
  }
}
