import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'renderer/overlay',
  base: '/',
  publicDir: path.resolve(__dirname, 'public'),
  cacheDir: path.resolve(__dirname, 'node_modules/.vite-overlay'),
  plugins: [
    react({
      fastRefresh: false,
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/public/replays/**'],
    },
  },
  build: {
    outDir: '../../dist/overlay',
    emptyOutDir: true,
  },
});
