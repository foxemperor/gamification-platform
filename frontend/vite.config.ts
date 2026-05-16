import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,

    proxy: {
      // ВСЕ /api/v1/* идёт через API Gateway :8000
      // Gateway сам раздаёт на auth-service :8001, gamification-service :8002 и т.д.
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },

      // Health-эндпоинты сервисов для admin monitoring panel
      '/_monitor/auth': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/_monitor\/auth/, '/health'),
      },
      '/_monitor/gamification': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/_monitor\/gamification/, '/health'),
      },
    },

    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "connect-src 'self' ws://localhost:3000",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "script-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },

  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          state:   ['zustand'],
          network: ['axios', '@tanstack/react-query'],
        },
      },
    },
  },
})
