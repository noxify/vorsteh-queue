import { cache } from "react"
import { isDirectory } from "renoun/file-system"

import type { EntryType } from "@/collection-helpers"
import { AllDocumentation } from "@/collections"
import { cachePromise } from "@/lib/cache-promise"

import { isExternal, isHidden, resolveDocEntry } from "../collection-helpers"

export type NavBadge =
  | "new"
  | "updated"
  | "beta"
  | "experimental"
  | "deprecated"
  | "pulse"

export interface TreeItem {
  navBadge?: NavBadge
  navIcon?: string
  separator?: boolean
  title: string
  url: string
  external: boolean
  children: TreeItem[]
  favorite?: boolean
}

interface TreeNode {
  entry: EntryType
  children?: TreeNode[]
}

type NavigationCacheGlobals = typeof globalThis & {
  __docsCollectionTreeCache?: Map<string, Promise<TreeNode[]>>
  __docsCollectionNavigationCache?: Map<string, Promise<NavigationGroup[]>>
  __docsLinearNavigationCache?: Map<string, Promise<TreeItem[]>>
}

const navigationGlobals = globalThis as NavigationCacheGlobals

const _collectionTreeCache = (navigationGlobals.__docsCollectionTreeCache ??=
  new Map())

const _collectionNavigationCache =
  (navigationGlobals.__docsCollectionNavigationCache ??= new Map())

const _linearNavigationCache =
  (navigationGlobals.__docsLinearNavigationCache ??= new Map())

async function buildCollectionTreeNode(
  entry: EntryType
): Promise<TreeNode | null> {
  if (isHidden(entry)) {
    return null
  }

  if (!isDirectory(entry)) {
    return { entry }
  }

  const entries = await entry.getEntries()
  const children = await Promise.all(
    entries.map((childEntry) => buildCollectionTreeNode(childEntry))
  )

  return {
    entry,
    children: children.filter((child): child is TreeNode => child !== null),
  }
}

async function getCollectionTree(collection: string): Promise<TreeNode[]> {
  return cachePromise(_collectionTreeCache, collection, async () => {
    const rootEntry =
      (await AllDocumentation.getDirectory([collection]).catch(() => null)) ??
      (await AllDocumentation.getEntry([collection]).catch(() => null))

    if (!rootEntry || isHidden(rootEntry)) {
      return []
    }

    const rootNode = await buildCollectionTreeNode(rootEntry)
    return rootNode ? [rootNode] : []
  })
}

async function mapTreeNode(
  node: TreeNode,
  seenUrls: Set<string>
): Promise<TreeItem | null> {
  const { entry } = node

  if (isHidden(entry)) {
    return null
  }

  const resolved = await resolveDocEntry(entry)
  const { entry: targetEntry, frontmatter, title } = resolved

  const external = Boolean(frontmatter?.externalLink) || isExternal(entry)
  const internalUrl = `/${["docs", ...targetEntry.getPathnameSegments({ includeBasePathname: true })].join("/")}`
  const url = frontmatter?.externalLink ?? internalUrl

  if (seenUrls.has(url)) {
    return null
  }

  seenUrls.add(url)

  const children = node.children
    ? await toTreeItems(node.children, seenUrls)
    : []

  return {
    navBadge: frontmatter?.navBadge,
    navIcon: frontmatter?.navIcon,
    separator: frontmatter?.separator ?? false,
    title,
    url,
    external,
    children,
    favorite: frontmatter?.favorite ?? false,
  }
}

async function toTreeItems(
  nodes: TreeNode[],
  seenUrls = new Set<string>()
): Promise<TreeItem[]> {
  const items = await Promise.all(
    nodes.map((node) => mapTreeNode(node, seenUrls))
  )

  return items.filter((item): item is TreeItem => item !== null)
}

// Module-level singleton: computed once per build process (or dev-server lifecycle).
// With `output: "export"` and a single worker, all page renders share the same
// Node.js process, so this eliminates the most expensive repeated computation.
let _navigationTreePromise: Promise<TreeItem[]> | null = null

export const getNavigationTree = cache(async (): Promise<TreeItem[]> => {
  if (!_navigationTreePromise) {
    _navigationTreePromise = (async () => {
      const collections = await AllDocumentation.getTree({
        includeIndexAndReadmeFiles: true,
      })
      return toTreeItems(collections)
    })()
  }

  return _navigationTreePromise
})

export interface NavigationGroup {
  label: string
  items: TreeItem[]
}

export function flattenNavigationItems(items: TreeItem[]): TreeItem[] {
  const result: TreeItem[] = []

  for (const item of items) {
    result.push(item)

    if (item.children.length > 0) {
      result.push(...flattenNavigationItems(item.children))
    }
  }

  return result
}

export function getFavoriteNavigationItems(
  groups: NavigationGroup[]
): TreeItem[] {
  const seenUrls = new Set<string>()

  return groups
    .flatMap((group) => flattenNavigationItems(group.items))
    .filter((item) => item.favorite)
    .filter((item) => {
      if (seenUrls.has(item.url)) {
        return false
      }

      seenUrls.add(item.url)
      return true
    })
    .map((item) => ({
      ...item,
      children: [],
    }))
}

export const getCollectionNavigation = cache(
  async (collection: string): Promise<NavigationGroup[]> =>
    cachePromise(_collectionNavigationCache, collection, async () => {
      const tree = await toTreeItems(await getCollectionTree(collection))
      const collectionRootPaths = new Set([
        `/docs/${collection}`,
        `/docs/${collection}/`,
      ])
      const rootNode = tree.find(
        (item) => !item.external && collectionRootPaths.has(item.url)
      )

      if (!rootNode) {
        return []
      }

      // Respect numeric ordering for all children — treat leaf directories
      // (those with only an index.mdx) and files the same as groups.
      const groups: NavigationGroup[] = []

      for (const child of rootNode.children) {
        if (child.children.length === 0) {
          // Leaf item — render as a standalone group without a label
          groups.push({ label: "", items: [child] })
        } else {
          groups.push({ label: child.title, items: child.children })
        }
      }

      return groups
    })
)

function flattenItems(items: TreeItem[]): TreeItem[] {
  const result: TreeItem[] = []

  for (const item of items) {
    result.push(item)

    if (item.children.length > 0) {
      result.push(...flattenItems(item.children))
    }
  }

  return result
}

export const getCollectionLinearNavigation = cache(
  async (collection: string): Promise<TreeItem[]> =>
    cachePromise(_linearNavigationCache, collection, async () => {
      const tree = await toTreeItems(await getCollectionTree(collection))
      const collectionRootPaths = new Set([
        `/docs/${collection}`,
        `/docs/${collection}/`,
      ])
      const rootNode = tree.find(
        (item) => !item.external && collectionRootPaths.has(item.url)
      )

      if (!rootNode) {
        return []
      }

      const leaves: TreeItem[] = []
      const groupedParents: TreeItem[] = []

      for (const child of rootNode.children) {
        if (child.children.length === 0) {
          leaves.push(child)
        } else {
          groupedParents.push(child)
        }
      }

      const ordered: TreeItem[] = [...leaves]

      for (const parent of groupedParents) {
        // Include parent landing pages in sibling navigation before nested pages.
        ordered.push(parent)
        ordered.push(...flattenItems(parent.children))
      }

      // Previous/next navigation should stay within internal docs pages.
      return ordered.filter((item) => !item.external)
    })
)
