import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve('/Users/microwavedev/workspace/mushroom-master/web'),
  server: {
    host: '127.0.0.1',
    port: 4174,
    proxy: {
      '/api': 'http://127.0.0.1:3021',
      '/data': 'http://127.0.0.1:3021'
    }
  },
  build: {
    outDir: path.resolve('/Users/microwavedev/workspace/mushroom-master/web/dist'),
    emptyOutDir: true
  }
});
