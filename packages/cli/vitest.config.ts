import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    disableConsoleIntercept: true,
    environment: "node",
    globals: true,
  },
})
