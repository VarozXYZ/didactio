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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/@tiptap/') || id.includes('/prosemirror-') || id.includes('/lowlight/')) {
            return 'editor-vendor'
          }

          if (
            id.includes('/unified/') ||
            id.includes('/remark-') ||
            id.includes('/rehype-') ||
            id.includes('/mdast-') ||
            id.includes('/micromark') ||
            id.includes('/html-react-parser/')
          ) {
            return 'content-vendor'
          }

          if (id.includes('/recharts/') || id.includes('/d3-')) {
            return 'charts-vendor'
          }

          if (id.includes('/motion/') || id.includes('/framer-motion/') || id.includes('/motion-dom/')) {
            return 'motion-vendor'
          }

          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth/google': 'http://localhost:3000',
      '/auth/refresh': 'http://localhost:3000',
      '/auth/logout': 'http://localhost:3000',
      '/auth/me': 'http://localhost:3000',
      '/auth/credits': 'http://localhost:3000',
    },
  },
})
