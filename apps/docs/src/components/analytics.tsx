"use client"
import { configure } from "onedollarstats"
import { useEffect } from "react"

export default function Analytics() {
  useEffect(() => {
    configure({ devmode: false, hostname: "vorsteh-queue.dev" })
  }, [])

  return null
}
