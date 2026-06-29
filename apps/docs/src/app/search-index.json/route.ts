import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { cwd, env } from "node:process"

import { create, insertMultiple } from "@orama/orama"
import { persist } from "@orama/plugin-data-persistence"
import type { NextRequest } from "next/server"

import { buildSearchDocuments, getAllSearchableEntries } from "@/orama/builder"

export const dynamic = "force-static"
export const runtime = "nodejs"

const DEV_INDEX_CACHE_FILE = path.join(
  cwd(),
  ".next",
  "dev",
  "cache",
  "search-index.json"
)

async function buildPersistedSearchIndexJson(): Promise<string> {
  const entries = await getAllSearchableEntries()
  const docs = await buildSearchDocuments(entries)

  const db = create({
    schema: {
      page_id: "string",
      type: "enum" as const,
      title: "string",
      section: "string",
      heading: "string",
      content: "string",
      url: "string",
      breadcrumb: "string",
    },
  })
  await insertMultiple(db, docs)
  const snapshot = await persist(db, "json")
  return typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot)
}

export async function GET(request: NextRequest) {
  const isDev = env.NODE_ENV === "development"
  const forceUpdate = request.nextUrl.searchParams.get("update") === "true"

  if (isDev && !forceUpdate && existsSync(DEV_INDEX_CACHE_FILE)) {
    const cached = readFileSync(DEV_INDEX_CACHE_FILE, "utf-8")
    return new Response(cached, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  }

  const snapshotJson = await buildPersistedSearchIndexJson()

  // Nur in dev als lokale Cache-Datei schreiben.
  // Production/export erzeugt sein eigenes statisches Artefakt ohne dev-Datei.
  if (isDev) {
    mkdirSync(path.dirname(DEV_INDEX_CACHE_FILE), { recursive: true })
    writeFileSync(DEV_INDEX_CACHE_FILE, snapshotJson)
  }

  return new Response(snapshotJson, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}
