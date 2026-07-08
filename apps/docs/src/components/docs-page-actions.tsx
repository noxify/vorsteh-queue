"use client"

import { CheckIcon, ChevronDownIcon, CopyIcon, XIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"

const RESET_DELAY_MS = 2000
const AI_PROMPT_TEMPLATE =
  "Use this docs page: {{docs_url}} and this raw markdown source: {{raw_url}}. Answer questions based primarily on the raw source, with concise explanations and practical examples."

const AI_PROVIDERS = [
  {
    key: "t3chat",
    title: "Open in T3Chat",
    description: "Ask questions about this page",
    toUrl: (prompt: string) =>
      `https://t3.chat/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    key: "cursor",
    title: "Open in Cursor",
    description: "Ask questions about this page",
    toUrl: (prompt: string) =>
      `https://cursor.com/link/prompt?text=${encodeURIComponent(prompt)}`,
  },
  {
    key: "claude",
    title: "Open in Claude",
    description: "Ask questions about this page",
    toUrl: (prompt: string) =>
      `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    key: "chatgpt",
    title: "Open in ChatGPT",
    description: "Ask questions about this page",
    toUrl: (prompt: string) =>
      `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`,
  },
] as const

type CopyState = "idle" | "copied" | "failed"

export function DocsPageActions({
  rawContent,
  rawHref,
  sourceHref,
}: {
  rawContent: string
  rawHref: string
  sourceHref: string
}) {
  const [copyState, setCopyState] = React.useState<CopyState>("idle")
  const resetTimeoutRef = React.useRef<number | null>(null)
  const buttonVariant =
    copyState === "failed" ? "destructive" : ("outline" as const)

  const pageUrl = React.useMemo(() => {
    if (typeof window === "undefined") {
      return rawHref
    }

    return window.location.href
  }, [rawHref])

  const rawUrl = React.useMemo(() => {
    if (typeof window === "undefined") {
      return rawHref
    }

    return new URL(rawHref, window.location.origin).toString()
  }, [rawHref])

  const providerLinks = React.useMemo(() => {
    const prompt = AI_PROMPT_TEMPLATE.replace("{{docs_url}}", pageUrl).replace(
      "{{raw_url}}",
      rawUrl
    )

    return AI_PROVIDERS.map((provider) => ({
      ...provider,
      href: provider.toUrl(prompt),
    }))
  }, [pageUrl, rawUrl])

  React.useEffect(
    () => () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current)
      }
    },
    []
  )

  const scheduleReset = React.useCallback(() => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current)
    }

    resetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle")
      resetTimeoutRef.current = null
    }, RESET_DELAY_MS)
  }, [])

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawContent)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }

    scheduleReset()
  }, [rawContent, scheduleReset])

  return (
    <div className="mb-12 flex w-full">
      <div className="ml-auto flex items-center gap-2">
        <ButtonGroup>
          <Button
            onClick={handleCopy}
            variant={buttonVariant}
            className="cursor-pointer"
          >
            {copyState === "copied" ? (
              <CheckIcon />
            ) : copyState === "failed" ? (
              <XIcon />
            ) : (
              <CopyIcon />
            )}
            Copy Markdown
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant={buttonVariant}
                  aria-label="Open page actions"
                  className="cursor-pointer"
                >
                  Open
                  <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenuContent className="w-72" align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer p-0">
                  <a
                    href={rawHref}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full"
                  >
                    <Item size="sm" className="w-full p-2">
                      <ItemContent className="gap-0">
                        <ItemTitle>View as Markdown</ItemTitle>
                        <ItemDescription className="leading-none">
                          Opens the raw source in a new tab
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer p-0">
                  <a
                    href={sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full"
                  >
                    <Item size="sm" className="w-full p-2">
                      <ItemContent className="gap-0">
                        <ItemTitle>View Source</ItemTitle>
                        <ItemDescription className="leading-none">
                          Opens the source location for this page
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  </a>
                </DropdownMenuItem>
                {providerLinks.map((provider) => (
                  <DropdownMenuItem
                    key={provider.key}
                    className="cursor-pointer p-0"
                  >
                    <a
                      href={provider.href}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full"
                    >
                      <Item size="sm" className="w-full p-2">
                        <ItemContent className="gap-0">
                          <ItemTitle>{provider.title}</ItemTitle>
                          <ItemDescription className="leading-none">
                            {provider.description}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
    </div>
  )
}
