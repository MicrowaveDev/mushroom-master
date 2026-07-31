#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { publishGeesomeAssetManifest } from '@microwavedev/backpack-game-core/tooling/geesome-assets';
import {
  characterAssetFilesForPublication,
  createGeesomeAssetProvider,
  geesomeCharacterAssetManifestPath
} from '../lib/geesome-character-assets.js';

export function publishCharacterAssetsToGeesome({ fetchImpl } = {}) {
  return publishGeesomeAssetManifest({
    assets: characterAssetFilesForPublication(),
    provider: createGeesomeAssetProvider({
      server: process.env.GEESOME_URL,
      apiKey: process.env.GEESOME_API_KEY,
      fetchImpl
    }),
    manifestPath: geesomeCharacterAssetManifestPath
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  publishCharacterAssetsToGeesome().then((manifest) => {
    process.stdout.write(`Published and verified ${manifest.assets.length} Mushroom character assets in Geesome.\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
