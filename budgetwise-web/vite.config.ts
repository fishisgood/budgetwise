// Vite configuration file for React project.
// Sets up React plugin, API proxy to backend, and build output settings.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to backend server at localhost:3000
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',      // Output directory for build
    emptyOutDir: true    // Clean output directory before build
  }
})