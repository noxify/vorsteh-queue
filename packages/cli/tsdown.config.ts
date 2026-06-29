import { defineConfig } from "tsdown"

export default defineConfig([
  {
    entry: ["src/index.ts", "src/bin.ts"],
    dts: true,
    deps: {
      skipNodeModulesBundle: true,
    },
  },
  {
    entry: ["src/commands-metadata.ts"],
    dts: true,
    deps: {
      skipNodeModulesBundle: true,
    },
  },
])
