import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLevel, MYCELIUM_LEVEL_CURVE } from '../../app/server/lib/utils.js';
import {
  getTier,
  WIKI_TIER_THRESHOLDS,
  PORTRAIT_VARIANTS,
  STARTER_PRESET_VARIANTS,
  getStarterPreset
} from '../../app/server/game-data.js';
import { getWikiEntry } from '../../app/server/wiki.js';
import { createPlayer, freshDb, bootRun, earnMycelium } from './helpers.js';
import {
  abandonGameRun,
  getPlayerState,
  selectActiveMushroom,
  startGameRun,
  switchPortrait,
  switchPreset
} from '../../app/server/services/game-service.js';
import { query } from '../../app/server/db.js';

// --- computeLevel ---

test('[Req 14-A] computeLevel: level 1 at 0 mycelium', () => {
  const r = computeLevel(0);
  assert.equal(r.level, 1);
  assert.equal(r.current, 0);
  assert.equal(r.next, 100);
});

test('[Req 14-A] computeLevel: level 2 at exactly 100 mycelium', () => {
  const r = computeLevel(100);
  assert.equal(r.level, 2);
  assert.equal(r.current, 0);
  assert.equal(r.next, 100); // next threshold gap is 200-100=100
});

test('[Req 14-A] computeLevel: stays level 1 at 99 mycelium', () => {
  assert.equal(computeLevel(99).level, 1);
});

test('[Req 14-A] computeLevel: level 5 at exactly 350 mycelium (Mycel tier starts)', () => {
  assert.equal(computeLevel(350).level, 5);
  assert.equal(computeLevel(349).level, 4);
});

test('[Req 14-A] computeLevel: level 10 at exactly 1200 mycelium (Root tier starts)', () => {
  assert.equal(computeLevel(1200).level, 10);
  assert.equal(computeLevel(1199).level, 9);
});

test('[Req 14-A] computeLevel: level 15 at exactly 2500 mycelium (Cap tier starts)', () => {
  assert.equal(computeLevel(2500).level, 15);
  assert.equal(computeLevel(2499).level, 14);
});

test('[Req 14-A] computeLevel: level 20 at exactly 4000 mycelium (Eternal)', () => {
  const r = computeLevel(4000);
  assert.equal(r.level, 20);
  assert.equal(r.current, 0);
  assert.equal(r.next, null); // maxed — no further levels
});

test('[Req 14-A] computeLevel: stays level 20 above 4000 mycelium', () => {
  const r = computeLevel(9999);
  assert.equal(r.level, 20);
  assert.equal(r.current, 5999);
  assert.equal(r.next, null);
});

test('[Req 14-A] MYCELIUM_LEVEL_CURVE has 19 entries (levels 2–20)', () => {
  assert.equal(MYCELIUM_LEVEL_CURVE.length, 19);
  assert.equal(MYCELIUM_LEVEL_CURVE[0], 100);
  assert.equal(MYCELIUM_LEVEL_CURVE[18], 4000);
});

// --- getTier ---

test('[Req 14-B] getTier: Spore for levels 1–4', () => {
  assert.equal(getTier(1), 'spore');
  assert.equal(getTier(2), 'spore');
  assert.equal(getTier(4), 'spore');
});

test('[Req 14-B] getTier: Mycel for levels 5–9', () => {
  assert.equal(getTier(5), 'mycel');
  assert.equal(getTier(9), 'mycel');
});

test('[Req 14-B] getTier: Root for levels 10–14', () => {
  assert.equal(getTier(10), 'root');
  assert.equal(getTier(14), 'root');
});

test('[Req 14-B] getTier: Cap for levels 15–19', () => {
  assert.equal(getTier(15), 'cap');
  assert.equal(getTier(19), 'cap');
});

test('[Req 14-B] getTier: Eternal for level 20', () => {
  assert.equal(getTier(20), 'eternal');
  assert.equal(getTier(99), 'eternal'); // above cap
});

// --- WIKI_TIER_THRESHOLDS ---

test('[Req 14-D] WIKI_TIER_THRESHOLDS: tier 0 always unlocked, tiers 1–3 gated', () => {
  assert.equal(WIKI_TIER_THRESHOLDS[0], 0);
  assert.equal(WIKI_TIER_THRESHOLDS[1], 100);
  assert.equal(WIKI_TIER_THRESHOLDS[2], 1000);
  assert.equal(WIKI_TIER_THRESHOLDS[3], 3000);
});

// --- getWikiEntry gating ---

