import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/queue_db",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
})
