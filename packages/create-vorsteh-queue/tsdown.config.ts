import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  deps: {
    skipNodeModulesBundle: true,
  },
})
