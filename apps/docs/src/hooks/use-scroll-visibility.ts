"use client"

import * as React from "react"

interface UseScrollVisibilityOptions {
  hideAfterScrollY?: number
  scrollDeltaThreshold?: number
  initiallyVisible?: boolean
}

interface ScrollVisibilityState {
  hasScrolled: boolean
  isVisible: boolean
}

const DEFAULT_OPTIONS: Required<UseScrollVisibilityOptions> = {
  hideAfterScrollY: 50,
  initiallyVisible: true,
  scrollDeltaThreshold: 2,
}

export function useScrollVisibility(
  options: UseScrollVisibilityOptions = {}
): ScrollVisibilityState {
  const { hideAfterScrollY, scrollDeltaThreshold, initiallyVisible } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const [state, setState] = React.useState<ScrollVisibilityState>({
    hasScrolled: false,
    isVisible: initiallyVisible,
  })

  const lastScrollY = React.useRef(0)
  const isVisibleRef = React.useRef(initiallyVisible)

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY.current

      let nextIsVisible = isVisibleRef.current

      if (currentScrollY <= hideAfterScrollY) {
        nextIsVisible = true
      } else if (delta > scrollDeltaThreshold) {
        nextIsVisible = false
      } else if (delta < -scrollDeltaThreshold) {
        nextIsVisible = true
      }

      isVisibleRef.current = nextIsVisible
      lastScrollY.current = currentScrollY

      setState((previousState) => {
        const nextState = {
          hasScrolled: currentScrollY > 0,
          isVisible: nextIsVisible,
        }

        if (
          previousState.hasScrolled === nextState.hasScrolled &&
          previousState.isVisible === nextState.isVisible
        ) {
          return previousState
        }

        return nextState
      })
    }

    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [hideAfterScrollY, initiallyVisible, scrollDeltaThreshold])

  return state
}
