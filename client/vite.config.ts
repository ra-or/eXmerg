import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/** Vitest-Block nur für Tests; wird beim Production-Build von Vite ignoriert. */
const vitestConfig = {
  test: {
    environment: 'jsdom' as const,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
}

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
        // Default 3004 = Dev-Server; bei Produktion wird der Client statisch ausgeliefert (Nginx → 3003).
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3004',
        changeOrigin: true,
      },
    },
  },

  ...(process.env.VITEST === 'true' ? vitestConfig : {}),
})