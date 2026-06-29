import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  root: "src/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "~": new URL("src/ui", import.meta.url).pathname,
    },
  },
  plugins: [tailwindcss(), react()],
})
