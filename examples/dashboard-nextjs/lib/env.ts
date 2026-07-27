import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    QUEUE_MODE: z.enum(["direct", "api"]).default("direct"),
    DATABASE_URL: z.string().url().optional(),
    QUEUE_API_URL: z.string().url().optional(),
    QUEUE_API_TOKEN: z.string().optional(),
  },
  experimental__runtimeEnv: process.env,
})
