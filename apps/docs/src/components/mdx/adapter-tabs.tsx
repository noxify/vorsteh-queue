import type { ReactElement, ReactNode } from "react"
import { Children, isValidElement } from "react"

import type { Adapter } from "./adapter-tabs-client"
import { AdapterTabsClient } from "./adapter-tabs-client"

interface AdapterTabProps {
  adapter: Adapter
  children: ReactNode
}

/**
 * A single adapter tab panel. Use inside `<AdapterTabs>`.
 *
 * @example
 * ```mdx
 * <AdapterTabs>
 *   <AdapterTab adapter="drizzle">
 *     ```typescript
 *     // Drizzle code
 *     ```
 *   </AdapterTab>
 *   <AdapterTab adapter="prisma">
 *     ```typescript
 *     // Prisma code
 *     ```
 *   </AdapterTab>
 * </AdapterTabs>
 * ```
 */
function AdapterTab({ children }: AdapterTabProps) {
  return children
}

interface AdapterTabsProps {
  children: ReactNode
}

/**
 * Tabbed container for adapter-specific code examples.
 *
 * @example
 * ```mdx
 * <AdapterTabs>
 *   <AdapterTab adapter="drizzle">...</AdapterTab>
 *   <AdapterTab adapter="prisma">...</AdapterTab>
 *   <AdapterTab adapter="typeorm">...</AdapterTab>
 * </AdapterTabs>
 * ```
 */
function AdapterTabs({ children }: AdapterTabsProps) {
  const tabs: { adapter: Adapter; content: ReactNode }[] = []

  // oxlint-disable-next-line react/no-react-children -- needed for dynamic child inspection
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) {
      continue
    }

    const element = child as ReactElement<AdapterTabProps>
    if (element.type === AdapterTab) {
      tabs.push({
        adapter: element.props.adapter,
        content: element.props.children,
      })
    }
  }

  return <AdapterTabsClient tabs={tabs} />
}

export { AdapterTab, AdapterTabs }
