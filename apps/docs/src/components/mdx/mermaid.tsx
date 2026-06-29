"use client"

import { useTheme } from "better-themes/rsc"
import React from "react"

import { PanZoomControl } from "@/components/pan-zoom/pan-zoom-control"
import { PanZoomDialog } from "@/components/pan-zoom/pan-zoom-dialog"

import { renderMermaidSVG, THEMES } from "../beautiful-mermaid"

const DEFAULT_ASPECT_RATIO = 16 / 9

function parseMermaidDimensions(
  svg: string
): { width: number; height: number } | null {
  const viewBoxMatch = svg.match(/viewBox=["'](?<value>[^"']+)["']/iu)

  if (viewBoxMatch?.groups?.value) {
    const parts = viewBoxMatch.groups.value
      .split(/[\s,]+/u)
      .map(Number)
      .filter((part) => Number.isFinite(part))

    if (parts.length === 4) {
      const width = parts.at(2)
      const height = parts.at(3)

      if (width && height && width > 0 && height > 0) {
        return { width, height }
      }
    }
  }

  const widthMatch = svg.match(
    /\bwidth=["'](?<value>[0-9]*\.?[0-9]+)(?:px)?["']/iu
  )
  const heightMatch = svg.match(
    /\bheight=["'](?<value>[0-9]*\.?[0-9]+)(?:px)?["']/iu
  )

  if (widthMatch && heightMatch) {
    const width = Number(widthMatch.groups?.value)
    const height = Number(heightMatch.groups?.value)

    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      return { width, height }
    }
  }

  return null
}

function parseMermaidAspectRatio(svg: string): number {
  const dimensions = parseMermaidDimensions(svg)

  if (dimensions) {
    return dimensions.width / dimensions.height
  }

  return DEFAULT_ASPECT_RATIO
}

// copied from https://github.com/lukilabs/beautiful-mermaid#react-integration
export function MermaidDiagram({
  code,
  preview,
}: {
  code: string
  preview?: boolean
}) {
  const { theme } = useTheme()
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light"
  )

  React.useEffect(() => {
    if (theme === "light" || theme === "dark") {
      setResolvedTheme(theme)
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateTheme = () => {
      setResolvedTheme(mediaQuery.matches ? "dark" : "light")
    }

    updateTheme()
    mediaQuery.addEventListener("change", updateTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateTheme)
    }
  }, [theme])

  const { svg, error } = React.useMemo(() => {
    try {
      const mermaidTheme =
        resolvedTheme === "dark"
          ? THEMES["github-dark"]
          : THEMES["github-light"]

      return {
        svg: renderMermaidSVG(code, { ...mermaidTheme, transparent: true }),
        error: null,
      }
      // oxlint-disable-next-line no-shadow
    } catch (error) {
      return {
        svg: null,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }, [code, resolvedTheme])

  if (error) {
    return <pre>{error.message}</pre>
  }

  if (!svg) {
    return null
  }

  const previewSvg = svg

  const inlineAspectRatio = React.useMemo(() => {
    const rawRatio = parseMermaidAspectRatio(previewSvg)

    // Prevent extreme SVG ratios from creating unusable viewport heights.
    return Math.min(4, Math.max(0.85, rawRatio))
  }, [previewSvg])

  const inlineDimensions = React.useMemo(
    () => parseMermaidDimensions(previewSvg),
    [previewSvg]
  )

  const isVeryWideDiagram =
    inlineAspectRatio > 2.2 ||
    (inlineDimensions ? inlineDimensions.width >= 1600 : false)
  const wideInitialZoom = isVeryWideDiagram ? 0.9 : 1

  // preview wins over centered: render via dedicated pan/zoom lightbox
  if (preview) {
    return (
      <PanZoomDialog
        title="Mermaid diagram"
        previewClassName="h-64"
        className="my-8"
        initialZoom={wideInitialZoom}
        fitOnMount={isVeryWideDiagram}
      >
        <div
          className="inline-block"
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
      </PanZoomDialog>
    )
  }

  const inlineMinHeight = inlineAspectRatio < 1 ? "18rem" : "20rem"
  const inlineMaxHeight =
    inlineAspectRatio < 1 ? "48vh" : inlineAspectRatio < 1.4 ? "54vh" : "60vh"
  const inlineHeight = inlineDimensions
    ? `min(calc(${Math.round(inlineDimensions.height)}px + 4rem), ${inlineMaxHeight})`
    : undefined

  return (
    <div
      className="my-6 w-full"
      style={{
        aspectRatio: inlineHeight ? undefined : inlineAspectRatio,
        height: inlineHeight,
        minHeight: inlineMinHeight,
        maxHeight: inlineMaxHeight,
      }}
    >
      <PanZoomControl
        className="h-full w-full"
        centerOnMount={true}
        initialZoom={wideInitialZoom}
        fitOnMount={isVeryWideDiagram}
      >
        <div
          className="inline-block [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
      </PanZoomControl>
    </div>
  )
}
