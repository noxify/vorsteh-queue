import { isFile } from "renoun/file-system"

import { CorePackageDirectory } from "~/collections"
import { References } from "./_components/Reference"

export default async function Page() {
  const files = await CorePackageDirectory.getEntries({
    includeIndexAndReadmeFiles: false,
    recursive: true,
  })

  console.dir({ files })

  const allExports = await Promise.all(
    files
      .filter((ele) => isFile(ele))
      .map(async (entry) => {
        const sourceFile = await CorePackageDirectory.getFile(
          entry.getPathnameSegments({
            includeBasePathname: false,
            includeDirectoryNamedSegment: false,
          }),
          "ts",
        )

        const fileExports = await sourceFile.getExports()

        return fileExports
      }),
  )

  return (
    <>
      {allExports.map((fileExports, index) => {
        return (
          <div key={index}>
            <References fileExports={fileExports} />
          </div>
        )
      })}
    </>
  )
}
