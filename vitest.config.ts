import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.d.ts", "*.config.(mjs|js|ts)", "vitest.config/"],
      include: ["packages/*/src/**/*.{ts,tsx}"],
      provider: "v8",
    },
    environment: "node",
    projects: ["packages/*"],
  },
})
