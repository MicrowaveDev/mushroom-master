import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGeesomeAssetProvider as createCoreGeesomeAssetProvider,
  hydrateGeesomeAssetManifest,
  readGeesomeAssetManifest
} from '@microwavedev/backpack-game-core/tooling/geesome-assets';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const geesomeCharacterAssetManifestPath = path.join(repoRoot, 'app', 'shared', 'geesome-character-assets.json');
export const geesomeCharacterAssetCacheDir = '.cache/game-assets/geesome';
const portraitRoot = path.join(repoRoot, 'web', 'public', 'portraits');
const mimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
]);

function imageFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (mimeTypes.has(path.extname(entry.name).toLowerCase())) files.push(entryPath);
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export function createGeesomeAssetProvider(options = {}) {
  return createCoreGeesomeAssetProvider({
    ...options,
    remoteRoot: 'games/mushroom-master/character-assets'
  });
}

export function characterAssetFilesForPublication() {
  return imageFiles(portraitRoot).map((filePath) => {
    const relativePath = path.relative(portraitRoot, filePath).split(path.sep).join('/');
    return {
      id: `runtime:portrait:${relativePath}`,
      kind: 'runtime',
      filePath,
      targetPath: `web/public/portraits/${relativePath}`,
      mimeType: mimeTypes.get(path.extname(filePath).toLowerCase()),
      metadata: { domain: 'character-portrait', relativePath }
    };
  });
}

export function readGeesomeCharacterAssetManifest({ required = false } = {}) {
  return readGeesomeAssetManifest({
    manifestPath: geesomeCharacterAssetManifestPath,
    required
  });
}

export function hydrateGeesomeCharacterAssets({ offline = false, fetchImpl } = {}) {
  return hydrateGeesomeAssetManifest({
    repoRoot,
    manifestPath: geesomeCharacterAssetManifestPath,
    kinds: ['runtime'],
    cacheDir: geesomeCharacterAssetCacheDir,
    server: process.env.GEESOME_URL,
    offline,
    fetchImpl
  });
}
