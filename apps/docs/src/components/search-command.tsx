"use client"

import { Autocomplete } from "@base-ui/react/autocomplete"
import { search as oramaSearch } from "@orama/orama"
import { restore } from "@orama/plugin-data-persistence"
import { FileIcon, HashIcon, Search, TextIcon } from "lucide-react"
import { addBasePath } from "next/dist/client/add-base-path"
import { useRouter } from "next/navigation"
import * as React from "react"

import { normalizeInternalHref } from "@/lib/normalize-internal-href"

import { Dialog, DialogContent } from "./ui/dialog"
import { ScrollArea } from "./ui/scroll-area"

export interface SearchCommandItem {
  value: string
  label: string
  href?: string
  group?: string
  hint?: string
  description?: string
  documentType?: "page" | "heading" | "text"
  pageId?: string
  pageTitle?: string
  pageHint?: string
  pageHref?: string
  resultOrder?: number
  collection?: string
  onSelect?: () => void
}

interface SearchCommandGroup {
  key: string
  value: string
  subtitle?: string
  items: SearchCommandItem[]
}

interface SearchCommandProps {
  children: React.ReactNode
}

interface SearchCommandProviderProps {
  children: React.ReactNode
  items?: SearchCommandItem[]
  availableCollections?: SearchCollectionOption[]
  placeholder?: string
  emptyMessage?: string
  enableKeyboardShortcut?: boolean
}

interface SearchCollectionOption {
  value: string
  label: string
}

interface SearchCommandContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

interface OramaSearchDocument {
  id: string
  page_id: string
  type: "page" | "heading" | "text"
  title: string
  section: string
  heading: string
  content: string
  url: string
  breadcrumb: string
}

interface OramaSearchHit {
  score?: number
  document?: Partial<OramaSearchDocument>
}

interface OramaSearchResult {
  hits?: unknown
}

type RestoredSearchIndex = Awaited<ReturnType<typeof restore>>

const defaultItems: SearchCommandItem[] = [
  // {
  //   value: "docs-home",
  //   label: "Documentation",
  //   href: "/docs",
  //   group: "Navigate",
  // },
  // {
  //   value: "toggle-sidebar",
  //   label: "Toggle Sidebar",
  //   group: "Actions",
  //   hint: "Cmd/Ctrl + B",
  //   onSelect: () => {
  //     window.dispatchEvent(
  //       new KeyboardEvent("keydown", { key: "b", metaKey: true })
  //     )
  //     window.dispatchEvent(
  //       new KeyboardEvent("keydown", { key: "b", ctrlKey: true })
  //     )
  //   },
  // },
  // {
  //   value: "toggle-theme",
  //   label: "Toggle Theme",
  //   group: "Actions",
  //   hint: "D",
  //   onSelect: () => {
  //     window.dispatchEvent(
  //       new KeyboardEvent("keydown", { key: "d", metaKey: false })
  //     )
  //     window.dispatchEvent(
  //       new KeyboardEvent("keydown", { key: "d", ctrlKey: false })
  //     )
  //   },
  // },
]

function typeOrder(type?: SearchCommandItem["documentType"]): number {
  if (type === "page") {
    return 0
  }

  if (type === "heading") {
    return 1
  }

  if (type === "text") {
    return 2
  }

  return 3
}

