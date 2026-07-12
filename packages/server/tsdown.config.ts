import { defineConfig } from "tsdown"

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: {
    build: true,
  },
  entry: ["src/index.ts"],
})
