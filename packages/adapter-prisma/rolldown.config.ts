import { defineConfig } from "rolldown"
import del from "rollup-plugin-delete"

export default defineConfig({
  input: {
    index: "src/index.ts",
    // "mariadb-adapter": "src/mariadb-adapter.ts",
    // "mariadb-schema": "src/mariadb-schema.ts",
    // "postgres-adapter": "src/postgres-adapter.ts",
    // "postgres-schema": "src/postgres-schema.ts",
  },
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
  },
  plugins: [del({ targets: "dist/*" })],
  external: ["@vorsteh-queue/core", "prisma", "@prisma/client", "./src/generated"],
})
