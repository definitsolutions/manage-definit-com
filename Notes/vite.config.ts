import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  base: '/notes/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5179,
    proxy: {
      '/notes/api': {
        target: 'http://localhost:3009',
        rewrite: (path) => path.replace(/^\/notes/, ''),
      },
    },
  },
});
