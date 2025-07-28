import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { isDirectory } from "renoun/file-system"

import { AllDocumentation, getBreadcrumbItems, getFileContent, routes } from "~/collections"
import { DirectoryContent } from "~/components/directory-content"
import { FileContent } from "~/components/file-content"

const CollectionInfo = cache(() => AllDocumentation)

export async function generateStaticParams() {
  return (await routes).map((entry) => ({ slug: entry.segments }))
}

interface PageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params
  const breadcrumbItems = await getBreadcrumbItems(params.slug)

  const titles = breadcrumbItems.map((ele) => ele.title)

  return {
    title: `${titles.join(" - ")}`,
  }
}

export default async function DocsPage(props: PageProps) {
  const params = await props.params

  let collection

  try {
    collection = await CollectionInfo().getEntry([...params.slug])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    try {
      collection = await CollectionInfo().getEntry([...params.slug, "index"])
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.warn("Unable to get entry for path:", params.slug)

      return notFound()
    }
  }

  // check the current path if it's a valid file ( including index check for a directory )
  const file = await getFileContent(collection)

  // if we can't find an index file, but we have a valid directory
  // use the directory component for rendering
  if (!file && isDirectory(collection)) {
    return (
      <>
        <DirectoryContent source={collection} />
      </>
    )
  }

  // if we have a valid file ( including the index file )
  // use the file component for rendering
  if (file) {
    return (
      <>
        <FileContent source={collection} />
      </>
    )
  }

  // seems to be an invalid path
  return notFound()
}
