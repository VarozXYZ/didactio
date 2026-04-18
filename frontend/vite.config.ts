import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth/google': 'http://localhost:3000',
      '/auth/refresh': 'http://localhost:3000',
      '/auth/logout': 'http://localhost:3000',
      '/auth/me': 'http://localhost:3000',
    },
  },
})
