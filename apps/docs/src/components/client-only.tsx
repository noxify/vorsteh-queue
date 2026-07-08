"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"

/** React hook that returns true if the component has mounted client-side */
/* oxlint-disable react-doctor/no-initialize-state, react-doctor/rendering-hydration-no-flicker -- client-only detection requires this pattern */
export const useClientOnly = () => {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true)
  }, [])

  return hasMounted
}
/* oxlint-enable react-doctor/no-initialize-state, react-doctor/rendering-hydration-no-flicker */

export const ClientOnly = ({ children }: { children: ReactNode }) => {
  const hasMounted = useClientOnly()

  if (!hasMounted) {
    return null
  }

  return children
}
