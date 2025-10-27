import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getBreadcrumbItems, transformedEntries } from "~/collections"
import { DirectoryContent } from "~/components/directory-content"
import { FileContent } from "~/components/file-content"

export async function generateStaticParams() {
  const slugs = (await transformedEntries()).map((entry) => ({
    slug: entry.segments,
  }))

  return slugs
}

export async function generateMetadata(props: PageProps<"/[...slug]">): Promise<Metadata> {
  const params = await props.params
  const breadcrumbItems = await getBreadcrumbItems(params.slug)

  const titles = breadcrumbItems.map((ele) => ele.title)

  return {
    title: `${titles.join(" - ")}`,
  }
}

export default async function DocsPage(props: PageProps<"/[...slug]">) {
  const params = await props.params

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const searchParam = `/${params.slug?.join("/") ?? ""}`

  const transformedEntry = (await transformedEntries()).find(
    (ele) => ele.raw_pathname == searchParam,
  )

  if (!transformedEntry) {
    return notFound()
  }

  // if we can't find an index file, but we have a valid directory
  // use the directory component for rendering
  if (!transformedEntry.file && transformedEntry.isDirectory) {
    return (
      <>
        <DirectoryContent transformedEntry={transformedEntry} />
      </>
    )
  }

  // if we have a valid file ( including the index file )
  // use the file component for rendering
  if (transformedEntry.file) {
    return (
      <>
        <FileContent transformedEntry={transformedEntry} />
      </>
    )
  }

  // seems to be an invalid path
  return notFound()
}
