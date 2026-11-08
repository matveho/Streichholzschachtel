import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/local-api': {
        target: process.env.BASIS_DEV_BACKEND_URL || 'http://127.0.0.1:8789',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-api/, ''),
      },
    },
  },
})
