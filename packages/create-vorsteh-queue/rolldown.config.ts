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
    '@antfu/install-pkg',
    '@clack/prompts',
    'giget',
    'picocolors',
    'read-pkg',
    'terminal-link'
  ],
  declaration: true
})