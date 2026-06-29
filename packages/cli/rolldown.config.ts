import { defineConfig } from "rolldown"
import del from "rollup-plugin-delete"

export default defineConfig({
  input: {
    index: "src/index.ts",
    bin: "src/bin.ts",
  },
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
  },
  external: [/node_modules/u, "@vorsteh-queue/core", "citty", "consola"],
  plugins: [del({ targets: "dist/*", runOnce: true })],
})
