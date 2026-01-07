import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import pkg from './package.json'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode === 'analyze' &&
      visualizer({
        filename: 'bundle-stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:13000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
}))
