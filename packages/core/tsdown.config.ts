import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/adapters/memory.ts"],
  dts: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
