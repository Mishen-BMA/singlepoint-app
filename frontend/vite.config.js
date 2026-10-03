import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react({ include: /\.[jt]sx?$/ })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js'
  }
});