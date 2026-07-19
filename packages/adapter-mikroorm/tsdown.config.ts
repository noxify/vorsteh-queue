import { defineConfig } from "tsdown"

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: ["src/index.ts", "src/postgres-adapter.ts", "src/entity.ts"],
})
