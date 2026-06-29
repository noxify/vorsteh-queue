declare global {
  interface Window {
    __TableOfContents__: {
      register: (ids: string[]) => void
    }
  }
}

/**
 * Script to manage active target state in the table of contents.
 * @internal
 */
export default function scrollHandler({
  activationRatio = 0.333,
}: {
  /** A number between `0` and `1` representing which portion of the viewport height from top the target becomes active. */
  activationRatio?: number
}): void {
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  function getLink(id: string): HTMLAnchorElement | null {
    return document.querySelector<HTMLAnchorElement>(
      `:is(ol, ul) a[href="#${id}"]`
    )
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
  const smoothScrollBehavior: ScrollBehavior = prefersReducedMotion
    ? "auto"
    : "smooth"
  const OVERFLOW_REGEX = /(?<overflow>auto|scroll)/u
  const viewportCache = new WeakMap<HTMLElement, HTMLElement>()

  let previousActiveLink: HTMLAnchorElement | null = null
  let previousLastSectionInView = false
  let isScrollingIntoView = false
  let lastScrollY = 0
  let rafId = 0
  let dispose: (() => void) | null = null

  function cancelFrame(): void {
    if (rafId) {
      cancelAnimationFrame(rafId)
    }
    rafId = 0
  }

  function getClosestViewport(node: HTMLElement): HTMLElement {
    const cached = viewportCache.get(node)
    if (cached) {
      return cached
    }

    let current: ParentNode | null = node.parentNode

    while (current) {
      if (current === document.body) {
        return document.body
      }

      if (current instanceof HTMLElement) {
        const { overflow, overflowX, overflowY } = getComputedStyle(current)
        if (OVERFLOW_REGEX.test(overflow + overflowX + overflowY)) {
          viewportCache.set(node, current)
          return current
        }
      }

      current = current.parentNode
    }

    viewportCache.set(node, document.body)
    return document.body
  }

  function setActiveLink(target: HTMLElement): void {
    isScrollingIntoView = true
    target.scrollIntoView({ behavior: smoothScrollBehavior, block: "start" })

    const nextActiveLink = getLink(target.id)
    if (nextActiveLink) {
      nextActiveLink.setAttribute("aria-current", "location")
      history.pushState(null, "", `#${target.id}`)
      if (previousActiveLink && previousActiveLink !== nextActiveLink) {
        previousActiveLink.removeAttribute("aria-current")
      }
      previousActiveLink = nextActiveLink
    }

    if ("onscrollend" in window) {
      window.addEventListener(
        "scrollend",
        () => {
          isScrollingIntoView = false
        },
        { once: true, passive: true }
      )
    } else {
      cancelFrame()
      let still = 0
      const step = (): void => {
        const y = window.scrollY
        if (Math.abs(y - lastScrollY) < 1) {
          still += 1
          if (still > 4) {
            isScrollingIntoView = false
            cancelFrame()
            return
          }
        } else {
          still = 0
        }
        lastScrollY = y
        rafId = requestAnimationFrame(step)
      }
      rafId = requestAnimationFrame(step)
    }
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) {
      return
    }
    const { href } = event.target
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!href?.includes("#")) {
      return
    }
    const id = href.slice(href.indexOf("#") + 1)
    const section = document.querySelector(`#${id}`)
    if (!section) {
      return
    }
    event.preventDefault()
    setActiveLink(section as HTMLElement)
  })

  window.__TableOfContents__ = {
    register: (targetIds: string[]) => {
      dispose?.()

      const targetElements = targetIds
        .map((id) => document.querySelector(`#${id}`))
        .filter(Boolean) as HTMLElement[]
      const linkFor = new Map<HTMLElement, HTMLAnchorElement | null>(
        targetElements.map((target) => [target, getLink(target.id)])
      )
      const lastIndex = targetElements.length - 1
      const lastTarget = targetElements[lastIndex]
      const lastLink = lastTarget ? linkFor.get(lastTarget) : null
      let scrollTimeout: number | null = null
      const scrollDelay = 100

      const scheduleViewportSync = ({
        bestIndex,
        currentLastIndex,
        currentLastLink,
        lastSectionInView,
      }: {
        bestIndex: number
        currentLastIndex: number
        currentLastLink: HTMLAnchorElement | null | undefined
        lastSectionInView: boolean
      }): void => {
        if (lastSectionInView) {
          if (
            !previousLastSectionInView &&
            bestIndex !== currentLastIndex &&
            currentLastLink
          ) {
            if (scrollTimeout) {
              clearTimeout(scrollTimeout)
            }
            scrollTimeout = window.setTimeout(() => {
              const viewport = getClosestViewport(currentLastLink)
              if (viewport !== document.body) {
                viewport.scrollTo({
                  behavior: smoothScrollBehavior,
                  top: viewport.scrollHeight,
                })
              }
            }, scrollDelay)
          }
          return
        }

        if (previousActiveLink) {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout)
          }
          scrollTimeout = window.setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const viewport = getClosestViewport(previousActiveLink!)
            if (viewport !== document.body) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              previousActiveLink!.scrollIntoView({
                behavior: smoothScrollBehavior,
                block: "nearest",
              })
            }
          }, scrollDelay)
        }
      }

      function update(): void {
        if (isScrollingIntoView) {
          return
        }

        const vh = window.innerHeight || document.documentElement.clientHeight
        const vw = window.innerWidth || document.documentElement.clientWidth
        const offsetTop = vh * activationRatio
        let bestIndex = 0
        let bestTop = -Infinity
        let lastSectionInView = false

        for (let index = 0; index < targetElements.length; index += 1) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const rect = targetElements[index]!.getBoundingClientRect()

          if (rect.top <= offsetTop && rect.top > bestTop) {
            bestTop = rect.top
            bestIndex = index
          }

          if (
            index === lastIndex &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < vh &&
            rect.left < vw
          ) {
            lastSectionInView = true
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const targetElement = targetElements[bestIndex]!

        const nextActiveLink = linkFor.get(targetElement) ?? null

        if (nextActiveLink !== previousActiveLink) {
          if (previousActiveLink) {
            previousActiveLink.removeAttribute("aria-current")
          }
          if (nextActiveLink) {
            nextActiveLink.setAttribute("aria-current", "location")
          }
          previousActiveLink = nextActiveLink
        }

        scheduleViewportSync({
          bestIndex,
          currentLastIndex: lastIndex,
          currentLastLink: lastLink,
          lastSectionInView,
        })

        previousLastSectionInView = lastSectionInView
      }

      const intersectionObserver = new IntersectionObserver(update, {
        root: null,
        rootMargin: `-${activationRatio * 100}% 0px 0px 0px`,
        threshold: [0, 1],
      })

      for (const target of targetElements) {
        intersectionObserver.observe(target)
      }

      update()

      dispose = () => {
        intersectionObserver.disconnect()
        cancelFrame()
        isScrollingIntoView = false
        previousLastSectionInView = false
        if (previousActiveLink) {
          previousActiveLink.removeAttribute("aria-current")
          previousActiveLink = null
        }
      }
    },
  }
}
