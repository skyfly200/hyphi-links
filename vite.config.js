import { defineConfig } from 'vite'

export default defineConfig({
  // No framework needed — admin is plain HTML in public/
  // Vite just copies public/ to dist/ on build
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
