import { NextResponse } from "next/server"

import { getTemplates } from "@/lib/templates"

export const dynamic = "force-static"

export async function GET() {
  const templates = await getTemplates()
  return NextResponse.json({ templates })
}