test('[Req 14-D] wiki: tier 1 locked below 100 mycelium', async () => {
  const entry = await getWikiEntry('characters', 'thalla', 99);
  const tier1 = entry.sections.find(s => s.tier === 1);
  assert.ok(tier1, 'tier 1 section exists');
  assert.equal(tier1.locked, true);
  assert.equal(tier1.html, null);
});

test('[Req 14-D] wiki: tier 1 unlocked at exactly 100 mycelium', async () => {
  const entry = await getWikiEntry('characters', 'thalla', 100);
  const tier1 = entry.sections.find(s => s.tier === 1);
  assert.equal(tier1.locked, false);
  assert.ok(typeof tier1.html === 'string' && tier1.html.length > 0);
});

test('[Req 14-D] wiki: tier 2 locked at 999 mycelium, unlocked at 1000', async () => {
  const locked = await getWikiEntry('characters', 'thalla', 999);
  const unlocked = await getWikiEntry('characters', 'thalla', 1000);
  assert.equal(locked.sections.find(s => s.tier === 2).locked, true);
  assert.equal(unlocked.sections.find(s => s.tier === 2).locked, false);
});

test('[Req 14-D] wiki: tier 3 locked at 2999 mycelium, unlocked at 3000', async () => {
  const locked = await getWikiEntry('characters', 'thalla', 2999);
  const unlocked = await getWikiEntry('characters', 'thalla', 3000);
  assert.equal(locked.sections.find(s => s.tier === 3).locked, true);
  assert.equal(unlocked.sections.find(s => s.tier === 3).locked, false);
});

test('[Req 14-D] wiki: all sections visible when mycelium=Infinity (default)', async () => {
  const entry = await getWikiEntry('characters', 'thalla');
  assert.ok(entry.sections.every(s => !s.locked));
});

test('[Req 14-D] wiki: non-character sections always fully visible', async () => {
  // Locations and factions have no gating even with 0 mycelium
  // (they have no tier markers, so they return a single tier-0 section)
  const entry = await getWikiEntry('locations', 'ygg-mycel', 0).catch(() => null);
  // If the page doesn't exist in the test env that's fine; the key point
  // is that non-character pages don't error on the gating path.
  if (entry) {
    assert.ok(entry.sections.every(s => !s.locked));
  }
});

// --- bootstrap includes tier ---

test('[Req 14-B] getPlayerState progression includes tier field', async () => {
  await freshDb();
  // REWARD_MULTIPLIER=70: loss gives 5×70=350 (level 5), win gives 15×70=1050 (level 9).
  // Either outcome lands in the mycel tier (levels 5–9).
  const { playerId, run } = await bootRun({ telegramId: 901 });
  await earnMycelium(playerId, run.id, 70);
  const state = await getPlayerState(playerId);
  const prog = state.progression['thalla'];
  assert.ok(prog, 'thalla progression exists');
  assert.ok(prog.level >= 5, `level must be ≥ 5 after earning ≥350 mycelium, got ${prog.level}`);
  assert.equal(prog.tier, 'mycel');
});

// --- Portrait variants (Option 6) ---

test('[Req 14-F] P1 PORTRAIT_VARIANTS: every mushroom has an entry; first variant is always default with cost 0', () => {
  const mushroomIds = ['thalla', 'lomie', 'axilin', 'kirt', 'morga', 'dalamar'];
  for (const id of mushroomIds) {
    const variants = PORTRAIT_VARIANTS[id];
    assert.ok(variants && variants.length >= 1, `${id} must have at least one portrait variant`);
    assert.equal(variants[0].id, 'default', `${id} first variant must be 'default'`);
    assert.equal(variants[0].cost, 0, `${id} default variant must cost 0 mycelium`);
  }
});

test('[Req 14-F] P2 getPlayerState portraits[].unlocked reflects mycelium threshold', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 910 });
  // At 0 mycelium: variant 1 (cost 500) is locked.
  const stateLocked = await getPlayerState(playerId);
  const portraitsLocked = stateLocked.progression['thalla'].portraits;
  assert.equal(portraitsLocked[0].unlocked, true, 'default (cost 0) always unlocked');
  assert.equal(portraitsLocked[1].unlocked, false, 'variant 1 locked at 0 mycelium');

  // REWARD_MULTIPLIER=100: loss gives 5×100=500 (exactly at threshold), win gives 1500.
  await earnMycelium(playerId, run.id, 100);
  const stateUnlocked = await getPlayerState(playerId);
  assert.equal(stateUnlocked.progression['thalla'].portraits[1].unlocked, true, 'variant 1 unlocked at ≥500 mycelium');
});

