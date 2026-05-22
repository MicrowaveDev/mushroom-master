import test from 'node:test';
import assert from 'node:assert/strict';
import { getBootstrap } from '../../app/server/services/game-service.js';
import { resetHomeFieldConfigCache } from '../../app/server/services/home-field-config.js';
import { freshDb, createPlayer } from './helpers.js';

test('[Req 15-A, 15-L] bootstrap returns homeField config block', async () => {
  await freshDb();
  const session = await createPlayer();

  const previousEnabled = process.env.HOME_FIELD_ENABLED;
  const previousForce = process.env.HOME_FIELD_FORCE_FALLBACK;
  process.env.HOME_FIELD_ENABLED = 'true';
  process.env.HOME_FIELD_FORCE_FALLBACK = 'false';
  resetHomeFieldConfigCache();

  try {
    const bootstrap = await getBootstrap(session.player.id);
    assert.ok(bootstrap.homeField, 'bootstrap.homeField must be present');
    assert.equal(bootstrap.homeField.enabled, true, 'enabled honors HOME_FIELD_ENABLED');
    assert.equal(bootstrap.homeField.renderer, 'phaser', 'renderer defaults to phaser');
    assert.equal(bootstrap.homeField.forceFallback, false, 'forceFallback honors env');
    assert.match(bootstrap.homeField.mapVersion, /^home_field_v\d+$/, 'mapVersion has expected shape');
    assert.match(bootstrap.homeField.assetVersion, /^[0-9a-f]{8}$/, 'assetVersion is 8-char hex');
  } finally {
    process.env.HOME_FIELD_ENABLED = previousEnabled;
    process.env.HOME_FIELD_FORCE_FALLBACK = previousForce;
    resetHomeFieldConfigCache();
  }
});

test('[Req 15-L] bootstrap honors HOME_FIELD_FORCE_FALLBACK kill switch', async () => {
  await freshDb();
  const session = await createPlayer();

  const previousEnabled = process.env.HOME_FIELD_ENABLED;
  const previousForce = process.env.HOME_FIELD_FORCE_FALLBACK;
  process.env.HOME_FIELD_ENABLED = 'true';
  process.env.HOME_FIELD_FORCE_FALLBACK = 'true';
  resetHomeFieldConfigCache();

  try {
    const bootstrap = await getBootstrap(session.player.id);
    assert.equal(bootstrap.homeField.enabled, true);
    assert.equal(bootstrap.homeField.forceFallback, true, 'force-fallback flag surfaces in bootstrap so client renders legacy dashboard');
  } finally {
    process.env.HOME_FIELD_ENABLED = previousEnabled;
    process.env.HOME_FIELD_FORCE_FALLBACK = previousForce;
    resetHomeFieldConfigCache();
  }
});
