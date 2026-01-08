import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

import { readFileSync, existsSync } from 'fs';

const configPath = path.resolve(__dirname, 'ukit.config.json');
let config = { server: { host: 'localhost', port: 9222 } };

try {
  if (existsSync(configPath)) {
    const rawData = readFileSync(configPath, 'utf-8');
    config = JSON.parse(rawData);
  }
} catch (e) {
  console.warn('Failed to load ukit.config.json, using defaults', e);
}

export default defineConfig({
  plugins: [vue()],
  base: './', // Important for Electron to load assets with relative paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@zenfs/core/vfs/constants.js': path.resolve(__dirname, 'node_modules/@zenfs/core/dist/vfs/constants.js'),
    },
  },
  server: {
    host: config.server.host || 'localhost',
    port: config.server.port || 5175,
    strictPort: true,
    fs: {
      strict: false,
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['electron'], // Electron generic
  },
});