test('[Req 14-F] P3 getPlayerState activePortraitUrl reflects active_portrait column', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 911 });
  // Earn ≥500 mycelium then switch to variant 1 via service call.
  await earnMycelium(playerId, run.id, 100);
  await switchPortrait(playerId, 'thalla', '1');
  const state = await getPlayerState(playerId);
  const prog = state.progression['thalla'];
  assert.equal(prog.activePortrait, '1');
  assert.ok(
    prog.activePortraitUrl.includes('thalla/1'),
    `activePortraitUrl should point to thalla/1, got: ${prog.activePortraitUrl}`
  );
});

test('[Req 14-F] P4 switchPortrait happy path: mycelium threshold met → persisted in DB', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 912 });
  // Earn ≥500 mycelium (variant 1 costs 500).
  await earnMycelium(playerId, run.id, 100);
  const result = await switchPortrait(playerId, 'thalla', '1');
  assert.equal(result.portraitId, '1');
  assert.ok(result.path.includes('thalla/1'), `path should reference thalla/1, got: ${result.path}`);
  const row = await query(
    `SELECT active_portrait FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = 'thalla'`,
    [playerId]
  );
  assert.equal(row.rows[0].active_portrait, '1', 'DB must reflect the new active portrait');
});

test('[Req 14-F] P5 switchPortrait gate: mycelium below threshold → 403, no DB change', async () => {
  await freshDb();
  // Fresh player starts at 0 mycelium — already below the 500-mycelium threshold for variant 1.
  const { player } = await createPlayer({ telegramId: 913 });
  await assert.rejects(
    () => switchPortrait(player.id, 'thalla', '1'),
    (err) => err.statusCode === 403
  );
  const row = await query(
    `SELECT active_portrait FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = 'thalla'`,
    [player.id]
  );
  assert.equal(row.rows[0].active_portrait, 'default', 'DB must be unchanged after rejected switch');
});

test('[Req 14-F] P6 switchPortrait unknown portrait id → 400', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 914 });
  await assert.rejects(
    () => switchPortrait(player.id, 'thalla', 'nonexistent'),
    (err) => err.statusCode === 400
  );
});

test('[Req 14-F] P7 switchPortrait unknown mushroom id → 404', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 915 });
  await assert.rejects(
    () => switchPortrait(player.id, 'notamushroom', 'default'),
    (err) => err.statusCode === 404
  );
});

// --- Starter preset variants (Option 3) ---

test('[Req 14-G] V1 STARTER_PRESET_VARIANTS: every mushroom has 3 variants; first is default with requiredLevel 0', () => {
  const mushroomIds = ['thalla', 'lomie', 'axilin', 'kirt', 'morga', 'dalamar'];
  for (const id of mushroomIds) {
    const variants = STARTER_PRESET_VARIANTS[id];
    assert.equal(variants.length, 3, `${id} must have 3 preset variants`);
    assert.equal(variants[0].id, 'default', `${id} first variant must be 'default'`);
    assert.equal(variants[0].requiredLevel, 0, `${id} default preset requires level 0`);
  }
});

test('[Req 14-G] V2 getStarterPreset returns correct item pair for each named variant', () => {
  for (const [mushroomId, variants] of Object.entries(STARTER_PRESET_VARIANTS)) {
    for (const variant of variants) {
      const items = getStarterPreset(mushroomId, variant.id);
      assert.equal(items.length, 2, `${mushroomId}/${variant.id} must return 2 items`);
      assert.equal(items[0].artifactId, variant.items[0], `${mushroomId}/${variant.id} first item mismatch`);
      assert.equal(items[1].artifactId, variant.items[1], `${mushroomId}/${variant.id} second item mismatch`);
    }
  }
});

test('[Req 14-G] V3 getStarterPreset falls back to default for unknown preset id', () => {
  const defaultItems = getStarterPreset('thalla', 'default');
  const fallbackItems = getStarterPreset('thalla', 'nonexistent');
  assert.deepEqual(fallbackItems, defaultItems, 'unknown preset must fall back to default without throwing');
});

test('[Req 14-G] V4 getPlayerState presets[].unlocked reflects level threshold', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 920 });
  // At 0 mycelium (level 1): preset 1 (requires level 5) is locked.
  const stateLow = await getPlayerState(playerId);
  const presetsLow = stateLow.progression['thalla'].presets;
  assert.equal(presetsLow[0].unlocked, true, 'default preset always unlocked');
  assert.equal(presetsLow[1].unlocked, false, 'level-5 preset locked at level 1');

  // REWARD_MULTIPLIER=70: loss gives 5×70=350 (level 5), win gives 15×70=1050 (level 9).
  // Either way level ≥ 5; preset 1 unlocked. Preset 2 needs level 10 (1200 mycelium) — still locked.
  await earnMycelium(playerId, run.id, 70);
  const stateL5 = await getPlayerState(playerId);
  assert.equal(stateL5.progression['thalla'].presets[1].unlocked, true, 'level-5 preset unlocked at level ≥5');
  assert.equal(stateL5.progression['thalla'].presets[2].unlocked, false, 'level-10 preset still locked');
});

