import type { CodeBlockProps, CommandProps } from "renoun"
import { CodeBlock as RenounCodeBlock, Toolbar } from "renoun/components"

import { ClientOnly } from "@/components/client-only"
import { CommandTabsClient } from "@/components/mdx/command-client"
import type { PackageManager } from "@/components/mdx/command-client"

const PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm"]

function getChildrenText(children: React.ReactNode): string {
  const parts: string[] = []
  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child))
    }
  }

  return parts.map((part) => part.trim()).join("")
}

const COMMAND_PREFIXES: Record<
  NonNullable<CommandProps["variant"]>,
  Record<PackageManager, string>
> = {
  create: {
    npm: "npm create",
    pnpm: "pnpm create",
  },
  exec: {
    npm: "npx",
    pnpm: "pnpm dlx",
  },
  install: {
    npm: "npm install",
    pnpm: "pnpm add",
  },
  "install-dev": {
    npm: "npm install --save-dev",
    pnpm: "pnpm add -D",
  },
  run: {
    npm: "npm run",
    pnpm: "pnpm",
  },
}

function buildCommand(
  packageManager: PackageManager,
  variant: NonNullable<CommandProps["variant"]>,
  subject: string
): string {
  const prefix = COMMAND_PREFIXES[variant][packageManager]
  return `${prefix} ${subject}`.trim()
}

const CodeBlock = ({ ...props }: CodeBlockProps) => (
  <div className="not-prose bg-muted border-border my-6 rounded-lg border text-sm leading-6 dark:border-none">
    <RenounCodeBlock
      {...props}
      shouldFormat={false}
      showErrors={false}
      shouldAnalyze={false}
      components={{
        // oxlint-disable-next-line react/no-unstable-nested-components
        Toolbar: (toolbarProps) => (
          <Toolbar {...toolbarProps} className="border-b text-base!" />
        ),
        // oxlint-disable-next-line react/no-unstable-nested-components
        Container: (containerProps) => (
          <div
            {...containerProps}
            style={containerProps.css}
            className="not-prose border-border border dark:border-none"
          />
        ),
      }}
      showLineNumbers={false}
    />
  </div>
)

export function CommandWrapper({ children, variant }: CommandProps) {
  const subject = getChildrenText(children)

  if (!variant) {
    return (
      <ClientOnly>
        <CodeBlock language="shell">{subject}</CodeBlock>
      </ClientOnly>
    )
  }

  const commands = PACKAGE_MANAGERS.map((packageManager) => ({
    content: (
      <CodeBlock language="shell">
        {buildCommand(packageManager, variant, subject)}
      </CodeBlock>
    ),
    packageManager,
  }))

  return <CommandTabsClient commands={commands} />
}
