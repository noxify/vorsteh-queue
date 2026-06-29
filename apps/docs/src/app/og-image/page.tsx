"use client"

import { screenshot } from "@renoun/screenshot"
import { Space_Grotesk } from "next/font/google"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { GradientGridBackground } from "@/components/grid-background"
import { VorstehQueueLogo } from "@/components/logo"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

function OGImage() {
  return (
    <GradientGridBackground
      className="h-full w-full"
      gridSize={48}
      gridColor="rgba(107,114,128,0.3)"
      gradientFrom="#f5f7fa"
      gradientVia="#d8dee8"
      gradientTo="#c3cfe2"
      fadeStartPercent={20}
      fadeMidPercent={84}
      midOpacity={0.35}
      edgeOpacity={0}
      fadeRadiusXPercent={100}
      fadeRadiusYPercent={80}
    >
      <div className="absolute inset-0 h-full" />
      <div className="relative flex h-full w-full items-center px-30">
        <div className="w-full">
          <div className="relative flex justify-center">
            <div className="flex items-center gap-6">
              <div
                className="flex size-37.5 shrink-0 items-center justify-center rounded-[28px] bg-white shadow-[0_18px_40px_rgba(2,73,118,0.18)]"
                style={{
                  transform: "translateZ(0)",
                }}
              >
                <VorstehQueueLogo className="size-28" />
              </div>
              <div
                className="text-[98px] leading-none font-medium text-slate-700"
                style={{ fontFamily: spaceGrotesk.style.fontFamily }}
              >
                LakeQL
              </div>
            </div>
          </div>

          <div className="mt-20 flex flex-row">
            <div className="text-[34px] leading-tight text-slate-600">
              Build predictable, secure GraphQL APIs on top of Trino metadata
              with LakeQL’s type-safe runtime and schema generation CLI.
            </div>
          </div>
        </div>
      </div>
    </GradientGridBackground>
  )
}

export default function OGImagePage() {
  const renderRef = useRef<HTMLDivElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    async function generate() {
      if (!renderRef.current) {
        return
      }

      try {
        // Load the browser-only package only on the client after mount.
        const blob = await screenshot.blob(renderRef.current, {
          format: "jpeg",
          quality: 0.92,
          scale: 2,
        })

        if (cancelled) {
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      } catch (error) {
        if (cancelled) {
          return
        }
        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate screenshot"
        setErrorMessage(message)
      }
    }

    void generate()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [])

  return (
    <div className="space-y-6 p-8">
      <div
        ref={renderRef}
        className="h-157.5 w-300 overflow-hidden rounded-2xl"
      >
        <OGImage />
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      {imageUrl ? (
        <Image
          src={imageUrl}
          alt="Generated OG preview"
          width={600}
          height={315}
          className="rounded-xl border"
        />
      ) : (
        <p className="text-muted-foreground text-sm">Generating preview...</p>
      )}
    </div>
  )
}
