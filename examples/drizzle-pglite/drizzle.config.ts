import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/queue_event",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
})
