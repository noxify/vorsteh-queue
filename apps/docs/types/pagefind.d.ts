// source: https://github.com/Hugos68/vite-plugin-pagefind/blob/main/src/types.ts
interface PagefindIndexOptions {
  basePath?: string
  baseUrl?: string
  excerptLength?: number
  indexWeight?: number
  mergeFilter?: Record<string, unknown>
  highlightParam?: string
  language?: string
  primary?: boolean
  ranking?: PagefindRankingWeights
}

interface PagefindRankingWeights {
  termSimilarity?: number
  pageLength?: number
  termSaturation?: number
  termFrequency?: number
}

interface PagefindSearchOptions {
  preload?: boolean
  verbose?: boolean
  filters?: Record<string, unknown>
  sort?: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface PagefindFilterCounts extends Record<string, Record<string, number>> {}

interface PagefindSearchResults {
  results: PagefindSearchResult[] | null
  unfilteredResultCount: number
  filters: PagefindFilterCounts
  totalFilters: PagefindFilterCounts
  timings: {
    preload: number
    search: number
    total: number
  }
}

interface PagefindSearchResult {
  id: string
  score: number
  words: number[]
  data: () => Promise<PagefindSearchFragment>
}

interface PagefindSearchFragment {
  url: string
  raw_url?: string
  content: string
  raw_content?: string
  excerpt: string
  sub_results: PagefindSubResult[]
  word_count: number
  locations: number[]
  weighted_locations: PagefindWordLocation[]
  filters: Record<string, string[]>
  meta: Record<string, string>
  anchors: PagefindSearchAnchor[]
}

interface PagefindSubResult {
  title: string
  url: string
  locations: number[]
  weighted_locations: PagefindWordLocation[]
  excerpt: string
  anchor?: PagefindSearchAnchor
}

interface PagefindWordLocation {
  weight: number
  balanced_score: number
  location: number
}

interface PagefindSearchAnchor {
  element: string
  id: string
  text?: string
  location: number
}

interface Pagefind {
  debouncedSearch: (
    query: string,
    options?: PagefindSearchOptions,
    duration?: number,
  ) => Promise<PagefindSearchResults>
  destroy: () => Promise<void>
  filters: () => Promise<PagefindFilterCounts>
  init: () => Promise<void>
  mergeIndex: (indexPath: string, options?: Record<string, unknown>) => Promise<void>
  options: (options: PagefindIndexOptions) => Promise<void>
  preload: (term: string, options?: PagefindIndexOptions) => Promise<void>
  search: (term: string, options?: PagefindSearchOptions) => Promise<PagefindSearchResults>
}

export type {
  PagefindIndexOptions,
  PagefindRankingWeights,
  PagefindSearchOptions,
  PagefindFilterCounts,
  PagefindSearchResults,
  PagefindSearchResult,
  PagefindSearchFragment,
  PagefindSubResult,
  PagefindWordLocation,
  PagefindSearchAnchor,
  Pagefind,
}

declare global {
  interface Window {
    pagefind?: Pagefind
  }
}
