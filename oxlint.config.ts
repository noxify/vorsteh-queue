import { defineConfig } from "oxlint"
import core from "ultracite/oxlint/core"
import next from "ultracite/oxlint/next"
import react from "ultracite/oxlint/react"

export default defineConfig({
  extends: [core, react, next],
  ignorePatterns: [
    ...core.ignorePatterns,
    "apps/docs/src/components/beautiful-mermaid/**",
  ],
  rules: {
    // Style preferences that conflict with the project's established patterns
    "func-style": "off",
    "sort-keys": "off",
    "no-inline-comments": "off",
    "no-promise-executor-return": "off",
    "no-nested-ternary": "off",

    // Async patterns: test handlers, memory adapter (sync impl of async interface),
    // and sequential loops are intentional
    "require-await": "off",
    "no-await-in-loop": "off",

    // Promise patterns: new Promise is used in enqueueAndWait and test utilities,
    // .then() is used for fire-and-forget
    "promise/avoid-new": "off",
    "promise/prefer-await-to-then": "off",

    // Function hoisting is standard in TypeScript
    "no-use-before-define": "off",

    // React/JSX: conflicts with renoun MDX components and shadcn/ui
    "react/react-compiler": "off",
    "react/jsx-pascal-case": "off",
    "react/state-in-constructor": "off",
    "jsx-a11y/prefer-tag-over-role": "off",
    "jsx-a11y/control-has-associated-label": "off",

    // Unicorn: no-nested-ternary duplicates eslint rule
    "unicorn/no-nested-ternary": "off",

    // Callback patterns in examples and CLI are intentional (process signal handlers)
    "promise/prefer-await-to-callbacks": "off",

    // no-plusplus in examples is fine (for loops)
    "no-plusplus": "off",

    // Unicode regexp flag is not relevant for test assertions and simple patterns
    "require-unicode-regexp": "off",

    // Import after vi.mock() is required by vitest for mock hoisting
    "import/first": "off",
  },
})
