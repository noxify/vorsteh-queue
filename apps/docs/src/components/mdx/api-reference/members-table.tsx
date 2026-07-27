import { createSlug } from "renoun"

import {
  Table as UITable,
  TableHead,
  TableRow as UITableRow,
  TableCell,
} from "@/components/ui/table"

import { DescriptionBlock } from "./description-block"

export interface MemberRow {
  name: string
  type: string
  description?: string
  defaultValue?: string
  /** Whether this member is required (non-optional) */
  isRequired?: boolean
  /** Anchor link to another section (for exported types in same file) */
  typeLink?: string
  /** Inline-expanded members (for internal/non-exported types) */
  typeMembers?: {
    name: string
    type: string
    isOptional: boolean
    description?: string
  }[]
  /** External @see links */
  seeLinks?: { url: string; label: string }[]
}

export function MembersTable({
  sectionSlug,
  rows,
}: {
  sectionSlug: string
  rows: MemberRow[]
}) {
  return (
    <UITable variant="outline">
      <thead>
        <UITableRow>
          <TableHead className="bg-muted font-bold">Name</TableHead>
          <TableHead className="bg-muted font-bold">Type</TableHead>
        </UITableRow>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cellId = `${sectionSlug}-${createSlug(row.name)}`
          const hasSubRow = !!(
            row.description ||
            row.defaultValue ||
            (row.seeLinks && row.seeLinks.length > 0)
          )

          return (
            <MemberRowGroup
              key={row.name}
              row={row}
              cellId={cellId}
              hasSubRow={hasSubRow}
            />
          )
        })}
      </tbody>
    </UITable>
  )
}

function MemberRowGroup({
  row,
  cellId,
  hasSubRow,
}: {
  row: MemberRow
  cellId: string
  hasSubRow: boolean
}) {
  const hasTypeMembers = row.typeMembers && row.typeMembers.length > 0

  return (
    <>
      <UITableRow>
        <TableCell
          id={cellId}
          className="text-foreground max-w-75 font-mono text-xs font-semibold break-all whitespace-normal"
        >
          <span className="inline-flex items-center gap-1.5">
            {row.name}
            {row.isRequired && (
              <span className="bg-destructive/10 text-destructive rounded px-1.5 py-0.5 font-sans text-[10px] leading-none font-medium">
                Required
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="text-muted-foreground max-w-75 font-mono text-xs break-all whitespace-normal">
          {row.typeLink ? (
            <a
              href={`#${createSlug(row.typeLink)}`}
              className="border-border bg-muted/60 hover:bg-muted inline-flex rounded border px-1.5 py-0.5 font-mono text-xs underline decoration-dotted underline-offset-2"
            >
              {row.type}
            </a>
          ) : (
            <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
              {row.type}
            </code>
          )}
        </TableCell>
      </UITableRow>
      {hasSubRow && (
        <UITableRow>
          <TableCell
            colSpan={2}
            className="text-muted-foreground whitespace-normal"
          >
            <div className="ml-4 flex flex-col gap-1.5">
              {row.description && (
                <DescriptionBlock>{row.description}</DescriptionBlock>
              )}
              {row.defaultValue && (
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  Default:{" "}
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                    {row.defaultValue}
                  </code>
                </span>
              )}
              {row.seeLinks && row.seeLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {row.seeLinks.map((link) => (
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
              )}
            </div>
          </TableCell>
        </UITableRow>
      )}
      {hasTypeMembers && (
        <UITableRow>
          <TableCell colSpan={2} className="p-0 whitespace-normal">
            <div className="border-border/50 my-1 ml-6 border-l-2 pl-4">
              <UITable variant="outline">
                <thead>
                  <UITableRow>
                    <TableHead className="bg-muted/50 py-1.5 text-xs font-semibold">
                      Property
                    </TableHead>
                    <TableHead className="bg-muted/50 py-1.5 text-xs font-semibold">
                      Type
                    </TableHead>
                  </UITableRow>
                </thead>
                <tbody>
                  {/* oxlint-disable-next-line typescript/no-non-null-assertion */}
                  {row.typeMembers!.map((m) => (
                    <UITableRow key={m.name}>
                      <TableCell className="text-foreground max-w-75 font-mono text-xs font-semibold break-all whitespace-normal">
                        {m.name}
                        {m.isOptional ? "?" : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-75 font-mono text-xs break-all whitespace-normal">
                        <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
                          {m.type}
                        </code>
                      </TableCell>
                    </UITableRow>
                  ))}
                </tbody>
              </UITable>
            </div>
          </TableCell>
        </UITableRow>
      )}
    </>
  )
}
