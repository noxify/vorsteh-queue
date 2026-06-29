import { ExternalLinkIcon } from "lucide-react"
import Link from "next/link"
import type { ComponentPropsWithoutRef } from "react"

import { normalizeInternalHref } from "@/lib/normalize-internal-href"
import { cn } from "@/lib/utils"

type AnchorProps = ComponentPropsWithoutRef<"a">

export function LinkHandler({ href, children, ...props }: AnchorProps) {
  if (!href) {
    return (
      <Link
        href="/"
        prefetch={false}
        className={cn(
          "hover:text-foreground text-indigo-600 dark:text-indigo-400",
          props.className
        )}
      >
        ###INVALID_LINK###
      </Link>
    )
  }

  if (
    href.startsWith("http") ||
    href.startsWith("https") ||
    href.startsWith("mailto")
  ) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLinkIcon className="ml-1 inline size-4" />
      </a>
    )
  }

  if (href.startsWith("#")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  const normalizedHref = normalizeInternalHref(href)

  return (
    <>
      <Link href={normalizedHref} {...props} prefetch={false}>
        {children ?? normalizedHref}
      </Link>
    </>
  )
}
