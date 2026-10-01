import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * One config for both concerns:
 *  - `build`  → the static site Vercel serves from `dist/`
 *  - `test`   → Vitest in jsdom, used only for the React component tests
 *               (the pure core is covered separately by `node --test`)
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.jsx'],
    css: false
  }
});
