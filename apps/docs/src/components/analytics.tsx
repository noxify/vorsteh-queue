"use client"
import { configure } from "onedollarstats"
import { useEffect } from "react"

export default function Analytics() {
  useEffect(() => {
    configure({ hostname: "vorsteh-queue.dev", devmode: false })
  }, [])

  return null
}
