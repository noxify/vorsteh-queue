import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/postgres-adapter.ts"],
  dts: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
