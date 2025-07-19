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
    '@date-fns/tz',
    'croner', 
    'date-fns',
    'type-fest'
  ],
  declaration: true
})