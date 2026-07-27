import type { CSSProperties } from "react"

interface OgGridOverlayProps {
  className?: string
  lineColor?: string
  lineOpacity?: number
  cellSize?: number
  centerOpacity?: number
  midOpacity?: number
  edgeOpacity?: number
}

export function OgGridOverlay({
  className,
  lineColor = "107,114,128",
  lineOpacity = 0.14,
  cellSize = 48,
  centerOpacity = 0.9,
  midOpacity = 0.6,
  edgeOpacity = 0,
}: OgGridOverlayProps) {
  const style: CSSProperties = {
    WebkitMaskImage: `radial-gradient(ellipse at center, rgba(0,0,0,${centerOpacity}) 0%, rgba(0,0,0,${midOpacity}) 58%, rgba(0,0,0,${edgeOpacity}) 100%)`,
    backgroundImage: `repeating-linear-gradient(0deg, rgba(${lineColor},${lineOpacity}) 0, rgba(${lineColor},${lineOpacity}) 1px, transparent 1px, transparent ${cellSize}px), repeating-linear-gradient(90deg, rgba(${lineColor},${lineOpacity}) 0, rgba(${lineColor},${lineOpacity}) 1px, transparent 1px, transparent ${cellSize}px)`,
    maskImage: `radial-gradient(ellipse at center, rgba(0,0,0,${centerOpacity}) 0%, rgba(0,0,0,${midOpacity}) 58%, rgba(0,0,0,${edgeOpacity}) 100%)`,
  }

  return (
    <div
      className={className ?? "absolute inset-0"}
      style={style}
      aria-hidden="true"
    />
  )
}
