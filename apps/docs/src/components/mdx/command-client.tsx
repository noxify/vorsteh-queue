"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

export type PackageManager = "npm" | "pnpm"

declare global {
  interface Window {
    setPackageManager?: (packageManager: PackageManager | null) => void
  }
}

const PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm"]
const STORAGE_KEY = "vorsteh-queue:selected-package-manager"
const LEGACY_STORAGE_KEY = "package-manager"
const SYNC_EVENT = "vorsteh-queue:command-package-manager-change"

function isPackageManager(value: string): value is PackageManager {
  return PACKAGE_MANAGERS.includes(value as PackageManager)
}

interface CommandTabsClientProps {
  commands: { packageManager: PackageManager; content: ReactNode }[]
  defaultPackageManager?: PackageManager
}

function getStoredPackageManager(): PackageManager | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && isPackageManager(stored)) {
      return stored
    }

    const legacyStored = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyStored && isPackageManager(legacyStored)) {
      return legacyStored
    }
  } catch {
    return null
  }

  return null
}

function persistPackageManager(value: PackageManager) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
    // Keep legacy key in sync for compatibility with existing renoun state.
    window.localStorage.setItem(LEGACY_STORAGE_KEY, value)
  } catch {
    // Ignore storage access errors.
  }
}

function resolvePackageManager(
  packageManager: PackageManager | null,
  defaultPackageManager: PackageManager
): PackageManager {
  const stored = getStoredPackageManager()
  const candidate = packageManager ?? stored
  return candidate && isPackageManager(candidate)
    ? candidate
    : defaultPackageManager
}

export function CommandTabsClient({
  commands,
  defaultPackageManager = "npm",
}: CommandTabsClientProps) {
  const [selected, setSelected] = useState<PackageManager>(
    defaultPackageManager
  )

  useEffect(() => {
    const setPackageManager = (packageManager: PackageManager | null) => {
      const resolved = resolvePackageManager(
        packageManager,
        defaultPackageManager
      )
      persistPackageManager(resolved)
      setSelected(resolved)
      window.dispatchEvent(
        new CustomEvent<PackageManager>(SYNC_EVENT, { detail: resolved })
      )
    }

    window.setPackageManager = setPackageManager

    const onStorage = (event: StorageEvent) => {
      if (
        event.newValue &&
        isPackageManager(event.newValue) &&
        (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY)
      ) {
        setSelected(event.newValue)
      }
    }

    const onSync = (event: Event) => {
      const manager = (event as CustomEvent<PackageManager>).detail
      if (manager && isPackageManager(manager)) {
        setSelected(manager)
      }
    }

    window.setPackageManager(null)

    window.addEventListener("storage", onStorage)
    window.addEventListener(SYNC_EVENT, onSync)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(SYNC_EVENT, onSync)
    }
  }, [defaultPackageManager])

  const onValueChange = (value: string) => {
    if (!isPackageManager(value)) {
      return
    }

    window.setPackageManager?.(value)
  }

  return (
    <Tabs value={selected} onValueChange={onValueChange}>
      <TabsList variant="line" className="custom-tabs-list">
        {PACKAGE_MANAGERS.map((packageManager) => (
          <TabsTrigger key={packageManager} value={packageManager}>
            {packageManager}
          </TabsTrigger>
        ))}
      </TabsList>

      {commands.map(({ packageManager, content }) => (
        <TabsContent key={packageManager} value={packageManager}>
          {content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
