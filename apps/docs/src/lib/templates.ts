import path from "node:path"

import { globby } from "globby"
import pMap from "p-map"
import { readPackage } from "read-pkg"

export interface Template {
  readonly name: string
  readonly alias: string
  readonly path: string
  readonly description: string
}

/**
 * Read all example templates from the examples directory.
 *
 * Scans `examples/` package.json files and extracts name, alias, path,
 * and description for each template.
 */
export async function getTemplates(): Promise<readonly Template[]> {
  const examplePkgJson = await globby(["**/*/package.json"], {
    absolute: true,
    cwd: path.join(process.cwd(), "..", "..", "examples"),
    deep: 2,
    expandDirectories: true,
    gitignore: true,
  })

  const templates = await pMap(examplePkgJson, async (file) => {
    const content = await readPackage({ cwd: path.dirname(file) })
    return {
      alias: path.basename(path.dirname(file)),
      description: content.description ?? "No description",
      name: content.name || path.basename(path.dirname(file)),
      path: path.join("examples", path.basename(path.dirname(file))),
    }
  })

  return templates.toSorted((a, b) => a.alias.localeCompare(b.alias))
}
