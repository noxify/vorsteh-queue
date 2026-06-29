import Link from "next/link"

import type { getSections } from "@/collection-helpers"
import {
  getTitle,
  isExternal,
  isHidden,
  resolveDocEntry,
} from "@/collection-helpers"
import { GradientGridBackground } from "@/components/grid-background"
import { cn } from "@/lib/utils"

interface SectionGridItem {
  title: string
  description?: string
  path: string
}

interface GridElement {
  title: string
  description: string
  path: string
}

type SectionItem = Awaited<ReturnType<typeof getSections>>[number]

type SectionGridProps =
  | {
      sections: Awaited<ReturnType<typeof getSections>>
      items?: never
      className?: string
    }
  | {
      items: readonly SectionGridItem[]
      sections?: never
      className?: string
    }

function isEmptyInput(
  sections: Awaited<ReturnType<typeof getSections>> | undefined,
  inputItems: readonly SectionGridItem[] | undefined
): boolean {
  return (
    (!sections || sections.length === 0) &&
    (!inputItems || inputItems.length === 0)
  )
}

function toElementFromItem(item: SectionGridItem): GridElement {
  return {
    description: item.description ?? "",
    path: item.path,
    title: item.title,
  }
}

function shouldSkipEntry(entry: SectionItem): boolean {
  return isHidden(entry) || isExternal(entry)
}

async function resolveSectionElement(
  section: SectionItem
): Promise<GridElement | null> {
  if (shouldSkipEntry(section)) {
    return null
  }

  try {
    const resolved = await resolveDocEntry(section)

    if (shouldSkipEntry(resolved.entry)) {
      return null
    }

    const frontmatterWithSectionGridFlag = resolved.frontmatter as
      | (typeof resolved.frontmatter & { hideFromSectionGrid?: boolean })
      | undefined

    if (frontmatterWithSectionGridFlag?.hideFromSectionGrid) {
      return null
    }

    return {
      description: resolved.frontmatter?.description ?? "",
      path: `/docs${resolved.entry.getPathname({ includeBasePathname: true })}`,
      title: getTitle(resolved.entry, resolved.frontmatter, true),
    }
  } catch {
    return null
  }
}

export default async function SectionGrid(props: SectionGridProps) {
  const sections = "sections" in props ? props.sections : undefined
  const inputItems = "items" in props ? props.items : undefined

  if (isEmptyInput(sections, inputItems)) {
    return <></>
  }

  const elements: GridElement[] = []

  if (inputItems) {
    for (const item of inputItems) {
      elements.push(toElementFromItem(item))
    }
  } else if (sections) {
    const resolvedElements = await Promise.all(
      sections.map((section) => resolveSectionElement(section))
    )
    const seenPaths = new Set<string>()

    for (const element of resolvedElements) {
      if (!element) {
        continue
      }

      const { path } = element

      if (seenPaths.has(path)) {
        continue
      }

      seenPaths.add(path)
      elements.push(element)
    }
  }

  return (
    <div
      className={cn(
        "mt-12 grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-2",
        props.className
      )}
    >
      {elements.map((ele, index) => (
        <Link
          href={ele.path}
          prefetch={false}
          key={index}
          className="not-prose group block h-full"
        >
          <div className="hover:border-brand/50 hover:dark:border-brand/30 relative h-full overflow-hidden rounded-2xl border border-black/10 shadow transition-transform duration-200 dark:border-white/10">
            <div className="bg-sidebar pointer-events-none absolute inset-0" />

            <GradientGridBackground
              className="relative h-full px-4 py-8"
              gridSize={48}
              gridColor="rgba(107,114,128,0.20)"
              transparentBackground
              fadeStartPercent={20}
              fadeMidPercent={86}
              midOpacity={0.44}
              edgeOpacity={0}
              fadeRadiusXPercent={100}
              fadeRadiusYPercent={80}
            >
              <div className="justify-top relative flex h-full flex-col items-start text-left align-top">
                <h2 className="text-foreground/70 group-hover:text-foreground relative z-50 mt-0 mb-1 text-xl font-bold">
                  {ele.title}
                </h2>

                <p className="text-muted-foreground relative z-50 text-base font-normal">
                  {ele.description}
                </p>
              </div>
            </GradientGridBackground>
          </div>
        </Link>
      ))}
    </div>
  )
}
