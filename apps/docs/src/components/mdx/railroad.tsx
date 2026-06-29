"use client"

import type { Diagram } from "@choo-choo/core"
import { ebnfParser } from "@choo-choo/parser-ebnf"
import { ChooChoo } from "@choo-choo/react"
import React from "react"

import "@choo-choo/react/styles.css"

import {
  looksLikeLegacyRailroad,
  parseLegacyRailroadDiagram,
} from "@/components/mdx/railroad-legacy-parser"
import { PanZoomControl } from "@/components/pan-zoom/pan-zoom-control"
import { PanZoomDialog } from "@/components/pan-zoom/pan-zoom-dialog"

class RailroadErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    fallback: (error: Error) => React.ReactNode
  },
  { error: Error | null }
> {
  public state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error)
    }

    return this.props.children
  }
}

export function RailroadDiagram({
  code,
  preview,
}: {
  code: string
  preview?: boolean
}) {
  const parsed = React.useMemo<
    | { mode: "legacy"; diagram: Diagram }
    | { mode: "ebnf" }
    | { mode: "error"; error: Error }
  >(() => {
    try {
      if (looksLikeLegacyRailroad(code)) {
        return {
          mode: "legacy",
          diagram: parseLegacyRailroadDiagram(code),
        }
      }

      ebnfParser.parse(code)
      return { mode: "ebnf" }
    } catch (error) {
      return {
        mode: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }, [code])

  if (parsed.mode === "error") {
    return <pre>{parsed.error.message}</pre>
  }

  const diagram = (
    // oxlint-disable-next-line react/no-unstable-nested-components
    <RailroadErrorBoundary fallback={(error) => <pre>{error.message}</pre>}>
      {parsed.mode === "legacy" ? (
        <ChooChoo
          ir={parsed.diagram}
          options={{ sizing: "intrinsic" }}
          className="inline-block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full"
        />
      ) : (
        <ChooChoo
          source={code}
          parser={ebnfParser}
          options={{ sizing: "intrinsic" }}
          className="inline-block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full"
        />
      )}
    </RailroadErrorBoundary>
  )

  if (preview) {
    return (
      <PanZoomDialog
        title="Railroad diagram"
        previewClassName="h-64"
        className="my-8"
        fitOnMount={true}
      >
        {diagram}
      </PanZoomDialog>
    )
  }

  return (
    <div className="my-6 h-112 max-h-[65vh] min-h-72 w-full">
      <PanZoomControl className="h-full w-full" centerOnMount={true}>
        {diagram}
      </PanZoomControl>
    </div>
  )
}
