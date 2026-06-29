"use client"

import Image from "next/image"
import type { ComponentPropsWithoutRef } from "react"

import { PanZoomDialog } from "@/components/pan-zoom/pan-zoom-dialog"

type ImageMode = "default" | "zoom"
type ImagePreviewFit = "cover" | "contain"

interface ImageHandlerProps {
  src: string
  alt?: string
  width?: number
  height?: number
  previewFit?: ImagePreviewFit
  mode?: ImageMode
}

function parsePositiveInt(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseMode(normalized: string): ImageMode | undefined {
  const modeMatch = normalized.match(
    /\bmode\s*[:=]\s*(?<mode>default|preview|zoom)\b/u
  )

  if (modeMatch?.groups?.mode) {
    return modeMatch.groups.mode === "preview"
      ? "zoom"
      : (modeMatch.groups.mode as ImageMode)
  }

  if (normalized.includes("preview") || normalized.includes("zoom")) {
    return "zoom"
  }

  if (normalized.includes("default")) {
    return "default"
  }

  return undefined
}

function parsePreviewFit(normalized: string): ImagePreviewFit | undefined {
  const fitMatch = normalized.match(/\bfit\s*[:=]\s*(?<fit>cover|contain)\b/u)

  if (fitMatch?.groups?.fit) {
    return fitMatch.groups.fit as ImagePreviewFit
  }

  if (normalized.includes("contain")) {
    return "contain"
  }

  if (normalized.includes("cover")) {
    return "cover"
  }

  return undefined
}

function parseSizeOptions(normalized: string): {
  width?: number
  height?: number
} {
  const widthMatch = normalized.match(/\b(?:width|w)\s*[:=]\s*(?<value>\d+)\b/u)
  const heightMatch = normalized.match(
    /\b(?:height|h)\s*[:=]\s*(?<value>\d+)\b/u
  )

  return {
    width: parsePositiveInt(widthMatch?.groups?.value),
    height: parsePositiveInt(heightMatch?.groups?.value),
  }
}

function parseImageOptionsFromSources(sources: (string | undefined)[]): {
  mode?: ImageMode
  previewFit?: ImagePreviewFit
  width?: number
  height?: number
} {
  let mode: ImageMode | undefined
  let previewFit: ImagePreviewFit | undefined
  let width: number | undefined
  let height: number | undefined

  for (const source of sources) {
    if (!source) {
      continue
    }

    const normalized = source.toLowerCase()
    const sizeOptions = parseSizeOptions(normalized)

    mode ??= parseMode(normalized)
    previewFit ??= parsePreviewFit(normalized)
    width ??= sizeOptions.width
    height ??= sizeOptions.height
  }

  return { mode: mode ?? "default", previewFit, width, height }
}

export function MarkdownImageHandler({
  title,
  src,
  alt,
  width,
  height,
}: ComponentPropsWithoutRef<"img">) {
  // Markdown image options can come from title, alt text hints,
  // or URL fragments like #mode=zoom&fit=cover.
  const srcValue =
    typeof src === "string"
      ? src
      : typeof src === "object" && src && "src" in src
        ? String(src.src)
        : ""
  const altValue = typeof alt === "string" ? alt : ""
  const srcFragment = srcValue?.split("#").at(1)
  const options = parseImageOptionsFromSources([title, altValue, srcFragment])

  const widthValue =
    typeof width === "number"
      ? width
      : typeof width === "string"
        ? Number(width)
        : options.width

  const heightValue =
    typeof height === "number"
      ? height
      : typeof height === "string"
        ? Number(height)
        : options.height

  return (
    <ImageHandler
      src={srcValue}
      alt={altValue}
      width={
        Number.isFinite(widthValue as number) && (widthValue as number) > 0
          ? (widthValue as number)
          : undefined
      }
      height={
        Number.isFinite(heightValue as number) && (heightValue as number) > 0
          ? (heightValue as number)
          : undefined
      }
      {...options}
    />
  )
}

export function ImageHandler({
  src,
  alt = "",
  width = 0,
  height = 0,
  previewFit = "contain",
  mode = "default",
}: ImageHandlerProps) {
  const hasExplicitSize = width > 0 && height > 0
  const fallbackContainerClass =
    mode === "default"
      ? "relative h-80 w-full max-w-350 md:h-96"
      : "relative h-[70vh] w-350 max-w-full"

  const imageNode = hasExplicitSize ? (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="not-prose h-auto w-auto max-w-full object-contain"
      priority
    />
  ) : (
    // Fallback for markdown images without known dimensions.
    <div className={fallbackContainerClass}>
      <Image
        src={src}
        alt={alt}
        fill
        className="not-prose object-contain"
        sizes="80vw"
        priority
      />
    </div>
  )

  if (mode === "default") {
    return (
      <section className="my-8">
        <div className="flex items-center justify-center">
          <div className="w-full max-w-full [&_img]:h-auto [&_img]:max-w-full">
            {imageNode}
          </div>
        </div>
      </section>
    )
  }

  if (mode === "zoom") {
    return (
      <PanZoomDialog
        title={alt || "Image"}
        className="my-8"
        previewClassName="h-72"
        previewFit={previewFit}
        fitOnMount={true}
        initialZoom={1}
      >
        <div
          className={
            previewFit === "cover"
              ? "inline-block [&_img]:object-cover"
              : "inline-block [&_img]:object-contain"
          }
        >
          {imageNode}
        </div>
      </PanZoomDialog>
    )
  }

  return null
}
