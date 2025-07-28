import type { z } from "zod"
import Link from "next/link"

import type { getSections } from "~/collections"
import type { frontmatterSchema } from "~/validations"
import { getFileContent, getTitle, isHidden } from "~/collections"
import { removeFromArray } from "~/lib/utils"

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
    if (isHidden(section)) {
      continue
    }

    let file: Awaited<ReturnType<typeof getFileContent>>
    let frontmatter: z.infer<typeof frontmatterSchema> | undefined
    try {
      file = await getFileContent(section)
      frontmatter = await file?.getExportValue("frontmatter")
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e: unknown) {
      continue
    }

    if (!frontmatter) {
      elements.push({
        title: section.getTitle(),
        description: "",
        path: `/${removeFromArray(section.getPathnameSegments(), ["index"]).join("/")}`,
      })
    } else {
      const title = getTitle(section, frontmatter)

      elements.push({
        title,
        description: frontmatter.description ?? "",
        path: `/${removeFromArray(section.getPathnameSegments(), ["index"]).join("/")}`,
      })
    }
  }

  return (
    <div
      className="mt-12 grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-2"
      data-pagefind-ignore
    >
      {elements.map((ele, index) => {
        return (
          <Link href={ele.path} key={index}>
            <div className="rounded-lg border border-orange-primary/40 bg-cream-100 p-6 transition-colors hover:bg-cream-200 dark:border-dark-50 dark:bg-dark-100 dark:hover:bg-dark-50">
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
