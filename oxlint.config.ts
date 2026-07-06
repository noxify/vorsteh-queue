import { defineConfig } from "oxlint"
import core from "ultracite/oxlint/core"
import next from "ultracite/oxlint/next"
import react from "ultracite/oxlint/react"
import vitest from "ultracite/oxlint/vitest"

export default defineConfig({
  extends: [core, vitest, react, next],
  ignorePatterns: [
    "apps/docs/src/components/beautiful-mermaid/**",
    "packages/server/src/ui/routeTree.gen.ts",
    "packages/server/src/ui/graphql-env.d.ts",
  ],

  overrides: [
    {
      files: ["examples/**/*.ts"],
      rules: {
        "no-console": "off",
        "no-restricted-properties": "off",
        "no-await-in-loop": "off",
        "no-plusplus": "off",
        "no-promise-executor-return": "off",
        "promise/avoid-new": "off",
        "promise/prefer-await-to-then": "off",
        "promise/prefer-await-to-callbacks": "off",
        "react-doctor/async-parallel": "off",
        "react-doctor/async-await-in-loop": "off",
        "react-doctor/async-defer-await": "off",
        "react-doctor/server-sequential-independent-await": "off",
      },
    },
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

    // react-compiler: disable until we actually adopt React Compiler
    "react/react-compiler": "off",

    // react: downgrade rules that fire on established patterns in the codebase
    "react/no-danger": "warn",
    "react/no-clone-element": "warn",
    "react/no-react-children": "warn",
    "react/jsx-pascal-case": "off",
    "react/state-in-constructor": "off",
    "react/jsx-no-constructed-context-values": "warn",
    "react/hook-use-state": "warn",
    "react/button-has-type": "warn",
    "react/jsx-no-useless-fragment": "warn",

    // unicorn: downgrade new rules
    "unicorn/prefer-number-coercion": "warn",
    "unicorn/prefer-export-from": "warn",

    // react-doctor: disable React Compiler rules (not using React Compiler yet)
    "react-doctor/react-compiler-no-manual-memoization": "off",

    // react-doctor: disable React 19 migration rules (not on React 19 yet)
    "react-doctor/no-react19-deprecated-apis": "off",

    // react-doctor: warn for performance suggestions
    "react-doctor/async-parallel": "warn",
    "react-doctor/async-await-in-loop": "warn",
    "react-doctor/async-defer-await": "warn",
    "react-doctor/server-sequential-independent-await": "warn",
    "react-doctor/server-hoist-static-io": "warn",
    "react-doctor/js-set-map-lookups": "warn",

    // react-doctor: warn for component structure suggestions
    "react-doctor/no-giant-component": "warn",
    "react-doctor/only-export-components": "warn",
    "react-doctor/no-barrel-import": "warn",
    "react-doctor/no-polymorphic-children": "warn",
    "react-doctor/prefer-module-scope-pure-function": "warn",
    "react-doctor/prefer-module-scope-static-value": "warn",
    "react-doctor/rerender-state-only-in-handlers": "warn",
    "react-doctor/rerender-memo-with-default-value": "warn",
    "react-doctor/no-render-in-render": "warn",
    "react-doctor/no-cascading-set-state": "warn",
    "react-doctor/no-array-index-as-key": "warn",
    "react-doctor/no-derived-useState": "warn",
    "react-doctor/no-derived-state": "warn",
    "react-doctor/no-initialize-state": "warn",
    "react-doctor/rendering-hydration-no-flicker": "warn",
    "react-doctor/rendering-hydration-mismatch-time": "warn",
    "react-doctor/auth-token-in-web-storage": "warn",

    // react-doctor: warn for iteration optimizations
    "react-doctor/js-flatmap-filter": "warn",
    "react-doctor/js-combine-iterations": "warn",
  },
})
