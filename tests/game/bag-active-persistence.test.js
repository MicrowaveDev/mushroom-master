// Server-side invariants for the bag active column.
// See docs/bag-active-persistence.md for the design.
//
// Before this refactor, bag activation was client-only state: closing the
// page dropped every bag into the container. The fix adds an `active`
// column to game_run_loadout_items and threads it through the read/write
// path so the activation bit round-trips cleanly.
//
// These tests pin the three invariants that make persistence work:
//   1. PUT /artifact-loadout writes `active` through to the row
//   2. copyRoundForward carries `active` across round transitions
//   3. getActiveGameRun exposes `active` in the loadoutItems payload

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

async function readBagActive(runId, playerId, artifactId, roundNumber) {
  const res = await query(
    `SELECT active FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND artifact_id = $3 AND round_number = $4`,
    [runId, playerId, artifactId, roundNumber]
  );
  return res.rowCount ? Number(res.rows[0].active) : null;
}

test('[bag-active] freshly bought bag lands with active=0', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 6001 });

  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  await buyRunShopItem(playerId, run.id, 'moss_pouch');

  const stored = await readBagActive(run.id, playerId, 'moss_pouch', 1);
  assert.equal(stored, 0, 'a freshly purchased bag starts inactive (in the container)');
});

test('[bag-active] applyRunLoadoutPlacements persists active=1 on a bag entry', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 6002 });

  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch');

  // Simulate the client-side activateBag flow: PUT /artifact-loadout with
  // the bag marked as active. The server must persist active=1.
  const active = await getActiveGameRun(playerId);
  const starterRows = active.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0 && !i.bagId);
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starterRows.map((r) => ({
      id: r.id,
      artifactId: r.artifactId,
      x: r.x, y: r.y, width: r.width, height: r.height
    })),
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1, y: -1,
      width: 1, height: 2,
      active: 1
    }
  ]);

  assert.equal(await readBagActive(run.id, playerId, 'moss_pouch', 1), 1);

  // Toggle back off: the next PUT without active:1 must reset the row.
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starterRows.map((r) => ({
      id: r.id,
      artifactId: r.artifactId,
      x: r.x, y: r.y, width: r.width, height: r.height
    })),
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1, y: -1,
      width: 1, height: 2
      // no active field — server must default to 0 on bag rows
    }
  ]);

  assert.equal(await readBagActive(run.id, playerId, 'moss_pouch', 1), 0);
});

test('[bag-active] round copy-forward preserves the active flag', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 6003 });

  // Buy a bag and mark it active via the API.
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch');
  const active = await getActiveGameRun(playerId);
  const starterRows = active.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0 && !i.bagId);
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starterRows.map((r) => ({
      id: r.id,
      artifactId: r.artifactId,
      x: r.x, y: r.y, width: r.width, height: r.height
    })),
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1, y: -1,
      width: 1, height: 2,
      active: 1
    }
  ]);

  assert.equal(await readBagActive(run.id, playerId, 'moss_pouch', 1), 1);

  // Resolve the round; round 2's bag row must still be active. copyRoundForward
  // reads round 1 (including active=1) and inserts round 2 rows that carry it.
  await resolveRound(playerId, run.id);

  // Round 1 stays frozen as history — active=1 on that row.
  assert.equal(await readBagActive(run.id, playerId, 'moss_pouch', 1), 1);
  // Round 2 must inherit active=1 from the copy-forward.
  assert.equal(await readBagActive(run.id, playerId, 'moss_pouch', 2), 1);
});

test('[bag-active] getActiveGameRun exposes active in loadoutItems', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 6004 });
  await forceShopOffer(run.id, playerId, 1, ['moss_pouch']);
  const bought = await buyRunShopItem(playerId, run.id, 'moss_pouch');

  // Container bag: active should be false.
  const beforeActivate = await getActiveGameRun(playerId);
  const containerRow = beforeActivate.loadoutItems.find((i) => i.id === bought.id);
  assert.equal(containerRow.active, false);

  // Flip it on via the PUT path.
  const starterRows = beforeActivate.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0 && !i.bagId);
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starterRows.map((r) => ({
      id: r.id,
      artifactId: r.artifactId,
      x: r.x, y: r.y, width: r.width, height: r.height
    })),
    {
      id: bought.id,
      artifactId: 'moss_pouch',
      x: -1, y: -1,
      width: 1, height: 2,
      active: 1
    }
  ]);

  // Active bag: the next getActiveGameRun must report active=true so the
  // client's hydration in useAuth.js can route it into state.activeBags.
  const afterActivate = await getActiveGameRun(playerId);
  const activeRow = afterActivate.loadoutItems.find((i) => i.id === bought.id);
  assert.equal(activeRow.active, true);
});

test('[bag-active] non-bag rows always have active=0 even if the client sends active:1', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 6005 });
  await forceShopOffer(run.id, playerId, 1, ['bark_plate']);
  const bought = await buyRunShopItem(playerId, run.id, 'bark_plate');

  // Try to sneak active=1 onto a non-bag row. The server must ignore it:
  // activation is a bag-only concept.
  const active = await getActiveGameRun(playerId);
  const starterRows = active.loadoutItems.filter((i) => i.x >= 0 && i.y >= 0 && !i.bagId);
  await applyRunLoadoutPlacements(playerId, run.id, [
    ...starterRows.map((r) => ({
      id: r.id,
      artifactId: r.artifactId,
      x: r.x, y: r.y, width: r.width, height: r.height
    })),
    {
      id: bought.id,
      artifactId: 'bark_plate',
      x: 2, y: 0, width: 1, height: 1,
      active: 1
    }
  ]);

  assert.equal(
    await readBagActive(run.id, playerId, 'bark_plate', 1),
    0,
    'non-bag row must stay active=0 regardless of the client payload'
  );
});
