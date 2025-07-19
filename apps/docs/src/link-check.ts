import { readFileSync } from "fs"
import path from "path"
import { toString } from "mdast-util-to-string"
import { printErrors, scanURLs, validateFiles } from "next-validate-link"
import remarkParse from "remark-parse"
import { isDirectory, isFile } from "renoun/file-system"
import { unified } from "unified"

import { DocumentationGroup } from "./collections"
import { createSlug, removeFromArray } from "./lib/utils"

const getDirectories = async () => {
  const entries = (await DocumentationGroup.getEntries({ recursive: true })).filter((entry) =>
    isDirectory(entry),
  )

  const result = []
  for (const entry of entries) {
    const filePath = entry.getAbsolutePath()

    const slug = [...entry.getPathSegments()]
    const url = `/${path.join("docs", ...slug)}`

    result.push({
      path: filePath,
      url,
      slug,
    })
  }

  return result
}

const getFiles = async () => {
  const entries = (
    await DocumentationGroup.getEntries({
      recursive: true,
      includeIndexAndReadme: true,
    })
  ).filter((entry) => isFile(entry, "mdx"))

  const result = []
  for (const entry of entries) {
    const filePath = entry.getAbsolutePath()

    const slug = removeFromArray(entry.getPathSegments(), ["index"])
    const url = `/${path.join("docs", ...slug)}`
    const content = readFileSync(filePath).toString()

    const file = unified()
      .use(remarkParse)
      // it seems that something is weird with the headings
      // because the tree isn't updated with the id's
      //.use({ plugins: remarkPlugins })
      .parse(content)

    const headinsFromTree = file.children.filter((node) => node.type === "heading")

    // this is just a copy from
    // https://github.com/souporserious/renoun/blob/main/packages/mdx/src/remark/add-headings.ts
    const headingCounts = new Map()
    const headings = headinsFromTree.map((node) => {
      const text = node.children.map((child) => toString(child)).join("")
      let id = createSlug(text)

      if (headingCounts.has(id)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const count = headingCounts.get(id) + 1
        headingCounts.set(id, count)
        id = `${id}-${count}`
      } else {
        headingCounts.set(id, 1)
      }

      return {
        text,
        id,
        depth: node.depth,
      }
    })

    result.push({
      path: filePath,
      url,
      slug,
      content,
      headings: headings.map((ele) => ele.id),
    })
  }

  return result
}

const files = await getFiles()

const directories = await getDirectories()

const scanned = await scanURLs({
  pages: ["docs/[...slug]/page.tsx"],

  populate: {
    "docs/[...slug]": [
      ...files.map((collection) => ({
        value: collection.slug,
        hashes: collection.headings,
      })),
      ...directories.map((collection) => ({
        value: collection.slug,
      })),
    ],
  },
})

// console.dir(scanned)

const validateLinks = await validateFiles(files, {
  scanned,
  checkExternal: false,
})

printErrors(validateLinks, true)
