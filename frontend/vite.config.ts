import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,

    proxy: {
      // Порядок важен: более специфичные правила выше

      // Auth Service — аутентификация и админка пользователей
      '/api/v1/auth': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/api/v1/admin/users': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },

      // Gamification Service — админка квестов/бейджей/XP + остальное
      '/api/v1/admin/quests': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      '/api/v1/admin/badges': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      '/api/v1/admin/xp': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
    },

    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "connect-src 'self' ws://localhost:3000",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "script-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://avatars.githubusercontent.com",
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
