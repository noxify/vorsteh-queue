"use client"

import type { ReactNode } from "react"
import { createElement, Fragment, useEffect, useState } from "react"

export const ClientOnly = ({ children }: { children: ReactNode }) => {
  const hasMounted = useClientOnly()

  if (!hasMounted) {
    return null
  }

  return createElement(Fragment, { children })
}

/** React hook that returns true if the component has mounted client-side */
export const useClientOnly = () => {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  return hasMounted
}
