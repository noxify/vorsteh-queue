import { CorePackageDirectory } from "~/collections"
import { References } from "./_components/Reference"

export default async function Page() {
  const files = (await CorePackageDirectory.getEntries({ includeIndexAndReadmeFiles: true })).map(
    (ele) => ele.getPathname(),
  )
  const sourceFile = await CorePackageDirectory.getFile("index", "ts")

  console.dir({ files, sourceFileName: sourceFile.getName() })

  if (!sourceFile) {
    return null
  }

  const fileExports = await sourceFile.getExports()

  console.dir({ fileExports })

  return (
    <>
      <References fileExports={fileExports} />
    </>
  )
}
