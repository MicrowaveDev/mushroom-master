#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { hydrateGeesomeCharacterAssets } from '../lib/geesome-character-assets.js';

export function hydrateCharacterAssets() {
  return hydrateGeesomeCharacterAssets({
    offline: process.env.MUSHROOM_MASTER_ASSET_OFFLINE === 'true'
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  hydrateCharacterAssets().then((result) => {
    process.stdout.write(`Mushroom character assets hydrated: ${result.fetchedCount} fetched, ${result.cacheHits} cache hits, ${result.materializedCount} materialized.\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
