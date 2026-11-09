import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  plugins: [react()],
  // Server credentials must never be injected into the browser bundle.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
