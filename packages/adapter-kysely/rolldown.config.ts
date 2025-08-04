import { defineConfig } from "rolldown"
import del from "rollup-plugin-delete"

export default defineConfig({
  input: {
    index: "src/index.ts",
    "postgres-adapter": "src/postgres-adapter.ts",
    "postgres-schema": "src/postgres-schema.ts",
  },
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
  },
  plugins: [del({ targets: "dist/*" })],
  external: [
    "@vorsteh-queue/core",
    "drizzle-orm",
    "drizzle-orm/mysql2",
    "drizzle-orm/node-postgres",
    "drizzle-orm/pglite",
    "drizzle-orm/postgres-js",
  ],
})
