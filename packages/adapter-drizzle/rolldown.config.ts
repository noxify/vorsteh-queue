import { defineConfig } from 'rolldown'
import del from 'rollup-plugin-delete'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js'
  },
  plugins: [
    del({ targets: 'dist/*' })
  ],
  external: [
    '@vorsteh-queue/core',
    'drizzle-orm',
    'drizzle-orm/mysql2',
    'drizzle-orm/node-postgres',
    'drizzle-orm/pglite',
    'drizzle-orm/postgres-js'
  ],
  declaration: true
})