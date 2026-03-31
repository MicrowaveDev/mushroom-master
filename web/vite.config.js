import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve('/Users/microwavedev/workspace/mushroom-master/web'),
  build: {
    outDir: path.resolve('/Users/microwavedev/workspace/mushroom-master/web/dist'),
    emptyOutDir: true
  }
});
