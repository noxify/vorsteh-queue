import baseConfig, { restrictEnvAccess } from "@vorsteh-queue/eslint-config/base"
import nextjsConfig from "@vorsteh-queue/eslint-config/nextjs"
import reactConfig from "@vorsteh-queue/eslint-config/react"

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
]
