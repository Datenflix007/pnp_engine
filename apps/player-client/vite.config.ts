import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.PNP_ENGINE_SERVER_URL ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
