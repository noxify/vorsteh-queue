import type { CodeBlockProps } from "renoun/components"
import { Markdown } from "renoun/components"

import { Kbd } from "@/components/ui/kbd"

import { LinkHandler } from "../link-handler"
import type { AnchorProps } from "./utils"

export function DescriptionBlock({ children }: { children: string }) {
  return (
    <div className="prose dark:prose-invert text-muted-foreground max-w-none text-sm">
      <Markdown
        components={{
          // oxlint-disable-next-line no-shadow react/no-unstable-nested-components
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          // oxlint-disable-next-line no-shadow react/no-unstable-nested-components
          ul: ({ children }) => (
            <ul className="mb-1 ml-4 list-disc">{children}</ul>
          ),
          // oxlint-disable-next-line no-shadow react/no-unstable-nested-components
          li: ({ children }) => <li className="mb-1">{children}</li>,
          // oxlint-disable-next-line react/no-unstable-nested-components no-shadow
          code: ({ children }: CodeBlockProps) => <Kbd>{children}</Kbd>,
          // oxlint-disable-next-line react/no-unstable-nested-components
          a: ({ href, children: linkChildren, ...props }: AnchorProps) => (
            <LinkHandler
              href={href}
              {...props}
              className="border-border bg-muted/60 hover:bg-muted inline-flex rounded border px-1.5 py-0.5 font-mono text-xs underline decoration-dotted underline-offset-2"
            >
              {linkChildren}
            </LinkHandler>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
