import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../shared/src'),
    },
  },

  server: {
    host: true,
    port: 3002,

    // 🔥 erlaubt Zugriff über deine Domain
    allowedHosts: ['exmerg.de', 'www.exmerg.de'],

    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
})