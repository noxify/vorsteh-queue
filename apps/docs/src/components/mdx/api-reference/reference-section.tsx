import { ChevronDown } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import { createSlug } from "renoun"
import { CodeBlock, Markdown } from "renoun/components"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ResolvedExport } from "@/lib/ts-morph-analysis"

import { DescriptionBlock } from "./description-block"
import { MembersTable } from "./members-table"
import { TypeParamsTable } from "./type-params-table"
import { extractSeeLinks, kindToLabel } from "./utils"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

// ---------------------------------------------------------------------------
// Sub-sections extracted to reduce complexity
// ---------------------------------------------------------------------------

function SeeLinks({ tags }: { tags?: { name: string; text?: string }[] }) {
  const links = extractSeeLinks(tags)

  if (!links) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-xs underline decoration-dotted underline-offset-2"
        >
          {link.label}
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  )
}

function FunctionSignatures({
  source,
  slug,
}: {
  source: ResolvedExport
  slug: string
}) {
  if (!source.signatures || source.signatures.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Type Parameters */}
      {source.typeParams && source.typeParams.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-foreground mt-0! text-sm font-semibold">
            Type Parameters
          </h4>
          <TypeParamsTable
            sectionSlug={slug}
            typeParams={source.typeParams}
            templateTags={source.tags}
          />
        </div>
      )}

      {source.signatures.map((sig, idx) => (
        <div key={idx} className="space-y-3">
          {sig.params.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-foreground mt-0! text-sm font-semibold">
                Parameters
              </h4>
              <MembersTable
                sectionSlug={slug}
                rows={sig.params.map((p) => ({
                  name: `${p.name}${p.isOptional ? "?" : ""}`,
                  type: p.type,
                  description: p.description,
                  defaultValue: p.defaultValue,
                  isRequired: !p.isOptional,
                  typeLink: p.typeLink,
                  typeMembers: p.typeMembers,
                }))}
              />
            </div>
          )}
          {((sig.returnType && sig.returnType !== "void") ||
            sig.returnsDescription) && (
            <div className="space-y-1">
              <h4 className="text-foreground mt-0! text-sm font-semibold">
                Returns
              </h4>
              {sig.returnType && sig.returnType !== "void" && (
                <CodeBlock
                  language="ts"
                  shouldAnalyze={false}
                  shouldFormat={false}
                  showErrors={false}
                  allowCopy={false}
                >
                  {sig.returnType}
                </CodeBlock>
              )}
              {sig.returnsDescription && (
                <DescriptionBlock>{sig.returnsDescription}</DescriptionBlock>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TypeDefinition({ source }: { source: ResolvedExport }) {
  const showDefinition =
    source.typeText &&
    ((source.kind === "TypeAlias" &&
      (!source.members || source.members.length === 0)) ||
      source.kind === "Variable")

  if (!showDefinition) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-foreground mt-0! text-sm font-semibold">
        Definition
      </h4>
      <CodeBlock
        language="ts"
        shouldAnalyze={false}
        shouldFormat={false}
        showErrors={false}
        allowCopy={false}
      >
        {/* oxlint-disable-next-line typescript/no-non-null-assertion */}
        {source.typeText!}
      </CodeBlock>
      {source.referencedTypes && source.referencedTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">See:</span>
          {source.referencedTypes.map((ref) => (
            <a
              key={ref}
              href={`#${createSlug(ref)}`}
              className="border-border bg-muted/60 hover:bg-muted inline-flex rounded border px-1.5 py-0.5 font-mono text-xs underline decoration-dotted underline-offset-2"
            >
              {ref}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function MethodDetail({
  method,
  parentSlug,
}: {
  method: ResolvedExport
  parentSlug: string
}) {
  const sig = method.signatures?.[0]
  const methodSlug = `${parentSlug}-${createSlug(method.name)}`

  return (
    <div id={methodSlug} className="border-border/50 space-y-2 border-l-2 pl-4">
      <div className="flex items-baseline gap-2">
        {method.isAsync && (
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs leading-none font-medium">
            async
          </span>
        )}
        <span className="text-foreground font-mono text-sm font-semibold">
          {method.name}
        </span>
      </div>

      {method.description && (
        <DescriptionBlock>{method.description}</DescriptionBlock>
      )}

      {/* Method type parameters */}
      {method.typeParams && method.typeParams.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-foreground text-xs font-semibold">
            Type Parameters
          </h5>
          <TypeParamsTable
            sectionSlug={methodSlug}
            typeParams={method.typeParams}
            templateTags={method.tags}
          />
        </div>
      )}

      {/* Method parameters */}
      {sig && sig.params.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-foreground text-xs font-semibold">Parameters</h5>
          <MembersTable
            sectionSlug={methodSlug}
            rows={sig.params.map((p) => ({
              name: `${p.name}${p.isOptional ? "?" : ""}`,
              type: p.type,
              description: p.description,
              defaultValue: p.defaultValue,
              isRequired: !p.isOptional,
              typeLink: p.typeLink,
              typeMembers: p.typeMembers,
            }))}
          />
        </div>
      )}

      {/* Method return type */}
      {sig &&
        ((sig.returnType && sig.returnType !== "void") ||
          sig.returnsDescription) && (
          <div className="space-y-1">
            <h5 className="text-foreground text-xs font-semibold">Returns</h5>
            {sig.returnType && sig.returnType !== "void" && (
              <CodeBlock
                language="ts"
                shouldAnalyze={false}
                shouldFormat={false}
                showErrors={false}
                allowCopy={false}
              >
                {sig.returnType}
              </CodeBlock>
            )}
            {sig.returnsDescription && (
              <DescriptionBlock>{sig.returnsDescription}</DescriptionBlock>
            )}
          </div>
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReferenceSection — renders a single ResolvedExport as a collapsible section
// ---------------------------------------------------------------------------

/**
 * Renders a single ResolvedExport as a collapsible section with full details.
 */
export function ReferenceSection({ source }: { source: ResolvedExport }) {
  const slug = createSlug(source.name)

  return (
    <div className="w-full">
      <Collapsible
        defaultOpen
        className="border-border border-b last:border-b-0"
        id={slug}
      >
        <CollapsibleTrigger className="group w-full">
          <div className="hover:bg-muted flex items-center justify-between px-6 py-4 transition-colors">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
                {kindToLabel(source.kind)}
              </span>
              <h3
                className="no-prose text-foreground my-0! text-lg font-semibold"
                style={{ fontFamily: spaceGrotesk.style.fontFamily }}
              >
                {source.name}
              </h3>
            </div>
            <ChevronDown className="text-muted-foreground ml-2 h-5 w-5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-6 pt-0 pb-4">
          <div className="space-y-4">
            {source.description && (
              <DescriptionBlock>{source.description}</DescriptionBlock>
            )}

            <SeeLinks tags={source.tags} />

            {/* Type Parameters (for non-function exports) */}
            {!source.signatures &&
              source.typeParams &&
              source.typeParams.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-foreground mt-0! text-sm font-semibold">
                    Type Parameters
                  </h4>
                  <TypeParamsTable
                    sectionSlug={slug}
                    typeParams={source.typeParams}
                    templateTags={source.tags}
                  />
                </div>
              )}

            <FunctionSignatures source={source} slug={slug} />

            {/* Class constructor */}
            {source.classConstructor &&
              source.classConstructor.params.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-foreground mt-0! text-sm font-semibold">
                    Constructor
                  </h4>
                  {source.classConstructor.description && (
                    <DescriptionBlock>
                      {source.classConstructor.description}
                    </DescriptionBlock>
                  )}
                  <MembersTable
                    sectionSlug={slug}
                    rows={source.classConstructor.params.map((p) => ({
                      name: `${p.name}${p.isOptional ? "?" : ""}`,
                      type: p.type,
                      description: p.description,
                      defaultValue: p.defaultValue,
                      isRequired: !p.isOptional,
                      typeLink: p.typeLink,
                      typeMembers: p.typeMembers,
                    }))}
                  />
                </div>
              )}

            {/* Interface/TypeAlias/Class property members */}
            {source.members && source.members.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-foreground mt-0! text-sm font-semibold">
                  Properties
                </h4>
                <MembersTable
                  sectionSlug={slug}
                  rows={source.members.map((m) => ({
                    name: `${m.name}${m.isOptional ? "?" : ""}`,
                    type: m.type,
                    description: m.description,
                    defaultValue: m.tags?.find((t) => t.name === "default")
                      ?.text,
                    isRequired: !m.isOptional,
                    typeLink: m.typeLink,
                    typeMembers: m.typeMembers,
                    seeLinks: extractSeeLinks(m.tags),
                  }))}
                />
              </div>
            )}

            {/* Class methods — detailed rendering */}
            {source.methods && source.methods.length > 0 && (
              <div className="mt-4 space-y-4">
                <h4 className="text-foreground mt-0! text-sm font-semibold">
                  Methods
                </h4>
                {source.methods.map((method) => (
                  <MethodDetail
                    key={method.name}
                    method={method}
                    parentSlug={slug}
                  />
                ))}
              </div>
            )}

            {/* Enum members */}
            {source.enumMembers && source.enumMembers.length > 0 && (
              <MembersTable
                sectionSlug={slug}
                rows={source.enumMembers.map((m) => ({
                  name: m.name,
                  type: m.value ?? "",
                  description: m.description,
                }))}
              />
            )}

            <TypeDefinition source={source} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReferenceSummary — title + description only
// ---------------------------------------------------------------------------

/**
 * Renders a single ResolvedExport in summary mode (title + description only).
 */
export function ReferenceSummary({ source }: { source: ResolvedExport }) {
  const slug = createSlug(source.name)

  return (
    <section id={slug} className="border-border border-b pb-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold">{source.name}</h3>
      </div>
      {source.description ? (
        <div className="text-muted-foreground mt-3 text-sm">
          <Markdown>{source.description}</Markdown>
        </div>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// ReferenceTable — flat properties table without collapsible
// ---------------------------------------------------------------------------

/**
 * Renders a single ResolvedExport as a flat properties table (no collapsible).
 * Used for showing a single interface/type inline without the full section chrome.
 */
export function ReferenceTable({ source }: { source: ResolvedExport }) {
  const slug = createSlug(source.name)

  if (!source.members || source.members.length === 0) {
    return null
  }

  return (
    <MembersTable
      sectionSlug={slug}
      rows={source.members.map((m) => ({
        name: `${m.name}${m.isOptional ? "?" : ""}`,
        type: m.type,
        description: m.description,
        defaultValue: m.tags?.find((t) => t.name === "default")?.text,
        isRequired: !m.isOptional,
        typeLink: m.typeLink,
        typeMembers: m.typeMembers,
        seeLinks: extractSeeLinks(m.tags),
      }))}
    />
  )
}
