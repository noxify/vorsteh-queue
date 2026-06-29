import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: ["packages/*"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "*.config.(mjs|js|ts)", "vitest.config/"],
    },
  },
})
