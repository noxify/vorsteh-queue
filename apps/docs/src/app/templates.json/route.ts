import * as path from "path"
import { NextResponse } from "next/server"
import { globby } from "globby"
import pMap from "p-map"
import { readPackage } from "read-pkg"

export const dynamic = "force-static"

export async function GET() {
  const examplePkgJson = await globby(["**/*/package.json"], {
    cwd: path.join(process.cwd(), "..", "..", "examples"),
    expandDirectories: true,
    absolute: true,
    deep: 2,
    gitignore: true,
  })

  const parsedTemplates = await pMap(examplePkgJson, async (file) => {
    const content = await readPackage({ cwd: path.dirname(file) })
    return {
      name: content.name || path.basename(path.dirname(file)),
      alias: path.basename(path.dirname(file)),
      path: path.join("examples", path.basename(path.dirname(file))),
      description: content.description ?? "No description",
    }
  })

  return NextResponse.json({ templates: parsedTemplates })
}
