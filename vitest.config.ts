import { resolve } from "path"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig, Plugin } from "vitest/config"

export default defineConfig({
  plugins: [
    // @ts-expect-error `vite-tsconfig-paths` uses vite@7 - vitest uses `vite@6``
    //                  which produces the following error
    //                  `error TS2769: No overload matches this call`
    tsconfigPaths(),
  ],
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
