import type { z } from "zod"

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
        path: `/docs/${removeFromArray(section.getPathnameSegments(), ["index"]).join("/")}`,
      })
    } else {
      const title = getTitle(section, frontmatter)

      elements.push({
        title,
        description: frontmatter.description ?? "",
        path: `/docs/${removeFromArray(section.getPathnameSegments(), ["index"]).join("/")}`,
      })
    }
  }

  return (
    <div
      className="mt-12 grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-2"
      data-pagefind-ignore
    >
      {elements.map((ele, index) => {
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
