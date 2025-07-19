// import type { z } from "zod"
// import { EntryGroup, isDirectory, isFile } from "renoun/file-system"

// import type { frontmatterSchema } from "./validations"
// import { removeFromArray } from "./lib/utils"
// import { generateDirectories } from "./sources"

// export const DocumentationGroup = new EntryGroup({
//   entries: [...generateDirectories()],
// })

// export type EntryType = Awaited<ReturnType<typeof DocumentationGroup.getEntry>>
// export type DirectoryType = Awaited<ReturnType<typeof DocumentationGroup.getDirectory>>

// /**
//  * Helper function to get the title for an element in the sidebar/navigation
//  * @param collection {EntryType} the collection to get the title for
//  * @param frontmatter {z.infer<typeof frontmatterSchema>} the frontmatter to get the title from
//  * @param includeTitle? {boolean} whether to include the title in the returned string
//  * @returns {string} the title to be displayed in the sidebar/navigation
//  */
// export function getTitle(
//   collection: EntryType,
//   frontmatter: z.infer<typeof frontmatterSchema>,
//   includeTitle = false,
// ): string {
//   return includeTitle
//     ? (frontmatter.navTitle ?? frontmatter.title ?? collection.getTitle())
//     : (frontmatter.navTitle ?? collection.getTitle())
// }

// /**
//  * Helper function to get the file content for a given source entry
//  * This function will try to get the file based on the given path and the "mdx" extension
//  * If the file is not found, it will try to get the index file based on the given path and the "mdx" extension
//  * If there is also no index file, it will return null
//  *
//  * @param source {EntryType} the source entry to get the file content for
//  */
// export const getFileContent = async (source: EntryType) => {
//   // first, try to get the file based on the given path

//   return await DocumentationGroup.getFile(source.getPathSegments(), "mdx").catch(async () => {
//     return await DocumentationGroup.getFile([...source.getPathSegments(), "index"], "mdx").catch(
//       () => null,
//     )
//   })
// }

// /**
//  * Helper function to get the sections for a given source entry
//  * This function will try to get the sections based on the given path
//  *
//  * If there there are no entries/children for the current path, it will return an empty array
//  *
//  * @param source {EntryType} the source entry to get the sections for
//  * @returns
//  */
// export async function getSections(source: EntryType) {
//   if (source.getDepth() > -1) {
//     if (isDirectory(source)) {
//       return (
//         await (await DocumentationGroup.getDirectory(source.getPathSegments())).getEntries()
//       ).filter((ele) => ele.getPath() !== source.getPath())
//     }

//     if (isFile(source) && source.getBaseName() === "index") {
//       return await source.getParent().getEntries()
//     }
//     return []
//   } else {
//     return (
//       await (await DocumentationGroup.getDirectory(source.getPathSegments())).getEntries()
//     ).filter((ele) => ele.getPath() !== source.getPath())
//   }
// }

// /**
//  * Helper function to get the breadcrumb items for a given slug
//  *
//  * @param slug {string[]} the slug to get the breadcrumb items for
//  */
// export const getBreadcrumbItems = async (slug: string[]) => {
//   // we do not want to have "index" as breadcrumb element
//   const cleanedSlug = removeFromArray(slug, ["index"])

//   const combinations = cleanedSlug.map((_, index) => cleanedSlug.slice(0, index + 1))

//   const items = []

//   for (const currentPageSegement of combinations) {
//     let collection: EntryType
//     let file: Awaited<ReturnType<typeof getFileContent>>
//     let frontmatter: z.infer<typeof frontmatterSchema> | undefined
//     try {
//       collection = await DocumentationGroup.getEntry(currentPageSegement)
//       if (collection.getPathSegments().includes("index")) {
//         file = await getFileContent(collection.getParent())
//       } else {
//         file = await getFileContent(collection)
//       }

//       frontmatter = await file?.getExportValue("frontmatter")
//       // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     } catch (e: unknown) {
//       continue
//     }

//     if (!frontmatter) {
//       items.push({
//         title: collection.getTitle(),
//         path: ["docs", ...collection.getPathSegments()],
//       })
//     } else {
//       const title = getTitle(collection, frontmatter, true)
//       items.push({
//         title,
//         path: ["docs", ...removeFromArray(collection.getPathSegments(), ["index"])],
//       })
//     }
//   }

//   return items
// }

// /**
//  * Checks if an entry is hidden (starts with an underscore)
//  *
//  * @param entry {EntryType} the entry to check for visibility
//  */
// export function isHidden(entry: EntryType) {
//   return entry.getBaseName().startsWith("_")
// }
