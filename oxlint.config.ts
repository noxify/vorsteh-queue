import { defineConfig } from "oxlint"
import core from "ultracite/oxlint/core"
import next from "ultracite/oxlint/next"
import react from "ultracite/oxlint/react"
import vitest from "ultracite/oxlint/vitest"

export default defineConfig({
  extends: [core, vitest, react, next],
  ignorePatterns: [
    "apps/docs/src/components/beautiful-mermaid/**",
    "templates/stackblitz/**",
  ],

  overrides: [
    {
      files: [
        "apps/docs/src/app/**/*.{ts,tsx}",
        "packages/cli/src/**/*.ts",
        "packages/query-builder/src/**/*.ts",
        "packages/trino-client/src/**/*.ts",
      ],
      rules: {
        "no-use-before-define": [
          "error",
          {
            allowNamedExports: true,
            functions: false,
            ignoreTypeReferences: true,
          },
        ],
      },
    },
  ],
  rules: {
    "jsx-a11y/prefer-tag-over-role": "off",
    "jsx-a11y/control-has-associated-label": "off",
    "func-style": "off",
    "no-console": "error",
    "no-inline-comments": "off",
    "no-nested-ternary": "off",
    // Keep disabled globally; re-enable selectively via overrides for runtime-heavy paths.
    "no-use-before-define": "off",
    "no-restricted-imports": [
      "error",
      {
        importNames: ["env"],
        message:
          "Use `import { env } from '~/env'` instead to ensure validated types.",
        name: "process",
      },
    ],
    "no-restricted-properties": [
      "error",
      {
        message:
          "Use `import { env } from '~/env'` instead to ensure validated types.",
        object: "process",
        property: "env",
      },
    ],
    "require-await": "off",
    "sort-keys": "off",
    "unicorn/no-nested-ternary": "off",
  },
})
