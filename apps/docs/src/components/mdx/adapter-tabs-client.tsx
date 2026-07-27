"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"

export type Adapter =
  | "drizzle"
  | "prisma"
  | "kysely"
  | "zenstack"
  | "typeorm"
  | "mikroorm"
  | "sequelize"

declare global {
  interface Window {
    setAdapter?: (adapter: Adapter | null) => void
  }
}

const ADAPTERS = new Set<Adapter>([
  "drizzle",
  "prisma",
  "kysely",
  "zenstack",
  "typeorm",
  "mikroorm",
  "sequelize",
])

const ADAPTER_LABELS: Record<Adapter, string> = {
  drizzle: "Drizzle",
  kysely: "Kysely",
  mikroorm: "MikroORM",
  prisma: "Prisma",
  sequelize: "Sequelize",
  typeorm: "TypeORM",
  zenstack: "ZenStack",
}

const STORAGE_KEY = "vorsteh-queue:selected-adapter"
const SYNC_EVENT = "vorsteh-queue:adapter-change"

function isAdapter(value: string): value is Adapter {
  return ADAPTERS.has(value as Adapter)
}

interface AdapterTabsClientProps {
  tabs: { adapter: Adapter; content: ReactNode }[]
  defaultAdapter?: Adapter
}

function getStoredAdapter(): Adapter | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && isAdapter(stored)) {
      return stored
    }
  } catch {
    return null
  }

  return null
}

function persistAdapter(value: Adapter) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Ignore storage access errors.
  }
}

function resolveAdapter(
  adapter: Adapter | null,
  defaultAdapter: Adapter,
  available: Adapter[]
): Adapter {
  const stored = getStoredAdapter()
  const candidate = adapter ?? stored
  if (candidate && isAdapter(candidate) && available.includes(candidate)) {
    return candidate
  }
  return available.includes(defaultAdapter)
    ? defaultAdapter
    : (available[0] ?? defaultAdapter)
}

function onValueChange(value: string) {
  if (!isAdapter(value)) {
    return
  }

  window.setAdapter?.(value)
}

export function AdapterTabsClient({
  tabs,
  defaultAdapter = "drizzle",
}: AdapterTabsClientProps) {
  const [selected, setSelected] = useState<Adapter>(defaultAdapter)

  const availableAdapters = tabs.map((t) => t.adapter)

  // oxlint-disable-next-line react-doctor/no-cascading-set-state -- batched by React 18+
  useEffect(() => {
    const setAdapter = (adapter: Adapter | null) => {
      const resolved = resolveAdapter(
        adapter,
        defaultAdapter,
        availableAdapters
      )
      persistAdapter(resolved)
      setSelected(resolved)
      window.dispatchEvent(
        new CustomEvent<Adapter>(SYNC_EVENT, { detail: resolved })
      )
    }

    window.setAdapter = setAdapter

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY &&
        event.newValue &&
        isAdapter(event.newValue)
      ) {
        setSelected(event.newValue)
      }
    }

    const onSync = (event: Event) => {
      const adapter = (event as CustomEvent<Adapter>).detail
      if (adapter && isAdapter(adapter)) {
        setSelected(adapter)
      }
    }

    window.setAdapter(null)

    window.addEventListener("storage", onStorage)
    window.addEventListener(SYNC_EVENT, onSync)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(SYNC_EVENT, onSync)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- availableAdapters derived from stable tabs prop
  }, [defaultAdapter])

  return (
    <Tabs value={selected} onValueChange={onValueChange}>
      <TabsList variant="line" className="custom-tabs-list">
        {availableAdapters.map((adapter) => (
          <TabsTrigger key={adapter} value={adapter}>
            {ADAPTER_LABELS[adapter]}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map(({ adapter, content }) => (
        <TabsContent key={adapter} value={adapter}>
          {content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
