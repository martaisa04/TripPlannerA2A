import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy al API Gateway de reservas para evitar CORS en desarrollo
      '/api/reservations': {
        target: process.env.VITE_RESERVATIONS_API_URL ?? 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reservations/, '/reservations'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
