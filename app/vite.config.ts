/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The label reader runs as a Cloudflare Pages Function. In `npm run dev` (Vite on 5173)
// /api is proxied to `npm run dev:api` (wrangler on 8788). Without it, /api calls fail
// and the app must fall back to "type the name" — which it has to handle anyway.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8788' },
  },
  preview: { port: 4173 },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
