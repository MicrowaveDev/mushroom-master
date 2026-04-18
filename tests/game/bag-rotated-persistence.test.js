// Server-side invariants for the bag rotated column.
// See docs/bag-rotated-persistence.md for the design.
//
// Mirrors bag-active-persistence.test.js — the two columns follow the
// same pattern (default 0 on fresh insert, flipped via PUT /artifact-
// loadout, preserved across copy-forward, exposed on the read side so
// the client projection routes it correctly).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyRunShopItem,
  applyRunLoadoutPlacements,
  resolveRound,
  getActiveGameRun
} from '../../app/server/services/game-service.js';
import { query } from '../../app/server/db.js';
import { freshDb, bootRun, forceShopOffer } from './helpers.js';

async function readBagRotated(runId, playerId, artifactId, roundNumber) {
  const res = await query(
    `SELECT rotated FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND artifact_id = $3 AND round_number = $4`,
    [runId, playerId, artifactId, roundNumber]
  );
  return res.rowCount ? Number(res.rows[0].rotated) : null;
}

async function getStarterRows(playerId) {
  const active = await getActiveGameRun(playerId);
  return active.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0 && !i.bagId);
}

function starterEntries(starterRows) {
  return starterRows.map((r) => ({
    id: r.id,
    artifactId: r.artifactId,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height
  }));
}

test('[bag-rotated] freshly bought bag lands with rotated=0', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 7001 });
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  await buyRunShopItem(playerId, run.id, 'moss_pouch');
  assert.equal(await readBagRotated(run.id, playerId, 'moss_pouch', 1), 0);
});

test('[bag-rotated] applyRunLoadoutPlacements toggles rotated through a bag entry', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 7002 });
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch');
  const starters = starterEntries(await getStarterRows(playerId));

  // Flip rotated ON.
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starters,
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1,
      y: -1,
      width: 1,
      height: 2,
      active: 1,
      rotated: 1
    }
  ]);
  assert.equal(await readBagRotated(run.id, playerId, 'moss_pouch', 1), 1);

  // Flip rotated OFF — omitting the field must reset the row.
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starters,
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1,
      y: -1,
      width: 1,
      height: 2,
      active: 1
      // no rotated — server must default to 0
    }
  ]);
  assert.equal(await readBagRotated(run.id, playerId, 'moss_pouch', 1), 0);
});

test('[bag-rotated] round copy-forward preserves the rotated flag', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 7003 });
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch');
  const starters = starterEntries(await getStarterRows(playerId));
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starters,
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1,
      y: -1,
      width: 1,
      height: 2,
      active: 1,
      rotated: 1
    }
  ]);
  assert.equal(await readBagRotated(run.id, playerId, 'moss_pouch', 1), 1);

  await resolveRound(playerId, run.id);

  // Round 1 stays frozen as history — rotated=1 on that row.
  assert.equal(await readBagRotated(run.id, playerId, 'moss_pouch', 1), 1);
  // Round 2 must inherit rotated=1 from the copy-forward.
  assert.equal(await readBagRotated(run.id, playerId, 'moss_pouch', 2), 1);
});

test('[bag-rotated] getActiveGameRun exposes rotated in loadoutItems', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 7004 });
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch');

  const before = await getActiveGameRun(playerId);
  assert.equal(before.loadoutItems.find((i) => i.id === bought.id).rotated, false);

  const starters = starterEntries(before.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0 && !i.bagId));
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starters,
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1,
      y: -1,
      width: 1,
      height: 2,
      active: 1,
      rotated: 1
    }
  ]);

  const after = await getActiveGameRun(playerId);
  assert.equal(after.loadoutItems.find((i) => i.id === bought.id).rotated, true);
});

test('[bag-rotated] non-bag rows stay rotated=0 even if the client lies', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 7005 });
  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);
  const bought = await buyRunShopItem(playerId, run.id, 'bark_plate');

  const starters = starterEntries(await getStarterRows(playerId));
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starters,
    {
      id: bought.id,
      artifactId: 'bark_plate',
      x: 2,
      y: 0,
      width: 1,
      height: 1,
      rotated: 1
    }
  ]);

  assert.equal(
    await readBagRotated(run.id, playerId, 'bark_plate', 1),
    0,
    'non-bag row must stay rotated=0 regardless of client payload'
  );
});
