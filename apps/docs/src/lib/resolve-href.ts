/**
 * Type definition for URL objects (compatible with Node.js url module)
 */
export interface UrlObject {
  auth?: string | null
  hash?: string | null
  host?: string | null
  hostname?: string | null
  href?: string
  path?: string | null
  pathname?: string | null
  protocol?: string | null
  search?: string | null
  slashes?: boolean | null
  port?: string | number | null
  query?:
    | string
    | null
    | Record<
        string,
        | string
        | number
        | boolean
        | bigint
        | readonly (string | number | boolean | bigint)[]
        | null
        | undefined
      >
}

type NormalizedQuery = Record<
  string,
  | string
  | number
  | boolean
  | bigint
  | readonly (string | number | boolean | bigint)[]
  | null
  | undefined
>

function parseSearchParams(search: string): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {}
  const searchParams = search.slice(1)

  if (!searchParams) {
    return query
  }

  for (const param of searchParams.split("&")) {
    const [key, ...valueParts] = param.split("=")
    if (!key) {
      continue
    }

    const decodedKey = decodeURIComponent(key)
    const decodedValue = valueParts.length
      ? decodeURIComponent(valueParts.join("="))
      : ""
    const existing = query[decodedKey]
    query[decodedKey] =
      existing === undefined
        ? decodedValue
        : Array.isArray(existing)
          ? [...existing, decodedValue]
          : [existing, decodedValue]
  }

  return query
}

function parseProtocolAndHost(rest: string, result: UrlObject): string {
  const protoMatch = /^(?<protocol>[a-z][a-z0-9+.-]*):\/\//iu.exec(rest)
  if (!protoMatch) {
    return rest
  }

  const { protocol } = protoMatch.groups ?? {}
  if (!protocol) {
    return rest
  }

  result.protocol = protocol.toLowerCase()
  result.slashes = true
  let nextRest = rest.slice(protoMatch[0].length)

  const atIndex = nextRest.indexOf("@")
  const slashIndex = nextRest.indexOf("/")
  if (atIndex !== -1 && (slashIndex === -1 || atIndex < slashIndex)) {
    result.auth = nextRest.slice(0, atIndex)
    nextRest = nextRest.slice(atIndex + 1)
  }

  const hostEnd = nextRest.indexOf("/")
  const hostPart = hostEnd === -1 ? nextRest : nextRest.slice(0, hostEnd)
  if (hostPart) {
    result.host = hostPart
    const colonIndex = hostPart.lastIndexOf(":")
    result.hostname =
      colonIndex === -1 ? hostPart : hostPart.slice(0, colonIndex)
    if (colonIndex !== -1) {
      result.port = hostPart.slice(colonIndex + 1)
    }
  }

  return hostEnd === -1 ? "" : nextRest.slice(hostEnd)
}

function normalizeQuery(q: unknown): NormalizedQuery {
  if (!q || typeof q !== "object" || Array.isArray(q)) {
    return {}
  }

  const result: NormalizedQuery = {}
  for (const [k, v] of Object.entries(q)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      typeof v === "bigint" ||
      v === null ||
      v === undefined
    ) {
      result[k] = v as string | number | boolean | bigint | null | undefined
      continue
    }

    if (Array.isArray(v)) {
      const arr = v.filter(
        (item): item is string | number | boolean | bigint =>
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean" ||
          typeof item === "bigint"
      )
      result[k] = arr as readonly (string | number | boolean | bigint)[]
      continue
    }

    result[k] = String(v)
  }

  return result
}

function resolveRelativePathname(
  parsedHref: UrlObject,
  currentPath: string
): void {
  if (!parsedHref.pathname || parsedHref.pathname.startsWith("/")) {
    return
  }

  const currentDirectory = currentPath.slice(0, currentPath.lastIndexOf("/"))
  parsedHref.pathname = resolvePath(currentDirectory, parsedHref.pathname)
}

function mergeQueryFromSearch(parsedHref: UrlObject): void {
  const baseQuery = normalizeQuery(parsedHref.query)
  const searchQueryRaw = parsedHref.search
    ? parseUrl(parsedHref.search, true).query
    : null
  const searchQuery = normalizeQuery(searchQueryRaw)

  parsedHref.query = {
    ...baseQuery,
    ...searchQuery,
  }
  parsedHref.search = undefined
}

