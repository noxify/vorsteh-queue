import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig, Plugin } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths() as unknown as Plugin],
  test: {
    environment: "node",
  },
})
