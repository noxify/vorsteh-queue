import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig, Plugin } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: ["packages/*"],
    environment: "node",
    coverage: {
      provider: "v8",
      all: true,
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "*.config.(mjs|js|ts)", "vitest.config/"],
    },
  },
})
