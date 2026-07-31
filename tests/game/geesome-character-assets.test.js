import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  characterAssetFilesForPublication,
  createGeesomeAssetProvider,
  readGeesomeCharacterAssetManifest
} from '../../app/scripts/lib/geesome-character-assets.js';

test('Mushroom configures its portrait catalog for shared Geesome tooling', () => {
  const assets = characterAssetFilesForPublication();
  assert.ok(assets.length > 0);
  assert.equal(new Set(assets.map((entry) => entry.id)).size, assets.length);
  assert.ok(assets.every((entry) => entry.kind === 'runtime'));
  assert.ok(assets.every((entry) => entry.targetPath.startsWith('web/public/portraits/')));
  assert.ok(assets.every((entry) => fs.existsSync(entry.filePath)));
  const manifest = readGeesomeCharacterAssetManifest();
  assert.ok(manifest === null || manifest.provider === 'geesome');
});

test('Mushroom supplies only its remote namespace to the core provider', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mushroom-geesome-'));
  const filePath = path.join(root, 'portrait.png');
  fs.writeFileSync(filePath, 'portrait');
  try {
    const provider = createGeesomeAssetProvider({
      server: 'https://geesome.example',
      apiKey: 'secret',
      fetchImpl: async (_url, options = {}) => {
        assert.equal(options.body.get('path'), '/games/mushroom-master/character-assets/web/public/portraits/fighter/default.png');
        return new Response(JSON.stringify({ storageId: 'bafkreimushroomportrait' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    });
    assert.deepEqual(await provider.publishAsset({
      id: 'runtime:portrait:fighter/default.png',
      filePath,
      targetPath: 'web/public/portraits/fighter/default.png',
      mimeType: 'image/png'
    }), { storageId: 'bafkreimushroomportrait' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
