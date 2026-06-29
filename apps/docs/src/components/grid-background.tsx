import React, { useId } from "react"

interface GradientGridBackgroundProps {
  children?: React.ReactNode
  gridSize?: number
  gridColor?: string
  gradientFrom?: string
  gradientVia?: string
  gradientTo?: string
  transparentBackground?: boolean
  fadeStrength?: number // legacy: maps to fadeStartPercent when not provided
  fadeStartPercent?: number // 0 - 100
  fadeMidPercent?: number // 0 - 100
  midOpacity?: number // 0 - 1
  edgeOpacity?: number // 0 - 1
  fadeRadiusXPercent?: number // 0 - 200
  fadeRadiusYPercent?: number // 0 - 200
  className?: string
  style?: React.CSSProperties
}

export const GradientGridBackground: React.FC<GradientGridBackgroundProps> = ({
  children,
  gridSize = 40,
  gridColor = "rgba(255,255,255,0.15)",
  gradientFrom = "#cfd4da",
  gradientVia = "#b8bec7",
  gradientTo = "#aab1bb",
  transparentBackground = false,
  fadeStrength = 40,
  fadeStartPercent,
  fadeMidPercent = 84,
  midOpacity = 0.35,
  edgeOpacity = 0,
  fadeRadiusXPercent = 120,
  fadeRadiusYPercent = 72,
  className,
  style,
}) => {
  const rawId = useId()
  const idPrefix = rawId.replaceAll(":", "")
  const patternId = `${idPrefix}-grid-pattern`
  const maskId = `${idPrefix}-grid-mask`
  const fadeId = `${idPrefix}-grid-fade`

  const maxInnerStop = 99.5
  const clampedFade = Math.max(0, Math.min(maxInnerStop, fadeStrength))
  const clampedStart = Math.max(
    0,
    Math.min(maxInnerStop, fadeStartPercent ?? clampedFade)
  )
  const clampedMid = Math.max(
    clampedStart,
    Math.min(maxInnerStop, fadeMidPercent)
  )
  const clampedMidOpacity = Math.max(0, Math.min(1, midOpacity))
  const clampedEdgeOpacity = Math.max(0, Math.min(1, edgeOpacity))
  const clampedRadiusX = Math.max(0, Math.min(200, fadeRadiusXPercent))
  const clampedRadiusY = Math.max(0, Math.min(200, fadeRadiusYPercent))
  const baseGradient = transparentBackground
    ? "transparent"
    : `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientVia} 50%, ${gradientTo} 100%)`
  const gradientScaleX = clampedRadiusX / 100
  const gradientScaleY = clampedRadiusY / 100

  return (
    <div
      className={className}
      style={{
        background: baseGradient,
        height: "100%",
        overflow: "hidden",
        position: "relative",
        width: "100%",
        ...style,
      }}
    >
      <div
        style={{
          height: "100%",
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
          width: "100%",
        }}
      >
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id={patternId}
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                fill="none"
                stroke={gridColor}
                strokeWidth="1"
              />
            </pattern>
            <radialGradient
              id={fadeId}
              gradientUnits="objectBoundingBox"
              cx="50%"
              cy="50%"
              r="50%"
              gradientTransform={`translate(0.5 0.5) scale(${gradientScaleX} ${gradientScaleY}) translate(-0.5 -0.5)`}
            >
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop
                offset={`${clampedStart}%`}
                stopColor="white"
                stopOpacity="1"
              />
              <stop
                offset={`${clampedMid}%`}
                stopColor="white"
                stopOpacity={clampedMidOpacity}
              />
              <stop
                offset="100%"
                stopColor="white"
                stopOpacity={clampedEdgeOpacity}
              />
            </radialGradient>
            <mask id={maskId} maskUnits="objectBoundingBox">
              <rect width="100%" height="100%" fill={`url(#${fadeId})`} />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${patternId})`}
            mask={`url(#${maskId})`}
          />
        </svg>
      </div>
      <div
        style={{
          height: "100%",
          position: "relative",
          width: "100%",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  )
}
