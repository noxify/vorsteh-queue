import { buildDocsSnapshotJsonl } from "@/lib/docs-snapshot"

export const dynamic = "force-static"
export const runtime = "nodejs"

export async function GET(): Promise<Response> {
  const jsonl = await buildDocsSnapshotJsonl()

  return new Response(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  })
}
