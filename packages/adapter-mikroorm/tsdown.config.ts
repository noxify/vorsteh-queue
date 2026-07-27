import { defineConfig } from "tsdown"

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: ["src/index.ts", "src/adapter.ts", "src/queue-entity.ts"],
})
