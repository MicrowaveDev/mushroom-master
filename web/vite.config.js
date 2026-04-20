import { defineConfig } from 'vite';
import path from 'path';
import { repoRoot } from '../app/shared/repo-root.js';

const devPort = Number(process.env.VITE_DEV_PORT || '4174');
const backendOrigin = process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:3021';

const proxy = {
  '/api': backendOrigin,
  '/data': backendOrigin
};

export default defineConfig({
  root: path.resolve(repoRoot, 'web'),
  server: {
    host: '127.0.0.1',
    port: devPort,
    proxy
  },
  preview: {
    host: '127.0.0.1',
    port: devPort,
    proxy
  },
  build: {
    outDir: path.resolve(repoRoot, 'web/dist'),
    emptyOutDir: true
  }
});
