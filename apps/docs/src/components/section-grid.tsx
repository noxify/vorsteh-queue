import Link from "next/link"

import type { getSections } from "~/collections"
import { getMetadata, isHidden } from "~/collections"

export default async function SectionGrid({
  sections,
}: {
  sections: Awaited<ReturnType<typeof getSections>>
}) {
  if (sections.length === 0) {
    return <></>
  }

  const elements = []

  for (const section of sections) {
    if (isHidden(section.entry)) {
      continue
    }

    let frontmatter: Awaited<ReturnType<typeof getMetadata>>
    try {
      frontmatter = await getMetadata(section.file)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e: unknown) {
      continue
    }

    if (!frontmatter) {
      elements.push({
        title: section.title,
        description: "",
        path: section.raw_pathname,
      })
    } else {
      elements.push({
        title: section.title,
        description: frontmatter.description ?? "",
        path: section.raw_pathname,
      })
    }
  }

  return (
    <div
      className="mt-12 grid auto-rows-fr place-items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-2"
      data-pagefind-ignore
    >
      {elements.map((ele, index) => {
        return (
          <Link href={ele.path} key={index}>
            <div className="h-full rounded-lg border border-orange-primary/40 bg-cream-100 p-6 transition-colors hover:bg-cream-200 dark:border-dark-50 dark:bg-dark-100 dark:hover:bg-dark-50">
              <h3 className="mb-2 font-semibold text-dark-200 dark:text-dark-900">{ele.title}</h3>
              <div className="text-sm text-fur-500 dark:text-dark-800">{ele.description}</div>
            </div>
          </Link>
        )
        return <div key={index}>{ele.title}</div>
        // return (
        //   <AnimatedCard
        //     link={ele.path}
        //     title={ele.title}
        //     description={ele.description}
        //     key={index}
        //   />
        // )
      })}
    </div>
  )
}
