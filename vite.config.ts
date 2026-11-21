import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples')) {
            return 'three-postfx';
          }
          if (id.includes('node_modules/three')) {
            return 'three-core';
          }
          return undefined;
        },
      },
    },
  },
});
