import { ChevronDown } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import type { ComponentPropsWithoutRef } from "react"
import { createSlug } from "renoun"
import type {
  ReferenceProps as RenounReferenceProps,
  ReferenceComponents,
  ModuleExport,
} from "renoun"
import {
  Reference as DefaultReference,
  Link,
  Markdown,
} from "renoun/components"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table as UITable,
  TableHead,
  TableRow as UITableRow,
  TableCell,
} from "@/components/ui/table"

import { LinkHandler } from "./link-handler"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

/**
 * Renders API Reference documentation with collapsible sections for TypeScript exports.
 * Customizes all sub-components of renoun's Reference for styling and layout.
 */

// Track current section ID for generating scoped anchor IDs in table cells
let currentSectionSlug = ""

// Section - Collapsible wrapper for each export
const Section: ReferenceComponents["Section"] = ({ id, children }) => {
  const slug = createSlug(id ?? "")
  currentSectionSlug = slug
  return (
    <Collapsible
      defaultOpen
      className="border-border border-b last:border-b-0"
      id={slug}
    >
      {children}
    </Collapsible>
  )
}

// Section Heading
const SectionHeading: ReferenceComponents["SectionHeading"] = ({
  label,
  title,
}) => (
  <CollapsibleTrigger className="group w-full">
    <div className="hover:bg-muted flex items-center justify-between py-4 transition-colors">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
          {label}
        </span>
        <h3
          className="no-prose text-foreground my-0! text-lg font-semibold"
          style={{ fontFamily: spaceGrotesk.style.fontFamily }}
        >
          {title}
        </h3>
      </div>
      <ChevronDown className="text-muted-foreground ml-2 h-5 w-5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
    </div>
  </CollapsibleTrigger>
)

// Section Body
const SectionBody: ReferenceComponents["SectionBody"] = ({ children }) => (
  <CollapsibleContent className="pt-0 pb-4">
    <div className="space-y-4">{children}</div>
  </CollapsibleContent>
)

const gapMap = { small: "gap-2", medium: "gap-4", large: "gap-6" } as const

// Column Layout
const Column: ReferenceComponents["Column"] = ({
  gap = "medium",
  children,
}) => (
  <div className={`flex flex-col ${gapMap[gap ?? "medium"]}`}>{children}</div>
)

// Row Layout
const Row: ReferenceComponents["Row"] = ({ gap = "medium", children }) => (
  <div className={`flex flex-row flex-wrap ${gapMap[gap ?? "medium"]}`}>
    {children}
  </div>
)

// Detail
const Detail: ReferenceComponents["Detail"] = ({ children }) => (
  <div className="space-y-1">{children}</div>
)

// Detail Heading
const DetailHeading: ReferenceComponents["DetailHeading"] = ({ children }) => {
  // Render "Modifiers" inline as a compact badge-style element
  // oxlint-disable-next-line react-doctor/no-polymorphic-children -- intentional string/element dispatch
  const text = typeof children === "string" ? children : ""
  if (text === "Modifiers") {
    return (
      <span className="text-muted-foreground text-xs font-medium">
        {children}:
      </span>
    )
  }
  return (
    <h4 className="text-foreground mt-0! text-sm font-semibold">{children}</h4>
  )
}

// Signatures
const Signatures: ReferenceComponents["Signatures"] = ({ children }) => (
  <div className="overflow-x-auto wrap-break-word whitespace-pre-wrap">
    {children}
  </div>
)

// Table
const Table: ReferenceComponents["Table"] = ({ children }) => (
  <UITable variant="outline">{children}</UITable>
)

// Table Row Group - no wrapper element to avoid invalid HTML nesting
const TableRowGroup: ReferenceComponents["TableRowGroup"] = ({ children }) =>
  children

// Table Row
const TableRow: ReferenceComponents["TableRow"] = ({ children }) => (
  <UITableRow>{children}</UITableRow>
)

// Table Sub Row
const TableSubRow: ReferenceComponents["TableSubRow"] = ({
  children,
  colSpan = 1,
}) => (
  <UITableRow>
    <TableCell
      colSpan={colSpan}
      className="text-muted-foreground whitespace-normal"
    >
      <div className="ml-4">{children}</div>
    </TableCell>
  </UITableRow>
)

