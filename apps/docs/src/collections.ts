import {
  Collection,
  Directory,
  Repository,
  NodeFileSystem,
} from "renoun/file-system"

import { docSchema } from "./validations"

export const availableCollections = [
  "vorsteh-queue",
  "cli",
  "examples",
  "api-reference",
] as const
export type AvailableCollection = (typeof availableCollections)[number]

const repository = Repository.remote({
  baseUrl: "https://github.com",
  host: "github",
  owner: "noxify",
  repository: "vorsteh-queue",
})

const fileSystem = new NodeFileSystem()

export { repository, fileSystem }

export function createDirectories() {
  return availableCollections.map(
    (collection) =>
      new Directory({
        basePathname: collection,
        fileSystem,
        filter: (entry) =>
          !entry.baseName.startsWith("_") &&
          !entry.absolutePath.includes("_assets"),
        loader: {
          mdx: (contentPath) =>
            import(`../content/${collection}/${contentPath}.mdx`),
        },
        path: `content/${collection}`,
        repository,
        schema: {
          mdx: docSchema,
        },
      })
  )
}

export const AllDocumentation = new Collection({
  entries: createDirectories(),
})

export const PackagesDirectory = new Directory({
  fileSystem,
  filter: "**/*.ts",
  path: "../../packages",
})
