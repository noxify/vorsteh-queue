import "server-only"
import type { CommandOptionMeta } from "@vorsteh-queue/cli/commands-metadata"
import {
  getCommandConfig,
  getGlobalOptions,
} from "@vorsteh-queue/cli/commands-metadata"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Heading } from "./heading"

function formatDefault(opt: CommandOptionMeta): string | null {
  if (opt.defaultValueDescription) {
    return opt.defaultValueDescription
  }
  if (opt.defaultValue === undefined || opt.defaultValue === null) {
    return null
  }
  if (Array.isArray(opt.defaultValue) && opt.defaultValue.length === 0) {
    return "[]"
  }
  return JSON.stringify(opt.defaultValue)
}

interface CliCommandDetailsProps {
  /** The command name, e.g. "pull", "list-tables" */
  command?: string
  /** Render scope. "command" renders command args/options, "global" renders only global options. */
  scope?: "command" | "global"
}

/**
 * Renders CLI command options in a structured per-option format with descriptions,
 * types, defaults, and environment variable info.
 *
 * Reads command metadata directly from @vorsteh-queue/cli/commands at build time.
 *
 * @example
 * ```mdx
 * <CliCommandDetails command="pull" />
 * ```
 */
export function CliCommandDetails({
  command,
  scope = "command",
}: CliCommandDetailsProps) {
  const isGlobalScope = scope === "global"

  if (!isGlobalScope && !command) {
    throw new Error(
      "CliCommandDetails requires a command when scope is 'command'."
    )
  }

  const config = isGlobalScope
    ? { arguments: [], options: getGlobalOptions() }
    : getCommandConfig(command as string)

  return (
    <div className="my-6 space-y-8">
      {config.arguments.length > 0 && (
        <>
          <Heading id="cli-arguments" level={2}>
            Arguments
          </Heading>
          <div className="not-prose">
            <div className="mt-3">
              <Table variant="outline">
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-muted font-semibold">
                      Name
                    </TableHead>
                    <TableHead className="bg-muted font-semibold">
                      Description
                    </TableHead>
                    <TableHead className="bg-muted font-semibold">
                      Required
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.arguments.map((arg) => (
                    <TableRow key={arg.name}>
                      <TableCell>
                        <code className="border-border bg-muted/60 rounded border px-1.5 py-0.5 font-mono text-xs">
                          {arg.required ? `<${arg.name}>` : `[${arg.name}]`}
                          {arg.variadic ? "..." : ""}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm">
                        {arg.description}
                      </TableCell>
                      <TableCell className="text-sm">
                        {arg.required ? "Yes" : "No"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {config.options.length > 0 && (
        <>
          <Heading id="cli-options" level={2}>
            Options
          </Heading>

          {config.options.map((opt) => {
            const defaultDisplay = formatDefault(opt)
            const anchorId = opt.long?.replace("--", "")

            return (
              <div key={opt.flags} className="">
                <Heading id={anchorId as string} level={3}>
                  {opt.flags}
                </Heading>

                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {opt.description}
                </p>

                <div className="mt-3">
                  <Table variant="outline">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-muted w-28 font-semibold">
                          Property
                        </TableHead>
                        <TableHead className="bg-muted font-semibold">
                          Value
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-sm font-medium">
                          Type
                        </TableCell>
                        <TableCell>
                          <code className="border-border bg-muted/60 rounded border px-1.5 py-0.5 font-mono text-xs">
                            {opt.isBoolean ? "boolean" : "string"}
                          </code>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-sm font-medium">
                          Required
                        </TableCell>
                        <TableCell className="text-sm">
                          {opt.required ? "Yes" : "No"}
                        </TableCell>
                      </TableRow>
                      {defaultDisplay !== null && (
                        <TableRow>
                          <TableCell className="text-sm font-medium">
                            Default
                          </TableCell>
                          <TableCell>
                            <code className="border-border bg-muted/60 rounded border px-1.5 py-0.5 font-mono text-xs">
                              {defaultDisplay}
                            </code>
                          </TableCell>
                        </TableRow>
                      )}
                      {opt.envVar && (
                        <TableRow>
                          <TableCell className="text-sm font-medium">
                            Env var
                          </TableCell>
                          <TableCell>
                            <code className="border-border bg-muted/60 rounded border px-1.5 py-0.5 font-mono text-xs">
                              {opt.envVar}
                            </code>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
