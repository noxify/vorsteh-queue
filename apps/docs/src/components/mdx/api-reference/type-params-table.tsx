import { Fragment } from "react"
import { createSlug } from "renoun"

import {
  Table as UITable,
  TableHead,
  TableRow as UITableRow,
  TableCell,
} from "@/components/ui/table"
import type { ResolvedTypeParam } from "@/lib/ts-morph-analysis"

import { DescriptionBlock } from "./description-block"

export function TypeParamsTable({
  sectionSlug,
  typeParams,
  templateTags,
}: {
  sectionSlug: string
  typeParams: ResolvedTypeParam[]
  templateTags?: { name: string; text?: string }[]
}) {
  // Extract @template descriptions keyed by param name
  const templateDescriptions = new Map<string, string>()

  if (templateTags) {
    for (const tag of templateTags) {
      if (tag.name === "template" && tag.text) {
        const match = /^(?<name>\S+)(?:\s+-\s+(?<desc>.+))?$/u.exec(
          tag.text.trim()
        )

        if (match?.groups?.name && match.groups.desc) {
          templateDescriptions.set(match.groups.name, match.groups.desc)
        }
      }
    }
  }

  return (
    <UITable variant="outline">
      <thead>
        <UITableRow>
          <TableHead className="bg-muted font-bold">Parameter</TableHead>
          <TableHead className="bg-muted font-bold">Constraint</TableHead>
          <TableHead className="bg-muted font-bold">Default</TableHead>
        </UITableRow>
      </thead>
      <tbody>
        {typeParams.map((tp) => {
          const description = templateDescriptions.get(tp.name)

          return (
            <Fragment key={tp.name}>
              <UITableRow>
                <TableCell
                  id={`${sectionSlug}-${createSlug(tp.name)}`}
                  className="text-foreground max-w-75 font-mono text-xs font-semibold break-all whitespace-normal"
                >
                  <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
                    {tp.name}
                  </code>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-75 font-mono text-xs break-all whitespace-normal">
                  <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
                    {tp.constraint ?? "—"}
                  </code>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-75 font-mono text-xs break-all whitespace-normal">
                  <code className="border-border bg-muted/60 inline-flex rounded border px-1.5 py-0.5 font-mono text-xs">
                    {tp.defaultType ?? "—"}
                  </code>
                </TableCell>
              </UITableRow>
              {description && (
                <UITableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground whitespace-normal"
                  >
                    <div className="ml-4">
                      <DescriptionBlock>{description}</DescriptionBlock>
                    </div>
                  </TableCell>
                </UITableRow>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </UITable>
  )
}
