import path from "path"
import { createJiti } from "jiti"

import type { Queue } from "@vorsteh-queue/core"

const DEFAULT_MODULE = "./demo-queue-config.ts"

export default async function loadQueueConfig(): Promise<Queue[]> {
  let rawModule = process.env.QUEUE_CONFIG?.trim()

  const jiti = createJiti(import.meta.url)

  if (!rawModule) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[loadQueues] No QUEUE_CONFIG provided. Returning empty queue list.")

      return []
    } else {
      console.warn(
        `[loadQueues] Using development default module '${DEFAULT_MODULE}'. Set QUEUE_CONFIG to override.`,
      )
      rawModule = DEFAULT_MODULE
    }
  }

  const configFilePath = path.resolve(process.cwd(), rawModule)

  //console.log(`[loadQueues] Loading queue config from '${configFilePath}'`)

  try {
    return await jiti.import(configFilePath, { default: true })
  } catch (err: any) {
    console.warn(
      `[loadQueues] Failed to import '${configFilePath}'. Returning empty list.`,
      err?.message || err,
    )
    return []
  }
}
