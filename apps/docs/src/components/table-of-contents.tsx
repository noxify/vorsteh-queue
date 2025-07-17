import Link from "next/link"

interface Heading {
  id: string
  text: string
  level: 2 | 3 | 4 // h2, h3, h4
}

interface TableOfContentsProps {
  headings: Heading[]
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  return (
    <nav className="sticky top-16 ml-8 hidden w-64 py-4 xl:block">
      <h3 className="text-dark-200 dark:text-dark-900 mb-4 text-lg font-semibold">On this page</h3>
      <ul className="space-y-2">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "ml-4" : ""}>
            <Link
              href={`#${heading.id}`}
              className="text-fur-500 dark:text-dark-800 hover:text-orange-primary dark:hover:text-orange-light text-sm transition-colors"
            >
              {heading.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
