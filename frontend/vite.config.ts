import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,

    proxy: {
      // Auth service — direct until Gateway proxy is implemented
      '/api/v1/auth': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // Gamification service — direct until Gateway proxy is implemented
      '/api/v1': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
    },

    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        // Vite dev proxy — all API calls go through localhost:3000, no external origins needed
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
