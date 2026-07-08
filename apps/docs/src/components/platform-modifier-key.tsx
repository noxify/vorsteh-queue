"use client"

import { useSyncExternalStore } from "react"

const emptySubscribe = (_onStoreChange: () => void) => () => {
  /* empty */
}

function isApplePlatform() {
  const navigatorWithUAData = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }

  const uaDataPlatform =
    navigatorWithUAData.userAgentData?.platform?.toLowerCase() ?? ""
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  // Prefer explicit Windows signals from emulation/UA override.
  if (uaDataPlatform.includes("windows") || userAgent.includes("windows")) {
    return false
  }

  if (
    uaDataPlatform.includes("mac") ||
    uaDataPlatform.includes("ios") ||
    /macintosh|mac os x|iphone|ipad|ipod/iu.test(userAgent)
  ) {
    return true
  }

  return /mac|iphone|ipad|ipod/iu.test(platform)
}

export default function PlatformModifierKey() {
  const isMac = useSyncExternalStore(
    emptySubscribe,
    isApplePlatform,
    () => false
  )

  return isMac ? "\u2318" : "CTRL + "
}
