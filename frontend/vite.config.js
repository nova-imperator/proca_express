import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During dev, Vite serves the React app on :3000 and proxies /api/* to the
// Express backend on :5000. This keeps everything same-origin from the
// browser's perspective so httpOnly cookies just work — no CORS dance.
// In production nginx does the equivalent proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:5000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
