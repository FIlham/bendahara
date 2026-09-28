import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Nitro handles SSR output for all targets (node locally,
    // Vercel preset auto-detected on Vercel).
    nitro(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
})
