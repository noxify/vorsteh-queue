import type { ReactElement, ReactNode } from "react"
import { Children, isValidElement } from "react"

import type { Adapter } from "./adapter-tabs-client"
import { AdapterTabsClient } from "./adapter-tabs-client"

interface AdapterTabProps {
  children: ReactNode
}

function Drizzle({ children }: AdapterTabProps) {
  return children
}

function Prisma({ children }: AdapterTabProps) {
  return children
}

function Kysely({ children }: AdapterTabProps) {
  return children
}

const ADAPTER_MAP = new Map<unknown, Adapter>([
  [Drizzle, "drizzle"],
  [Prisma, "prisma"],
  [Kysely, "kysely"],
])

interface AdapterTabsProps {
  children: ReactNode
}

function AdapterTabs({ children }: AdapterTabsProps) {
  const tabs: { adapter: Adapter; content: ReactNode }[] = []

  // oxlint-disable-next-line react/no-react-children -- needed for dynamic child inspection
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) {
      continue
    }

    const adapter = ADAPTER_MAP.get(
      (child as ReactElement<AdapterTabProps>).type
    )
    if (adapter) {
      tabs.push({
        adapter,
        content: (child as ReactElement<AdapterTabProps>).props.children,
      })
    }
  }

  return <AdapterTabsClient tabs={tabs} />
}

AdapterTabs.Drizzle = Drizzle
AdapterTabs.Prisma = Prisma
AdapterTabs.Kysely = Kysely

export { AdapterTabs }
