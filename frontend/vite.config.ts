import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    headers: {
      // Content-Security-Policy for dev server
      // Tightened for production via Nginx — this covers local dev
      'Content-Security-Policy': [
        "default-src 'self'",
        // Vite HMR WebSocket
        "connect-src 'self' ws://localhost:3000 http://localhost:8000",
        // Google Fonts
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        // Inline scripts (Vite dev + our anti-flash snippet)
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
    // Production: strip source maps to avoid leaking source code
    sourcemap: false,
    rollupOptions: {
      output: {
        // Code splitting: vendor chunk separate from app code
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          state:   ['zustand'],
          network: ['axios', '@tanstack/react-query'],
        },
      },
    },
  },
})