// Table Header
const TableHeader: ReferenceComponents["TableHeader"] = ({ children }) => (
  <TableHead className="bg-muted font-bold">{children}</TableHead>
)

// Extract text content from React children for generating anchor IDs
function getTextContent(node: unknown): string {
  if (typeof node === "string") {
    return node
  }
  if (typeof node === "number") {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join("")
  }
  if (node && typeof node === "object" && "props" in node) {
    return getTextContent(
      (node as { props: { children?: unknown } }).props.children
    )
  }
  return ""
}

// Table Data
const TableData: ReferenceComponents["TableData"] = ({ index, children }) => {
  // Generate an id for method/property name cells (first column) for anchor linking
  const textContent = getTextContent(children)
  const id =
    index === 0 && textContent
      ? `${currentSectionSlug}-${textContent
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/gu, "-")
          .replaceAll(/^-|-$/gu, "")}`
      : undefined

  return (
    <TableCell
      id={id}
      className={`max-w-[300px] font-mono text-xs break-all whitespace-normal ${index === 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}
    >
      {children}
    </TableCell>
  )
}

// Accessor Name
const AccessorName: ReferenceComponents["AccessorName"] = ({ name }) => (
  <span className="text-foreground font-semibold">{name}</span>
)

// Code
const Code: ReferenceComponents["Code"] = ({ children }) => (
  <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
    {children}
  </code>
)

type AnchorProps = ComponentPropsWithoutRef<"a">

// Description
const Description: ReferenceComponents["Description"] = ({ children }) => (
  <div className="prose prose-sm dark:prose-invert text-muted-foreground max-w-none text-sm">
    <Markdown
      components={{
        // oxlint-disable-next-line no-shadow react/no-unstable-nested-components
        a: ({ href, children: linkChildren, ...props }: AnchorProps) => (
          <LinkHandler href={href} {...props}>
            {linkChildren}
          </LinkHandler>
        ),
      }}
    >
      {children}
    </Markdown>
  </div>
)

const referenceComponents = {
  Section,
  SectionHeading,
  SectionBody,
  Column,
  Row,
  Detail,
  DetailHeading,
  Signatures,
  Table,
  TableRowGroup,
  TableRow,
  TableSubRow,
  TableHeader,
  TableData,
  AccessorName,
  Code,
  Description,
} satisfies Partial<ReferenceComponents>

// Main Reference component
export function Reference(props: RenounReferenceProps) {
  return (
    <div className="w-full">
      <DefaultReference {...props} components={referenceComponents} />
    </div>
  )
}

// References wrapper for multiple exports
type ReferencesProps = (
  | {
      source: RenounReferenceProps["source"]
      fileExports?: undefined
    }
  | {
      // oxlint-disable-next-line typescript/no-explicit-any
      fileExports: ModuleExport<any>[]
      source?: undefined
    }
) & {
  variant?: "full" | "summary"
}

export function References(props: ReferencesProps) {
  if (props.variant === "summary" && props.fileExports !== undefined) {
    return <SummaryReferences fileExports={props.fileExports} />
  }

  const content =
    // oxlint-disable-next-line no-negated-condition
    props.source !== undefined ? (
      <Reference source={props.source} />
    ) : (
      props.fileExports.map((fileExport) => (
        <Reference key={fileExport.name} source={fileExport} />
      ))
    )

  return <div className="flex flex-col">{content}</div>
}

function SummaryReferences({
  fileExports,
}: {
  // oxlint-disable-next-line typescript/no-explicit-any
  fileExports: ModuleExport<any>[]
}) {
  return (
    <div className="flex flex-col gap-6">
      {fileExports.map((fileExport) => {
        const title = fileExport.title || fileExport.name
        const description =
          typeof fileExport.description === "string"
            ? fileExport.description
            : undefined

        return (
          <section
            key={fileExport.name}
            id={fileExport.slug || fileExport.name}
            className="border-border border-b pb-6"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-semibold">{title}</h3>
              <Link source={fileExport} variant="edit">
                {({ href }) => (
                  <a
                    href={href}
                    className="text-muted-foreground hover:text-foreground text-sm no-underline"
                  >
                    View Source
                  </a>
                )}
              </Link>
            </div>
            {description ? (
              <div className="text-muted-foreground mt-3 text-sm">
                <Markdown>{description}</Markdown>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
