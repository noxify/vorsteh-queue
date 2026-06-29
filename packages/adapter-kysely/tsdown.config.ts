import { defineConfig } from "tsdown"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/postgres-adapter.ts",
    "src/migrations/queue-table.ts",
    "src/types.ts",
  ],
  dts: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
