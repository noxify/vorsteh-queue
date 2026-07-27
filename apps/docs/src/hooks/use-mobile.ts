import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(breakpoint?: number) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>()

  React.useEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${(breakpoint ?? MOBILE_BREAKPOINT) - 1}px)`
    )
    const onChange = () => {
      setIsMobile(window.innerWidth < (breakpoint ?? MOBILE_BREAKPOINT))
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < (breakpoint ?? MOBILE_BREAKPOINT))
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return !!isMobile
}