function groupItems(items: SearchCommandItem[]): SearchCommandGroup[] {
  const documentationItems = items.filter(
    (item) => item.group === "Documentation" && item.pageId
  )
  const otherItems = items.filter(
    (item) => !(item.group === "Documentation" && item.pageId)
  )

  const pageGroupsMap = new Map<string, SearchCommandItem[]>()
  for (const item of documentationItems) {
    const { pageId } = item
    if (!pageId) {
      continue
    }

    const existing = pageGroupsMap.get(pageId) ?? []
    existing.push(item)
    pageGroupsMap.set(pageId, existing)
  }

  const pageGroups = [...pageGroupsMap.entries()].map(([pageId, pageItems]) => {
    const pageTitle = pageItems[0]?.pageTitle ?? pageItems[0]?.label ?? pageId
    const pageHint = pageItems[0]?.pageHint
    const pageHref = pageItems[0]?.pageHref

    const hasExplicitPageItem = pageItems.some(
      (item) => item.documentType === "page"
    )

    const enrichedItems = hasExplicitPageItem
      ? pageItems
      : [
          {
            value: `doc-page-${pageId}`,
            label: pageTitle,
            href: pageHref,
            group: "Documentation",
            hint: pageHint,
            documentType: "page" as const,
            pageId,
            pageTitle,
            pageHint,
            pageHref,
            resultOrder: Number.NEGATIVE_INFINITY,
          },
          ...pageItems,
        ]

    enrichedItems.sort((a, b) => {
      const typeDelta = typeOrder(a.documentType) - typeOrder(b.documentType)
      if (typeDelta !== 0) {
        return typeDelta
      }

      return (
        (a.resultOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.resultOrder ?? Number.MAX_SAFE_INTEGER)
      )
    })

    return {
      key: `page-${pageId}`,
      value: pageTitle,
      subtitle: pageHint,
      items: enrichedItems,
    }
  })

  pageGroups.sort((a, b) => {
    const aOrder = Math.min(
      ...a.items.map((item) => item.resultOrder ?? Number.MAX_SAFE_INTEGER)
    )
    const bOrder = Math.min(
      ...b.items.map((item) => item.resultOrder ?? Number.MAX_SAFE_INTEGER)
    )

    return aOrder - bOrder
  })

  const groupedOther = new Map<string, SearchCommandItem[]>()
  for (const item of otherItems) {
    const groupName = item.group ?? "Results"
    const existing = groupedOther.get(groupName) ?? []
    existing.push(item)
    groupedOther.set(groupName, existing)
  }

  const otherGroups = [...groupedOther.entries()].map(
    ([value, groupedItems]) => ({
      key: `group-${value}`,
      value,
      items: groupedItems,
    })
  )

  return [...pageGroups, ...otherGroups]
}

function normalizeHref(pathname: string): string {
  return normalizeInternalHref(
    pathname.startsWith("/") ? pathname : `/${pathname}`
  )
}

function normalizeCollection(value: string): string {
  return value.trim().toLowerCase()
}

function getCollectionFromHref(href?: string): string | undefined {
  if (!href) {
    return undefined
  }

  const match = href.match(/^\/docs\/(?<collection>[^/]+)/u)
  if (!match?.groups?.collection) {
    return undefined
  }

  return normalizeCollection(match.groups.collection)
}

function matchesCollection(
  item: SearchCommandItem,
  selectedCollection: string
) {
  if (selectedCollection === "all") {
    return true
  }

  const itemCollection = item.collection ?? getCollectionFromHref(item.href)
  return itemCollection === selectedCollection
}

function filterItemsByCollection(
  items: SearchCommandItem[],
  selectedCollection: string
) {
  return items.filter((item) => matchesCollection(item, selectedCollection))
}

function formatHint(
  document: Partial<OramaSearchDocument>
): string | undefined {
  const parentBreadcrumb =
    typeof document.breadcrumb === "string"
      ? document.breadcrumb.split(" > ").slice(0, -1).join(" > ")
      : undefined

  if (parentBreadcrumb && parentBreadcrumb.length > 0) {
    return parentBreadcrumb
  }

  return typeof document.section === "string" && document.section.length > 0
    ? document.section
    : undefined
}

