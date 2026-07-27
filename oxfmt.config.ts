import { defineConfig } from "oxfmt"
import ultracite from "ultracite/oxfmt"

export default defineConfig({
  ...ultracite,
  ignorePatterns: ["apps/docs/src/components/beautiful-mermaid/**"],
  lineWidth: 100,
  semi: false,
  sortImports: true,
  sortPackageJson: true,
  sortTailwindcss: true,
  trailingComma: "es5",
})
