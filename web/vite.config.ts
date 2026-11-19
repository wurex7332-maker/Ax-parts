import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// HashRouter + base:'./' 让构建产物可被静态服务器在任意子路径直接打开（AC-6）。
// /api 代理仅用于 http 模式联调：后端未启用 CORS，且要求自定义头 X-Actor，
// 浏览器直连必然被预检拦截，因此必须走代理（见 TECH-PLAN §7）。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
