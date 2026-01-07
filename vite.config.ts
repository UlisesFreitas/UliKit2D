import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

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
    port: 5175,
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
