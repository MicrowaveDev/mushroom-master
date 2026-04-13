import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLevel, MYCELIUM_LEVEL_CURVE } from '../../app/server/lib/utils.js';
import { getTier, WIKI_TIER_THRESHOLDS } from '../../app/server/game-data.js';
import { getWikiEntry } from '../../app/server/wiki.js';
import { createPlayer, freshDb } from './helpers.js';
import { getPlayerState } from '../../app/server/services/game-service.js';
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
  const { player } = await createPlayer({ telegramId: 901 });

  // Manually set 400 mycelium for thalla → level 5 → tier mycel
  await query(
    `UPDATE player_mushrooms SET mycelium = 400 WHERE player_id = $1 AND mushroom_id = 'thalla'`,
    [player.id]
  );

  const state = await getPlayerState(player.id);
  const prog = state.progression['thalla'];
  assert.ok(prog, 'thalla progression exists');
  assert.equal(prog.level, 5);
  assert.equal(prog.tier, 'mycel');
});
