"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"

/** React hook that returns true if the component has mounted client-side */
export const useClientOnly = () => {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true)
  }, [])

  return hasMounted
}

export const ClientOnly = ({ children }: { children: ReactNode }) => {
  const hasMounted = useClientOnly()

  if (!hasMounted) {
    return null
  }

  return <>{children}</>
}
