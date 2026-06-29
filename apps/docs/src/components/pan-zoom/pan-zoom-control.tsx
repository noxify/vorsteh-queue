"use client"

import { ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PanZoomControlProps {
  children: React.ReactNode
  className?: string
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  initialZoom?: number
  showControls?: boolean
  fitOnMount?: boolean
  centerOnMount?: boolean
}

interface Transform {
  x: number
  y: number
  scale: number
}

export function PanZoomControl({
  children,
  className,
  minZoom = 0.25,
  maxZoom = 4,
  zoomStep = 0.25,
  initialZoom = 1,
  showControls = true,
  fitOnMount = false,
  centerOnMount = false,
}: PanZoomControlProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const [transform, setTransform] = React.useState<Transform>({
    x: 0,
    y: 0,
    scale: initialZoom,
  })

  const centerView = React.useCallback(
    (scale: number) => {
      // Base centering is handled by CSS. x/y are only delta offsets from center.
      setTransform({ x: 0, y: 0, scale })
    },
    [setTransform]
  )

  const getViewportPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current

      if (!container) {
        return null
      }

      const rect = container.getBoundingClientRect()
      return {
        x: clientX - rect.left - rect.width / 2,
        y: clientY - rect.top - rect.height / 2,
      }
    },
    []
  )

  // Fit or center content on mount.
  React.useLayoutEffect(() => {
    if (!fitOnMount && !centerOnMount) {
      return
    }
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) {
      return
    }

    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const contentW = content.scrollWidth
    const contentH = content.scrollHeight

    if (contentW === 0 || contentH === 0) {
      return
    }

    if (fitOnMount) {
      const padding = 32
      const scaleX = (containerW - padding) / contentW
      const scaleY = (containerH - padding) / contentH
      const scale = Math.min(scaleX, scaleY, maxZoom)

      centerView(scale)
      return
    }

    centerView(initialZoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOnMount, fitOnMount, initialZoom, maxZoom, centerView])

  const [isPanning, setIsPanning] = React.useState(false)
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 })

  // Handle mouse wheel zoom
  const handleWheel = React.useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      const delta = e.deltaY > 0 ? -zoomStep : zoomStep
      const newScale = Math.min(
        maxZoom,
        Math.max(minZoom, transform.scale + delta)
      )

      if (newScale !== transform.scale) {
        const point = getViewportPoint(e.clientX, e.clientY)

        if (!point) {
          return
        }

        // Zoom toward mouse position
        const scaleFactor = newScale / transform.scale
        const newX = point.x - (point.x - transform.x) * scaleFactor
        const newY = point.y - (point.y - transform.y) * scaleFactor

        setTransform({
          x: newX,
          y: newY,
          scale: newScale,
        })
      }
    },
    [transform, minZoom, maxZoom, zoomStep, getViewportPoint]
  )

  React.useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    container.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheel)
    }
  }, [handleWheel])

  // Handle pan start
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) {
        return
      } // Only left click
      e.preventDefault()

      const point = getViewportPoint(e.clientX, e.clientY)
      if (!point) {
        return
      }

      setIsPanning(true)
      setStartPan({
        x: point.x - transform.x,
        y: point.y - transform.y,
      })
    },
    [transform.x, transform.y, getViewportPoint]
  )

  // Handle pan move
  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) {
        return
      }

      const point = getViewportPoint(e.clientX, e.clientY)
      if (!point) {
        return
      }

      setTransform((prev) => ({
        ...prev,
        x: point.x - startPan.x,
        y: point.y - startPan.y,
      }))
    },
    [isPanning, startPan, getViewportPoint]
  )

  // Handle pan end
  const handleMouseUp = React.useCallback(() => {
    setIsPanning(false)
  }, [])

  // Handle touch events for mobile
  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches.item(0)
        if (!touch) {
          return
        }

        const point = getViewportPoint(touch.clientX, touch.clientY)
        if (!point) {
          return
        }

        setIsPanning(true)
        setStartPan({
          x: point.x - transform.x,
          y: point.y - transform.y,
        })
      }
    },
    [transform.x, transform.y, getViewportPoint]
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isPanning || e.touches.length !== 1) {
        return
      }

      const touch = e.touches.item(0)
      if (!touch) {
        return
      }

      const point = getViewportPoint(touch.clientX, touch.clientY)
      if (!point) {
        return
      }

      setTransform((prev) => ({
        ...prev,
        x: point.x - startPan.x,
        y: point.y - startPan.y,
      }))
    },
    [isPanning, startPan, getViewportPoint]
  )

  const handleTouchEnd = React.useCallback(() => {
    setIsPanning(false)
  }, [])

  // Zoom controls
  const zoomIn = React.useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(maxZoom, prev.scale + zoomStep),
    }))
  }, [maxZoom, zoomStep])

  const zoomOut = React.useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(minZoom, prev.scale - zoomStep),
    }))
  }, [minZoom, zoomStep])

  // Reset to fit content
  const resetView = React.useCallback(() => {
    if (centerOnMount) {
      centerView(1)
      return
    }
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [centerOnMount, centerView])

  // Prevent context menu during pan
  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        e.preventDefault()
      }
    },
    [isPanning]
  )

  const handleViewportKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault()
        zoomIn()
      } else if (e.key === "-") {
        e.preventDefault()
        zoomOut()
      } else if (e.key === "0") {
        e.preventDefault()
        resetView()
      }
    },
    [resetView, zoomIn, zoomOut]
  )

  const zoomPercentage = Math.round(transform.scale * 100)

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border", className)}
    >
      {/* Pan/Zoom viewport */}
      <div
        ref={containerRef}
        className={cn(
          "relative h-full w-full overflow-hidden",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        role="button"
        aria-label="Pan and zoom viewport"
        tabIndex={0}
        onKeyDown={handleViewportKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={contentRef}
            className="w-max origin-center"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            <div className="inline-block">{children}</div>
          </div>
        </div>
      </div>

      {/* Controls overlay */}
      {showControls && (
        <div className="bg-background/95 absolute right-3 bottom-3 flex items-center gap-1 rounded-md border p-1 shadow-sm backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            disabled={transform.scale <= minZoom}
            title="Zoom out"
          >
            <ZoomOut className="size-4" />
            <span className="sr-only">Zoom out</span>
          </Button>

          <span className="text-muted-foreground min-w-14 text-center text-xs font-medium">
            {zoomPercentage}%
          </span>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            disabled={transform.scale >= maxZoom}
            title="Zoom in"
          >
            <ZoomIn className="size-4" />
            <span className="sr-only">Zoom in</span>
          </Button>

          <div className="bg-border mx-1 h-4 w-px" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={resetView}
            title="Reset view"
          >
            <Maximize2 className="size-4" />
            <span className="sr-only">Reset view</span>
          </Button>
        </div>
      )}

      {/* Pan indicator */}
      {showControls && (
        <div className="bg-background/95 text-muted-foreground absolute top-3 left-3 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs shadow-sm backdrop-blur-sm">
          <Move className="size-3" />
          <span>Drag to pan</span>
        </div>
      )}
    </div>
  )
}
