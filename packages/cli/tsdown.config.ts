import { defineConfig } from "tsdown"

export default defineConfig([
  {
    deps: {
      skipNodeModulesBundle: true,
    },
    dts: true,
    entry: ["src/index.ts", "src/bin.ts"],
  },
  {
    deps: {
      skipNodeModulesBundle: true,
    },
    dts: true,
    entry: ["src/commands-metadata.ts"],
  },
])
