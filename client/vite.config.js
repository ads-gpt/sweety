import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { SECURITY_HEADERS } from './security-headers.js';

const api = { '/api': process.env.VITE_API_TARGET || 'http://localhost:4000' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { port: 5173, proxy: api },
  // `vite preview` serves the production build with the same strict headers as nginx.
  preview: { port: 4173, proxy: api, headers: SECURITY_HEADERS },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
  },
});