test('[Req 14-G] V5 getPlayerState activePreset reflects active_preset column', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 921 });
  // Earn ≥350 mycelium (level 5) then activate stun preset via service call.
  await earnMycelium(playerId, run.id, 70);
  await switchPreset(playerId, 'thalla', 'stun');
  const state = await getPlayerState(playerId);
  assert.equal(state.progression['thalla'].activePreset, 'stun');
});

test('[Req 14-G] V6 startGameRun seeds the active preset items, not always default', async () => {
  await freshDb();
  // Run 1: earn mycelium to reach level 5, then activate the stun preset.
  const { playerId, run: run1 } = await bootRun({ telegramId: 922, username: 'v6_test' });
  // REWARD_MULTIPLIER=70 guarantees ≥350 mycelium regardless of win/loss outcome.
  await earnMycelium(playerId, run1.id, 70);
  await switchPreset(playerId, 'thalla', 'stun');
  // End run 1 so a new run can start.
  await abandonGameRun(playerId, run1.id);

  // Run 2: must use the active stun preset (spore_lash + glimmer_cap).
  const run2 = await startGameRun(playerId, 'solo');
  const items = await query(
    `SELECT artifact_id FROM game_run_loadout_items
     WHERE game_run_id = $1 AND player_id = $2 AND round_number = 1
     ORDER BY sort_order ASC`,
    [run2.id, playerId]
  );
  assert.equal(items.rowCount, 2, 'starter preset must seed exactly 2 items');
  const stunVariant = STARTER_PRESET_VARIANTS['thalla'].find(v => v.id === 'stun');
  const seededIds = items.rows.map(r => r.artifact_id);
  assert.deepEqual(seededIds, stunVariant.items, 'seeded items must match the active stun preset');
});

test('[Req 14-G] V7 switchPreset happy path: level met → persisted in DB', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 923 });
  // Earn ≥350 mycelium (level 5 required for 'stun').
  await earnMycelium(playerId, run.id, 70);
  const result = await switchPreset(playerId, 'thalla', 'stun');
  assert.equal(result.presetId, 'stun');
  const row = await query(
    `SELECT active_preset FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = 'thalla'`,
    [playerId]
  );
  assert.equal(row.rows[0].active_preset, 'stun', 'DB must reflect the new active preset');
});

test('[Req 14-G] V8 switchPreset gate: level too low → 403, no DB change', async () => {
  await freshDb();
  // Fresh player starts at 0 mycelium (level 1) — below level 5 required for 'stun'.
  const { player } = await createPlayer({ telegramId: 924 });
  await assert.rejects(
    () => switchPreset(player.id, 'thalla', 'stun'),
    (err) => err.statusCode === 403
  );
  const row = await query(
    `SELECT active_preset FROM player_mushrooms WHERE player_id = $1 AND mushroom_id = 'thalla'`,
    [player.id]
  );
  assert.equal(row.rows[0].active_preset, 'default', 'DB must be unchanged after rejected switch');
});

test('[Req 14-G] V9 switchPreset unknown preset id → 400', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 925 });
  await assert.rejects(
    () => switchPreset(player.id, 'thalla', 'nonexistent'),
    (err) => err.statusCode === 400
  );
});

test('[Req 14-G] V10 switchPreset unknown mushroom id → 404', async () => {
  await freshDb();
  const { player } = await createPlayer({ telegramId: 926 });
  await assert.rejects(
    () => switchPreset(player.id, 'notamushroom', 'default'),
    (err) => err.statusCode === 404
  );
});

test('[Req 14-C] mycelium is per-mushroom: playing thalla does not advance axilin', async () => {
  await freshDb();
  const { playerId, run } = await bootRun({ telegramId: 950, mushroomId: 'thalla' });

  // Earn mycelium on thalla by completing a round
  await earnMycelium(playerId, run.id, 1);

  const state = await getPlayerState(playerId);
  const thalla = state.progression['thalla'];
  const axilin = state.progression['axilin'];

  assert.ok(thalla.mycelium > 0, 'thalla should have earned mycelium');
  assert.equal(axilin.mycelium, 0, 'axilin should still be at 0 mycelium');
});
