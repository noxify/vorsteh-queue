"use client"

import { ZoomIn, ZoomOut, Maximize2, Move, X, Expand } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface PanZoomDialogProps {
  children: React.ReactNode
  className?: string
  previewClassName?: string
  previewFit?: "contain" | "cover"
  dialogClassName?: string
  title?: string
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  initialZoom?: number
  fitOnMount?: boolean
}

interface Transform {
  x: number
  y: number
  scale: number
}

export function PanZoomDialog({
  children,
  className,
  previewClassName,
  previewFit = "contain",
  dialogClassName,
  title = "Diagram",
  minZoom = 0.25,
  maxZoom = 4,
  zoomStep = 0.25,
  initialZoom = 1,
  fitOnMount = false,
}: PanZoomDialogProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const previewContainerRef = React.useRef<HTMLDivElement>(null)
  const previewContentRef = React.useRef<HTMLDivElement>(null)

  const [transform, setTransform] = React.useState<Transform>({
    x: 0,
    y: 0,
    scale: initialZoom,
  })

  const [isPanning, setIsPanning] = React.useState(false)
  const [startPan, setStartPan] = React.useState({ x: 0, y: 0 })
  const [previewScale, setPreviewScale] = React.useState(0.45)

  const updatePreviewScale = React.useCallback(() => {
    const container = previewContainerRef.current
    const content = previewContentRef.current

    if (!container || !content) {
      return
    }

    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const contentW = content.scrollWidth
    const contentH = content.scrollHeight

    if (containerW <= 0 || containerH <= 0 || contentW <= 0 || contentH <= 0) {
      return
    }

    const padding = 24
    const scaleX = (containerW - padding) / contentW
    const scaleY = (containerH - padding) / contentH
    const fittedScale =
      previewFit === "cover"
        ? Math.max(scaleX, scaleY)
        : Math.min(scaleX, scaleY, 1)
    const upperBound = previewFit === "cover" ? 6 : 1
    const clampedScale = Math.min(upperBound, Math.max(0.08, fittedScale))

    setPreviewScale(clampedScale)
  }, [previewFit])

  React.useLayoutEffect(() => {
    updatePreviewScale()

    const container = previewContainerRef.current
    const content = previewContentRef.current

    if (!container || !content) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePreviewScale()
    })

    resizeObserver.observe(container)
    resizeObserver.observe(content)

    return () => {
      resizeObserver.disconnect()
    }
  }, [children, updatePreviewScale])

  const centerView = React.useCallback(
    (scale: number) => {
      // Base centering is handled by CSS. x/y are only delta offsets from center.
      setTransform({ x: 0, y: 0, scale })
    },
    [setTransform]
  )

  const fitView = React.useCallback(() => {
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

    const padding = 32
    const scaleX = (containerW - padding) / contentW
    const scaleY = (containerH - padding) / contentH
    const fittedScale = Math.min(scaleX, scaleY, maxZoom)
    const scale = Math.max(minZoom, fittedScale)

    centerView(scale)
  }, [centerView, maxZoom, minZoom])

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

  // Center before paint to avoid a visible top-left flash on first render.
  React.useLayoutEffect(() => {
    if (!open) {
      return
    }

    if (fitOnMount) {
      fitView()
    } else {
      centerView(initialZoom)
    }

    // Re-center once more on the next frame in case late layout changes
    // (e.g. font/SVG sizing) slightly shift the measured content bounds.
    const frameId = requestAnimationFrame(() => {
      if (fitOnMount) {
        fitView()
      } else {
        centerView(initialZoom)
      }
    })

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [centerView, children, fitOnMount, fitView, initialZoom, open])

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

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) {
        return
      }
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

  const handleMouseUp = React.useCallback(() => {
    setIsPanning(false)
  }, [])

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

  const resetView = React.useCallback(() => {
    if (fitOnMount) {
      fitView()
      return
    }
    centerView(1)
  }, [centerView, fitOnMount, fitView])

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
    <>
      {/* Preview Card */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative w-full overflow-hidden rounded-lg border bg-muted/30 text-left transition-all hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {/* Preview Content - scaled down and centered */}
        <div
          ref={previewContainerRef}
          className={cn(
            "pointer-events-none relative overflow-hidden",
            previewClassName
          )}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              ref={previewContentRef}
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "center center",
              }}
            >
              {children}
            </div>
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="bg-background/60 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
          <div className="bg-foreground text-background flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-lg">
            <Expand className="size-4" />
            <span>Click to expand</span>
          </div>
        </div>

        {/* Expand Icon */}
        {/* <div className="bg-background/80 absolute top-2 right-2 rounded-md p-1.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <Expand className="text-muted-foreground size-4" />
        </div> */}
      </button>

      {/* Fullscreen Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "h-[88vh] max-h-[92vh] w-[98vw] max-w-7xl! overflow-hidden p-0",
            dialogClassName
          )}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

          {/* Header */}
          <div className="bg-background/95 absolute top-0 right-0 left-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium">{title}</h2>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Move className="size-3" />
                <span>Drag to pan, scroll to zoom</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="bg-background flex items-center gap-1 rounded-md border px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={zoomOut}
                  disabled={transform.scale <= minZoom}
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
                >
                  <ZoomIn className="size-4" />
                  <span className="sr-only">Zoom in</span>
                </Button>

                <div className="bg-border mx-1 h-4 w-px" />

                <Button variant="ghost" size="icon-sm" onClick={resetView}>
                  <Maximize2 className="size-4" />
                  <span className="sr-only">Reset view</span>
                </Button>
              </div>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Pan/Zoom viewport */}
          <div
            ref={containerRef}
            className={cn(
              "relative h-full w-full overflow-hidden bg-muted/30 pt-14",
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
                <div className="inline-block p-8">{children}</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
