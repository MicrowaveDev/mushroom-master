/**
 * Server-side config for the Home Field hub.
 *
 * Exposes the small block included in /api/bootstrap so the client knows whether to
 * mount the Phaser hub or fall back to the legacy dashboard, and so the renderer can
 * cache-bust asset fetches via the assetVersion query string.
 *
 * Env vars:
 *   HOME_FIELD_ENABLED         "true" => hub enabled (default "false" for v1 rollout)
 *   HOME_FIELD_RENDERER        "phaser" only valid value for v1 (default "phaser")
 *   HOME_FIELD_FORCE_FALLBACK  "true" => emergency kill switch; client renders legacy
 *
 * assetVersion is computed once at module load from sha1 of the two source JSONs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const sharedDir = path.resolve(path.dirname(__filename), '..', '..', 'shared', 'home-field');
const MAP_PATH = path.join(sharedDir, 'home-field-map.json');
const ASSETS_PATH = path.join(sharedDir, 'home-field-assets.json');

let cachedAssetVersion = null;
let cachedMapVersion = null;

function computeAssetVersion() {
  if (cachedAssetVersion) return cachedAssetVersion;
  try {
    const a = fs.readFileSync(ASSETS_PATH);
    const m = fs.readFileSync(MAP_PATH);
    cachedAssetVersion = crypto
      .createHash('sha1')
      .update(a)
      .update(m)
      .digest('hex')
      .slice(0, 8);
  } catch {
    cachedAssetVersion = '00000000';
  }
  return cachedAssetVersion;
}

function computeMapVersion() {
  if (cachedMapVersion) return cachedMapVersion;
  try {
    const json = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    cachedMapVersion = `home_field_v${json.version || 1}`;
  } catch {
    cachedMapVersion = 'home_field_v1';
  }
  return cachedMapVersion;
}

export function getHomeFieldConfig() {
  const enabled = process.env.HOME_FIELD_ENABLED === 'true';
  const forceFallback = process.env.HOME_FIELD_FORCE_FALLBACK === 'true';
  const renderer = process.env.HOME_FIELD_RENDERER || 'phaser';
  return {
    enabled,
    renderer,
    forceFallback,
    mapVersion: computeMapVersion(),
    assetVersion: computeAssetVersion()
  };
}

export function resetHomeFieldConfigCache() {
  cachedAssetVersion = null;
  cachedMapVersion = null;
}
