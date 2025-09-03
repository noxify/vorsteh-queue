import { defineConfig } from "rolldown"
import del from "rollup-plugin-delete"

export default defineConfig({
  input: {
    index: "src/index.ts",
    "postgres-adapter": "src/postgres-adapter.ts",
    migrations: "src/migrations/queue_table.ts",
    types: "src/types.ts",
  },
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
  },
  plugins: [del({ targets: "dist/*" })],
  external: ["@vorsteh-queue/core", "kysely"],
})
