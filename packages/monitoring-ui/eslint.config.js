import baseConfig, { restrictEnvAccess } from "@vorsteh-queue/eslint-config/base"
import reactConfig from "@vorsteh-queue/eslint-config/react"

/** @type {import('typescript-eslint').Config} */
export default [...baseConfig, ...reactConfig, ...restrictEnvAccess]
