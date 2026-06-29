export function normalizeInternalHref(href: string): string {
  if (href === "/") {
    return href
  }

  const [rawPathWithQuery = "", hash = ""] = href.split("#")
  const [pathname = "", search = ""] = rawPathWithQuery.split("?")

  if (!pathname || pathname.endsWith("/") || /\.[a-z0-9]+$/iu.test(pathname)) {
    return href
  }

  const normalizedPathname = `${pathname}/`
  const normalizedSearch = search ? `?${search}` : ""
  const normalizedHash = hash ? `#${hash}` : ""

  return `${normalizedPathname}${normalizedSearch}${normalizedHash}`
}
