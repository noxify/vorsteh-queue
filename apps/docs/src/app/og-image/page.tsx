"use client"

import { screenshot } from "@renoun/screenshot"
import { Space_Grotesk } from "next/font/google"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { VorstehQueueLogo } from "@/components/logo"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

function OGImage() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#181411]">
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, #f97316 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Orange gradient accent - top */}
      <div
        className="absolute -top-32 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full opacity-25 blur-[80px]"
        style={{ background: "linear-gradient(90deg, #f97316, #ea580c)" }}
      />

      {/* Content */}
      <div className="relative flex w-full flex-col items-center text-center">
        <VorstehQueueLogo className="size-32" />
        <div
          className="mt-8 text-[80px] leading-none font-semibold text-[#f1eae3]"
          style={{ fontFamily: spaceGrotesk.style.fontFamily }}
        >
          Vorsteh-Queue
        </div>
        <div className="mt-6 max-w-4xl text-[30px] leading-relaxed text-[#f1eae3]/60">
          A type-safe PostgreSQL job queue for Node.js with durable execution,
          flow orchestration, and first-class ORM adapters.
        </div>
      </div>
    </div>
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
      <h1 className="text-3xl font-bold">OG Image Preview</h1>
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
