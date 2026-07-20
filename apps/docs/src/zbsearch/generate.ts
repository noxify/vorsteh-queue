import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { persist } from "@zbsearch/plugin-data-persistence"
import ora from "ora"
import { create, insertMultiple } from "zbsearch"

import { buildSearchDocuments, getAllSearchableEntries } from "./builder"

async function generateAndPersistSearchIndex() {
  const spinner = ora("Building zbsearch search index...").start()

  try {
    const entries = await getAllSearchableEntries()
    spinner.text = `Preparing ${entries.length} documentation entries...`
    const searchDocuments = await buildSearchDocuments(entries, spinner)

    const db = create({
      schema: {
        breadcrumb: "string",
        content: "string",
        heading: "string",
        page_id: "string",
        section: "string",
        title: "string",
        type: "enum" as const,
        url: "string",
      },
    })

    spinner.text = `Indexing ${searchDocuments.length} documents in zbsearch...`
    await insertMultiple(db, searchDocuments)

    const outputFile = path.resolve(process.cwd(), "public/search-index.json")
    mkdirSync(path.dirname(outputFile), { recursive: true })
    const snapshot = await persist(db, "json")
    if (typeof snapshot === "string") {
      writeFileSync(outputFile, snapshot)
    } else if (snapshot instanceof ArrayBuffer) {
      writeFileSync(outputFile, Buffer.from(snapshot))
    } else {
      writeFileSync(outputFile, snapshot)
    }

    spinner.succeed(`Search index generated: ${outputFile}`)
    process.exit(0)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while generating index"
    spinner.fail(`Failed to generate search index: ${message}`)
    process.exit(1)
  }
}

void generateAndPersistSearchIndex()
