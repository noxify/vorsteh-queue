import { defineConfig } from "tsdown"

export default defineConfig({
  deps: {
    skipNodeModulesBundle: true,
  },
  dts: true,
  entry: [
    "src/index.ts",
    "src/drizzle.ts",
    "src/kysely.ts",
    "src/prisma.ts",
    "src/zenstack.ts",
    "src/typeorm.ts",
  ],
})