function applyLocalePrefix(
  parsedHref: UrlObject,
  locale: string | undefined,
  defaultLocale: string | undefined,
  locales: string[] | undefined
): void {
  if (
    !locale ||
    !locales ||
    !locales.includes(locale) ||
    locale === defaultLocale
  ) {
    return
  }

  const localePrefix = `/${locale}`
  if (!parsedHref.pathname?.startsWith(localePrefix)) {
    parsedHref.pathname = `${localePrefix}${parsedHref.pathname === "/" ? "" : parsedHref.pathname}`
  }
}

function applyBasePath(
  parsedHref: UrlObject,
  basePath: string | undefined
): void {
  if (!basePath) {
    return
  }

  const cleanedBasePath = basePath.endsWith("/")
    ? basePath.slice(0, -1)
    : basePath
  const cleanedPathname = parsedHref.pathname?.startsWith("/")
    ? parsedHref.pathname
    : `/${parsedHref.pathname ?? ""}`
  parsedHref.pathname = `${cleanedBasePath}${cleanedPathname}`
}

function ensurePathnameStartsWithSlash(parsedHref: UrlObject): void {
  if (parsedHref.pathname && !parsedHref.pathname.startsWith("/")) {
    parsedHref.pathname = `/${parsedHref.pathname}`
  }
}

function applyHashOnlyFallback(
  parsedHref: UrlObject,
  currentPath: string
): void {
  if (!parsedHref.pathname && parsedHref.hash) {
    const [pathWithoutHash] = currentPath.split("#")
    parsedHref.pathname = pathWithoutHash
  }
}

/**
 * Browser-compatible URL parsing (spec-compliant with Node.js url.parse)
 * @param urlStr - The URL string to parse
 * @param parseQueryString - If true, parse the query string into an object
 * @returns Parsed URL object
 */
function parseUrl(urlStr: string, parseQueryString = false): UrlObject {
  const result: UrlObject = {
    protocol: null,
    slashes: null,
    auth: null,
    host: null,
    port: null,
    hostname: null,
    hash: null,
    search: null,
    query: null,
    pathname: null,
    path: null,
    href: urlStr,
  }

  // Handle empty or invalid input
  if (!urlStr || typeof urlStr !== "string") {
    return result
  }

  let rest = urlStr.trim()

  // Extract hash
  const hashIndex = rest.indexOf("#")
  if (hashIndex !== -1) {
    result.hash = rest.slice(hashIndex)
    rest = rest.slice(0, hashIndex)
  }

  // Extract query string
  const queryIndex = rest.indexOf("?")
  if (queryIndex !== -1) {
    result.search = rest.slice(queryIndex)
    rest = rest.slice(0, queryIndex)

    if (parseQueryString && result.search) {
      result.query = parseSearchParams(result.search)
    }
  }

  rest = parseProtocolAndHost(rest, result)

  // Remaining is pathname
  if (rest) {
    result.pathname = rest
  }

  // Set path (pathname + search)
  if (result.pathname || result.search) {
    result.path = (result.pathname ?? "") + (result.search ?? "")
  }

  return result
}

/**
 * Browser-compatible URL formatting (spec-compliant with Node.js url.format)
 * @param urlObj - URL object to format
 * @returns Formatted URL string
 */
function formatUrl(urlObj: UrlObject): string {
  let result = ""

  // Protocol
  if (urlObj.protocol) {
    result += urlObj.protocol
    result +=
      urlObj.slashes || /^[a-z][a-z0-9+.-]*$/iu.test(urlObj.protocol)
        ? "://"
        : ":"
  }

  // Auth
  if (urlObj.auth) {
    result += `${urlObj.auth}@`
  }

  // Host or hostname:port
  if (urlObj.host) {
    result += urlObj.host
  } else if (urlObj.hostname) {
    result += urlObj.hostname
    if (urlObj.port) {
      result += `:${urlObj.port}`
    }
  }

  // Pathname
  if (urlObj.pathname) {
    result += urlObj.pathname
  }

  result += formatQueryOrSearch(urlObj)
  result += formatHash(urlObj)

  return result
}

function formatQueryOrSearch(urlObj: UrlObject): string {
  if (urlObj.query && typeof urlObj.query === "object") {
    const params: string[] = []
    for (const [key, value] of Object.entries(urlObj.query)) {
      if (value === null || value === undefined) {
        continue
      }

      const encodedKey = encodeURIComponent(key)
      if (Array.isArray(value)) {
        for (const v of value) {
          params.push(`${encodedKey}=${encodeURIComponent(String(v))}`)
        }
      } else {
        params.push(`${encodedKey}=${encodeURIComponent(String(value))}`)
      }
    }

    return params.length > 0 ? `?${params.join("&")}` : ""
  }

  if (urlObj.search) {
    return urlObj.search.startsWith("?") ? urlObj.search : `?${urlObj.search}`
  }

  return ""
}

