import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  dts: {
    build: true,
  },
  deps: {
    skipNodeModulesBundle: true,
  },
})
