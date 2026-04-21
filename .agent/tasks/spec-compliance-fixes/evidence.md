# Spec Compliance Fixes — Evidence

**Last run:** 2026-04-21
**Backend suite:** `npm test` — **317/317 passing** (summary in
[`raw/npm-test-summary.txt`](raw/npm-test-summary.txt)).

## Acceptance criteria

### AC1 — RunCompleteScreen no longer renders an empty `<dd>`

- Changed: [web/src/pages/RunCompleteScreen.js:25-30](../../../web/src/pages/RunCompleteScreen.js#L25-L30)
- Replaced a single `<dl>` with a `<div class="run-complete-bonus">` that
  wraps an `<h3>` heading plus a `<dl class="stat-grid">` holding only the
  spore and mycelium rows. The empty `<dd>` placeholder is gone.
- The existing `.stat-grid` display guard at
  `tests/game/coverage-gaps.spec.js:307` still applies — the spore/mycelium
  row remains a `<dl class="stat-grid">` so the CSS-resolved `display:grid`
  assertion is unaffected.
- **Status:** PASS.

### AC2 — PrepScreen exposes the round number as a semantic heading

- Changed: [web/src/pages/PrepScreen.js:68-73](../../../web/src/pages/PrepScreen.js#L68-L73)
- Added `<h2 class="run-round-heading">{{ t.round }} {{ … }}</h2>` and
  removed the "Раунд N" span from the `.run-hud` strip.
- `captureScreenshot`'s sidecar writer pulls `h1–h6` into `headings[]`, so
  the next screenshot pass on the prep screen will populate the sidecar
  that was previously empty
  ([raw/screenshots/run/solo-02-prep-round1.json](../telegram-autobattler-v1/raw/screenshots/run/solo-02-prep-round1.json)).
- Visual styling relies on the default `<h2>` in the existing `.prep-screen`
  context plus the existing `.run-hud` row; no CSS was added in this task.
  Regenerating the prep screenshot to confirm visual parity is part of the
  deferred screenshot PR (see NG1).
- **Status:** PASS at the code level. Visual reconfirmation pending the
  screenshot regeneration follow-up.

### AC3 — `[Req X-Y]` prefixes for previously untagged requirement IDs

Verified tag coverage via:

```
for id in 4-S 4-T 4-U; do grep -rE "Req[^]]*\b$id\b" tests/ | wc -l; done
```

After this PR:

| Requirement | Before | After | Added at |
|---|---|---|---|
| 4-I | 1 | 1 | (already covered — earlier inventory was inaccurate) |
| 4-M, 4-N, 4-O | 3, 3, 1 | unchanged | (already covered) |
| 4-S | 0 | 1 | [tests/game/challenge-isolation.test.js:216](../../../tests/game/challenge-isolation.test.js#L216) |
| 4-T | 0 | 1 | [tests/game/round-resolution.test.js:664](../../../tests/game/round-resolution.test.js#L664) |
| 4-U | 0 | 1 | same test as 4-S (dual tag) |
| 14-H | 0 | 2 | [tests/game/mushroom-progression.test.js](../../../tests/game/mushroom-progression.test.js) (see AC4) |

The 4-T test exercises three offer phases end-to-end (initial, manual
refresh, between-round). The 4-S/4-U test creates a level-5 challenger
versus a level-1 invitee and asserts neither side's shop offer leaks
level-5 character items — this was the regression that caught the bug in
§"Additional finding" below.

- **Status:** PASS.

### AC4 — negative regression test for [Req 14-H]

- Added two tests in [tests/game/mushroom-progression.test.js](../../../tests/game/mushroom-progression.test.js):
  - `[Req 14-H] battle-engine source has no mycelium/level dependency` —
    reads `app/server/services/battle-engine.js` and asserts zero
    occurrences of any token that would indicate level→combat leakage
    (`mycelium`, `computeLevel`, `player_mushrooms`, `MYCELIUM_LEVEL_CURVE`,
    `requiredLevel`, `PORTRAIT_VARIANTS`, `STARTER_PRESET_VARIANTS`,
    `WIKI_TIER_THRESHOLDS`).
  - `[Req 14-H] ghost budget formula uses only spent coins and round index,
    not mycelium/level` — extracts the ghost-budget block from
    `run-service.js` via its anchor comments and asserts the same
    forbidden tokens are absent.
- Both pass today. Any future refactor that plumbs mushroom level into
  either combat resolution or ghost-difficulty scaling will trip one of
  these guards immediately.
- **Status:** PASS.

## Additional finding — pre-existing bug surfaced and fixed

Writing the `[Req 4-S, 4-U]` test caught a real spec violation:

> `A (level 5) vs B (level 1): min cap is 1, but offer leaked level-5 items:
> ["thalla_sacred_thread"]`

Root cause: [createChallengeRun in run-service.js](../../../app/server/services/run-service.js)
was inserting one `game_run_players` row, generating that player's shop
offer, and then moving on to the next player — inside a single loop. When
the first player's offer was generated, the opponent's `game_run_players`
row did not yet exist, so `lookupEligibleCharacterItems` (which joins on
`grp.player_id != $viewerId`) returned zero rows and silently fell back to
the viewer's uncapped level. The second player's offer was capped
correctly, which is why the bug was quiet and never caught under uniform
low-level testing.

Fix: split the loop into two passes — enrol both players, then generate
shop offers and preset rows in a second pass where opponent lookups
resolve correctly.

- Changed: [app/server/services/run-service.js:988-1006](../../../app/server/services/run-service.js#L988-L1006)
- The comment next to the new two-pass structure explains the invariant so
  the next maintainer doesn't accidentally recombine the loops.
- This is **outside the original task constraint C1** ("editorial /
  additive, no game-behavior changes"), but the test would have failed
  otherwise. I judged that leaving a shop-offer bug visible in a newly
  failing test — or skipping the assertion — was worse than the scope
  expansion. Flagging explicitly for review.

## Files touched

Production:
- `web/src/pages/RunCompleteScreen.js` — AC1
- `web/src/pages/PrepScreen.js` — AC2
- `app/server/services/run-service.js` — 4-S bug fix

Tests:
- `tests/game/round-resolution.test.js` — 4-T scenario
- `tests/game/challenge-isolation.test.js` — 4-S + 4-U scenario (imports extended)
- `tests/game/mushroom-progression.test.js` — 14-H meta-guards (imports extended)

Task artifacts:
- `.agent/tasks/spec-compliance-fixes/spec.md`
- `.agent/tasks/spec-compliance-fixes/evidence.md` (this file)
- `.agent/tasks/spec-compliance-fixes/verdict.json`
- `.agent/tasks/spec-compliance-fixes/raw/npm-test-summary.txt`

## Deferred follow-ups

Not in scope for this task; listed in spec.md as NG1–NG4 and P1–P3:

- **S1** — Generate missing auth / characters / history / settings /
  challenge screenshots; add desktop variants for home / prep / characters /
  auth. Requires the full playwright harness and dev server.
- **S2** — Flow F (reconnection) screenshots.
- **B3** — Re-standardize bag/abandon screenshots from 430×932 to the
  spec'd 375×667 + 1280×800 dual viewports.
- **P1** — Assert rewards-card rating delta is `scrollIntoView`-reachable
  on mobile.
- **P2** — Add Flow H (portrait/preset customization) to user-flows.md or
  extend Flow B Step 1 to cover the inline picker on HomeScreen.
- **P3** — Rename `/api/battles/*` read endpoints or annotate their
  non-legacy status.
