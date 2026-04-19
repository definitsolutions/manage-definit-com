import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  base: '/callscribe/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    proxy: {
      '/callscribe/api': {
        target: 'http://localhost:3020',
        rewrite: (path) => path.replace(/^\/callscribe/, ''),
      },
    },
  },
});