function formatHash(urlObj: UrlObject): string {
  if (!urlObj.hash) {
    return ""
  }

  return urlObj.hash.startsWith("#") ? urlObj.hash : `#${urlObj.hash}`
}

/**
 * Browser-compatible path resolution (similar to path.resolve)
 * Resolves a sequence of paths into an absolute path.
 */
function resolvePath(...paths: string[]): string {
  let resolvedPath = ""
  let resolvedAbsolute = false

  // Process paths from right to left until we find an absolute path
  for (let i = paths.length - 1; i >= -1 && !resolvedAbsolute; i -= 1) {
    const path = i >= 0 ? paths[i] : "/"

    // Skip empty paths
    if (!path || path.length === 0) {
      continue
    }

    resolvedPath = `${path}/${resolvedPath}`
    resolvedAbsolute = path.startsWith("/")
  }

  // Normalize the path
  resolvedPath = normalizePathSegments(resolvedPath, !resolvedAbsolute)

  if (resolvedAbsolute) {
    return `/${resolvedPath}`
  }
  return resolvedPath.length > 0 ? resolvedPath : "."
}

/**
 * Normalizes path segments by resolving . and .. components
 */
// oxlint-disable-next-line complexity
function normalizePathSegments(path: string, allowAboveRoot: boolean): string {
  let res = ""
  let lastSegmentLength = 0
  let lastSlash = -1
  let dots = 0
  let code = 0

  for (let i = 0; i <= path.length; i += 1) {
    if (i < path.length) {
      code = path.codePointAt(i) ?? 47
    } else if (code === 47 /* / */) {
      break
    } else {
      code = 47 /* / */
    }

    if (code === 47 /* / */) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.codePointAt(res.length - 1) !== 46 /* . */ ||
          res.codePointAt(res.length - 2) !== 46 /* . */
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/")
            if (lastSlashIndex === -1) {
              res = ""
              lastSegmentLength = 0
            } else {
              res = res.slice(0, lastSlashIndex)
              lastSegmentLength = res.length - 1 - res.lastIndexOf("/")
            }
            lastSlash = i
            dots = 0
            continue
          } else if (res.length !== 0) {
            res = ""
            lastSegmentLength = 0
            lastSlash = i
            dots = 0
            continue
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? "/.." : ".."
          lastSegmentLength = 2
        }
      } else {
        if (res.length > 0) {
          res += `/${path.slice(lastSlash + 1, i)}`
        } else {
          res = path.slice(lastSlash + 1, i)
        }
        lastSegmentLength = i - lastSlash - 1
      }
      lastSlash = i
      dots = 0
    } else if (code === 46 /* . */ && dots !== -1) {
      dots += 1
    } else {
      dots = -1
    }
  }
  return res
}

export interface ResolveHrefOptions {
  currentPath?: string // The current path, useful for resolving relative Hrefs
  locale?: string // The current locale, for prefixing
  defaultLocale?: string // The default locale
  locales?: string[] // A list of all supported locales
  basePath?: string // The base path, if the app is deployed under a subpath
}

/**
 * A simplified standalone implementation of Next.js' `resolveHref`.
 * It resolves a given href into a complete URL, taking into account
 * query parameters, locales, and an optional base path.
 *
 * @param href The URL or URL object to resolve.
 * @param options Options for resolution, e.g., currentPath, locale, basePath.
 * @returns A string representing the fully resolved URL.
 */
export function resolveHref(
  href: string | UrlObject,
  options: ResolveHrefOptions = {}
): string {
  const {
    currentPath = "/",
    locale,
    defaultLocale,
    locales,
    basePath,
  } = options

  const parsedHref: UrlObject =
    typeof href === "string" ? parseUrl(href, true) : { ...href }

  resolveRelativePathname(parsedHref, currentPath)
  mergeQueryFromSearch(parsedHref)
  applyLocalePrefix(parsedHref, locale, defaultLocale, locales)
  applyBasePath(parsedHref, basePath)
  ensurePathnameStartsWithSlash(parsedHref)
  applyHashOnlyFallback(parsedHref, currentPath)

  return formatUrl(parsedHref)
}
