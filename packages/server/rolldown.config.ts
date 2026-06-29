import { defineConfig } from "rolldown"
import del from "rollup-plugin-delete"

export default defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  external: [
    /node_modules/u,
    "@vorsteh-queue/core",
    "@pothos/core",
    "@hono/node-server",
    "graphql",
    "graphql-yoga",
    "hono",
  ],
  plugins: [del({ targets: "dist/*", runOnce: true })],
})