function stripMarkdown(content: string): string {
  return content
    .replaceAll(/`(?<code>[^`]*)`/gu, "$<code>")
    .replaceAll(/[#>*_~-]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
}

function toSnippet(content: string, maxLength = 120): string {
  const cleaned = stripMarkdown(content)
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return `${cleaned.slice(0, maxLength).trimEnd()}...`
}

function filterCommandItems(
  items: SearchCommandItem[],
  query: string,
  contains: (item: string, query: string) => boolean,
  selectedCollection: string
) {
  const collectionFiltered = filterItemsByCollection(items, selectedCollection)

  if (query.length === 0) {
    return collectionFiltered
  }

  return collectionFiltered.filter((item) => {
    if (contains(item.label, query)) {
      return true
    }

    if (item.hint && contains(item.hint, query)) {
      return true
    }

    if (item.group && contains(item.group, query)) {
      return true
    }

    return false
  })
}

function orderHitsByScore(hits: OramaSearchHit[]): OramaSearchHit[] {
  const ordered: OramaSearchHit[] = []

  for (const hit of hits) {
    const score = hit.score ?? 0
    const insertAt = ordered.findIndex(
      (current) => (current.score ?? 0) < score
    )

    if (insertAt === -1) {
      ordered.push(hit)
    } else {
      ordered.splice(insertAt, 0, hit)
    }
  }

  return ordered
}

const SearchCommandContext =
  React.createContext<SearchCommandContextValue | null>(null)

function useSearchCommand() {
  const context = React.useContext(SearchCommandContext)

  if (!context) {
    throw new Error(
      "useSearchCommand must be used inside SearchCommandProvider"
    )
  }

  return {
    closeSearch: () => context.setOpen(false),
    open: context.open,
    openSearch: () => context.setOpen(true),
    setOpen: context.setOpen,
    toggleSearch: () => context.setOpen((currentOpen) => !currentOpen),
  }
}

export function SearchCommandProvider({
  children,
  items = defaultItems,
  // oxlint-disable-next-line react/no-object-type-as-default-prop
  availableCollections = [],
  placeholder = "Search...",
  emptyMessage = "Nothing found with this search params.",
  enableKeyboardShortcut = true,
}: SearchCommandProviderProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [selectedCollection, setSelectedCollection] = React.useState("all")
  const [searchResults, setSearchResults] =
    React.useState<SearchCommandItem[]>(items)
  const [error, setError] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()
  const groupedItems = React.useMemo(
    () => groupItems(searchResults),
    [searchResults]
  )
  const { contains } = Autocomplete.useFilter()
  const indexRef = React.useRef<RestoredSearchIndex | null>(null)
  const indexRequestRef = React.useRef<Promise<RestoredSearchIndex> | null>(
    null
  )
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const router = useRouter()

  const collectionOptions = React.useMemo(() => {
    const optionMap = new Map<string, string>()

    for (const collection of availableCollections) {
      const value = normalizeCollection(collection.value)
      const label = collection.label.trim()
      if (value.length > 0) {
        optionMap.set(value, label.length > 0 ? label : value)
      }
    }

    for (const item of [...items, ...searchResults]) {
      const collection = item.collection ?? getCollectionFromHref(item.href)
      if (!collection) {
        continue
      }
      const normalized = normalizeCollection(collection)
      if (!optionMap.has(normalized)) {
        optionMap.set(normalized, normalized)
      }
    }

    if (selectedCollection !== "all" && !optionMap.has(selectedCollection)) {
      optionMap.set(selectedCollection, selectedCollection)
    }

    const collator = new Intl.Collator("de", {
      numeric: true,
      sensitivity: "base",
    })

    const sorted = [...optionMap.entries()]
      .toSorted(([, aLabel], [, bLabel]) => collator.compare(aLabel, bLabel))
      .map(([value, label]) => ({ value, label }))

    return [{ value: "all", label: "All" }, ...sorted]
  }, [availableCollections, items, searchResults, selectedCollection])

  React.useEffect(() => {
    if (searchValue.length > 0) {
      return
    }

    setSearchResults(filterItemsByCollection(items, selectedCollection))
  }, [items, searchValue, selectedCollection])

  const loadSearchIndex = React.useCallback(async () => {
    if (indexRef.current) {
      return indexRef.current
    }

    if (!indexRequestRef.current) {
      indexRequestRef.current = (async () => {
        const response = await fetch(addBasePath("/search-index.json"))
        if (!response.ok) {
          throw new Error(`Failed to load search index (${response.status})`)
        }

        const snapshot = await response.text()
        const restored = await restore("json", snapshot)
        indexRef.current = restored
        return restored
      })()
    }

    try {
      return await indexRequestRef.current
    } catch (restoreError) {
      indexRequestRef.current = null
      throw restoreError
    }
  }, [])

  const runSearch = React.useCallback(
    async (query: string, collection: string) => {
      const index = await loadSearchIndex()

      const [pageResult, headingResult, textResult] = await Promise.all([
        oramaSearch(index, {
          distinctOn: "url",
          limit: 10,
          properties: ["title", "content"],
          term: query,
          where: {
            type: {
              eq: "page",
            },
          },
        }) as Promise<OramaSearchResult>,
        oramaSearch(index, {
          distinctOn: "url",
          limit: 10,
          properties: ["heading", "content"],
          term: query,
          where: {
            type: {
              eq: "heading",
            },
          },
        }) as Promise<OramaSearchResult>,
        oramaSearch(index, {
          distinctOn: "url",
          limit: 10,
          properties: ["content", "heading"],
          term: query,
          where: {
            type: {
              eq: "text",
            },
          },
        }) as Promise<OramaSearchResult>,
      ])

      const hits = orderHitsByScore([
        ...(Array.isArray(pageResult.hits)
          ? (pageResult.hits as OramaSearchHit[])
          : []),
        ...(Array.isArray(headingResult.hits)
          ? (headingResult.hits as OramaSearchHit[])
          : []),
        ...(Array.isArray(textResult.hits)
          ? (textResult.hits as OramaSearchHit[])
          : []),
      ])

      return hits
        .map((hit, indexPosition): SearchCommandItem | null => {
          const { document } = hit
          if (!document || typeof document.title !== "string") {
            return null
          }

          if (
            document.type !== "page" &&
            document.type !== "heading" &&
            document.type !== "text"
          ) {
            return null
          }

          const href =
            typeof document.url === "string"
              ? normalizeHref(document.url)
              : undefined

          const label =
            document.type === "heading" || document.type === "text"
              ? document.heading || document.title
              : document.title

          const description =
            document.type === "text" && typeof document.content === "string"
              ? toSnippet(document.content)
              : undefined

          return {
            value: `doc-${document.id ?? indexPosition}`,
            label: label ?? "",
            href,
            group: "Documentation",
            hint: formatHint(document),
            description,
            documentType: document.type,
            pageId:
              typeof document.page_id === "string"
                ? document.page_id
                : undefined,
            pageTitle: document.title,
            pageHint: formatHint(document),
            pageHref:
              typeof document.page_id === "string"
                ? normalizeHref(document.page_id)
                : href,
            resultOrder: indexPosition,
            collection:
              getCollectionFromHref(href) ??
              (typeof document.section === "string"
                ? normalizeCollection(document.section)
                : undefined),
          }
        })
        .filter((item): item is SearchCommandItem => item !== null)
        .filter((item) => matchesCollection(item, collection))
    },
    [loadSearchIndex]
  )

  const performSearch = React.useCallback(
    (nextSearchValue: string, nextCollection: string) => {
      const controller = new AbortController()
      abortControllerRef.current?.abort()
      abortControllerRef.current = controller

      if (nextSearchValue.length === 0) {
        setError(null)
        setSearchResults(filterItemsByCollection(items, nextCollection))
        return
      }

      startTransition(async () => {
        setError(null)

        try {
          const [documentationMatches, commandMatches] = await Promise.all([
            runSearch(nextSearchValue, nextCollection),
            Promise.resolve(
              filterCommandItems(
                items,
                nextSearchValue,
                contains,
                nextCollection
              )
            ),
          ])

          if (controller.signal.aborted) {
            return
          }

          const deduped = new Map<string, SearchCommandItem>()
          for (const item of [...documentationMatches, ...commandMatches]) {
            const key = item.href ?? item.value
            if (!deduped.has(key)) {
              deduped.set(key, item)
            }
          }

          setSearchResults([...deduped.values()])
        } catch (searchError) {
          if (controller.signal.aborted) {
            return
          }

          // oxlint-disable-next-line no-console
          console.error("Search error:", searchError)
          setError("Search index could not be loaded.")
          setSearchResults(
            filterCommandItems(items, nextSearchValue, contains, nextCollection)
          )
        }
      })
    },
    [contains, items, runSearch, startTransition]
  )

  function getStatus(): React.ReactNode | null {
    if (isPending) {
      return "Searching..."
    }

    if (error) {
      return error
    }

    if (searchValue.length === 0) {
      return null
    }

    return `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`
  }

  const status = getStatus()

  React.useEffect(() => {
    if (!enableKeyboardShortcut) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((currentOpen) => !currentOpen)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [enableKeyboardShortcut])

  function handleItemSelect(item: SearchCommandItem) {
    setOpen(false)
    item.onSelect?.()

    if (item.href) {
      router.push(item.href)
    }
  }

  return (
    <SearchCommandContext.Provider value={{ open, setOpen }}>
      {children}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gap-0 p-0 sm:max-w-xl"
          showCloseButton={false}
        >
          <Autocomplete.Root
            open
            inline
            items={groupedItems}
            value={searchValue}
            onValueChange={(nextSearchValue) => {
              setSearchValue(nextSearchValue)
              performSearch(nextSearchValue, selectedCollection)
            }}
            itemToStringValue={(item) =>
              `${item.label} ${item.hint ?? ""}`.trim()
            }
            filter={null}
            autoHighlight="always"
            keepHighlight
          >
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="text-muted-foreground size-4" />
              <Autocomplete.Input
                className="placeholder:text-muted-foreground w-full bg-transparent py-1 text-sm outline-none"
                placeholder={placeholder}
              />
            </div>

            <ScrollArea className="max-h-[min(60dvh,24rem)]">
              <Autocomplete.Status>
                {status ? (
                  <div className="text-muted-foreground border-b px-4 py-2 text-xs">
                    {status}
                  </div>
                ) : null}
              </Autocomplete.Status>
              {searchValue.length > 0 &&
              searchResults.length === 0 &&
              !isPending ? (
                <Autocomplete.Empty>
                  <div className="text-muted-foreground flex min-h-24 items-center justify-center px-4 py-6 text-sm">
                    {emptyMessage}
                  </div>
                </Autocomplete.Empty>
              ) : null}

              {!searchValue && (
                <Autocomplete.Empty>
                  <div className="text-muted-foreground flex min-h-24 items-center justify-center px-4 py-6 text-sm">
                    To get started, enter a search term.
                  </div>
                </Autocomplete.Empty>
              )}

              <Autocomplete.List className="p-2">
                {(group: SearchCommandGroup) => (
                  <Autocomplete.Group
                    key={group.key}
                    items={group.items}
                    className="not-last:mb-2"
                  >
                    <Autocomplete.GroupLabel className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
                      {group.subtitle ? (
                        <span className="text-muted-foreground/80 normal-case">
                          {group.subtitle}
                        </span>
                      ) : (
                        group.value
                      )}
                    </Autocomplete.GroupLabel>
                    <Autocomplete.Collection>
                      {(item: SearchCommandItem) => (
                        <Autocomplete.Item
                          key={item.value}
                          value={item}
                          onClick={() => handleItemSelect(item)}
                          className={`data-highlighted:bg-muted grid min-h-8 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none ${item.documentType && item.documentType !== "page" ? "border-border/70 ml-5 border-l pl-3" : ""}`}
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            {item.documentType === "page" ? (
                              <FileIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                            ) : null}
                            {item.documentType === "heading" ? (
                              <HashIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                            ) : null}
                            {item.documentType === "text" ? (
                              <TextIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                            ) : null}

                            <div className="min-w-0">
                              <div className="truncate">{item.label}</div>
                              {item.description ? (
                                <div className="text-muted-foreground line-clamp-1 text-xs">
                                  {item.description}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                )}
              </Autocomplete.List>
            </ScrollArea>

            <div className="bg-muted/40 flex items-center justify-between border-t px-3 py-2 text-xs">
              <div className="text-muted-foreground flex items-center gap-2">
                <span>Filter</span>

                <select
                  value={selectedCollection}
                  onChange={(event) => {
                    const nextCollection = event.target.value
                    setSelectedCollection(nextCollection)
                    performSearch(searchValue, nextCollection)
                  }}
                  className="border-border bg-background text-muted-foreground h-6 rounded-md border px-2 text-xs outline-none"
                  aria-label="Filter collection"
                >
                  {collectionOptions.map((collectionOption) => (
                    <option
                      key={collectionOption.value}
                      value={collectionOption.value}
                    >
                      {collectionOption.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Autocomplete.Root>
        </DialogContent>
      </Dialog>
    </SearchCommandContext.Provider>
  )
}

export function SearchCommand({ children }: SearchCommandProps) {
  const { open, setOpen } = useSearchCommand()

  const childArray = React.Children.toArray(children)
  const onlyChild = childArray.length === 1 ? childArray[0] : null

  if (!onlyChild || !React.isValidElement(onlyChild)) {
    return null
  }

  const triggerChild = onlyChild as React.ReactElement<{
    onClick?: (event: React.MouseEvent<HTMLElement>) => void
    "aria-expanded"?: boolean
    "aria-haspopup"?: "dialog"
  }>

  const childOnClick = triggerChild.props.onClick

  return React.cloneElement(triggerChild, {
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      childOnClick?.(event)

      if (!event.defaultPrevented) {
        setOpen(true)
      }
    },
  })
}
