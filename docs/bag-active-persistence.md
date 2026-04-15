# Bag active persistence

## Problem

"Bag is activated" is client-only state. Closing and reopening the page
(or restarting the dev server) loses it — every bag on hydration lands
back in the container and the player has to click each one again.

Today the client tracks activation in `state.activeBags`. The server
stores every loadout row with the full set of columns (x, y, bag_id,
sort_order, purchased_round, fresh_purchase, …) but has no column that
says "this bag row is active". Before commit `acae474` the implicit
signal was `x >= 0` on a bag row, but that commit pinned bags to
`(-1,-1)` at every write point — so now every bag has the same coords
whether it's active or not, and [useAuth.js](../web/src/composables/useAuth.js)
drops them all into the container on hydrate:

```js
// web/src/composables/useAuth.js (current)
const bagRows = loadoutItems.filter((i) => bagsSet.has(i.artifactId) && !i.bagId);
// TODO: the server doesn't persist active-vs-container bag state.
// For now, treat every bag as container on hydrate.
state.containerItems = [...state.containerItems, ...bagRows.map((i) => ({ id: i.id, artifactId: i.artifactId }))];
state.activeBags = [];
```

This is the TODO we're closing.

## Scope: what the refactor touches

Only the persistence pathway. Battle resolution, validation, and combat
stats never look at activation state:

- `getActiveSnapshot` / `validateLoadoutItems` / `validateBagContents`
  treat all bags identically regardless of "active".
- `contributesStats` uses `bag.family === 'bag' → 0 stats` and
  `bagged item → contributes` — neither path reads an active flag.
- `copyRoundForward` duplicates rows verbatim, so the new column
  propagates across round transitions for free.

That means this is a pure persistence problem. No combat code changes.

## Design

### Single source of truth: a boolean column on the loadout row

Add `active INTEGER NOT NULL DEFAULT 0` to `game_run_loadout_items` via
the existing Sequelize model. `sequelize.sync()` runs on startup and
creates the column for fresh databases; the dev sqlite file gets deleted
on the next `freshDb`/test reset, so there's no migration dance.

Pre-production caveat: existing dev sqlite databases don't auto-alter.
Anyone running `npm run game:start` against a stale db will see a column-
not-found error from the first SELECT that touches the new field. Fix:
`rm tmp/telegram-autobattler-dev.sqlite` once. Documented in the commit.

Why a column and not a JSON blob or a separate table:
- `insertLoadoutItem` / `readCurrentRoundItems` / `copyRoundForward`
  already select every column explicitly — one more field costs nothing.
- Queries stay indexable and debuggable via `sqlite3`.
- A separate table would need its own round-forward copy step, which
  we'd forget.
- A `shop_state.activeBags` JSON blob would duplicate the source of
  truth (bag rows already exist in `loadout_items`), invite drift, and
  need its own round-forward story.

### Write path

Three writers set `active`:

1. **`insertLoadoutItem`** — defaults to `0`. Non-bag rows are always 0.
   Bag rows fresh-inserted from a shop buy also land as 0 (they start in
   the container). Accepts an optional `active` param for completeness
   but the default covers every call site.
2. **`applyLegacyPlacements`** — the `PUT /api/artifact-loadout`
   endpoint is how the client syncs layout state. Its UPDATE grows to
   include `active = $N`. Payload entries without an `active` field
   default to `0` server-side so a client that forgets to emit it never
   leaves a stale `1` stuck on a row.
3. **`copyRoundForward`** — already does a verbatim copy of every
   column via `readCurrentRoundItems` → `insertLoadoutItem`. Carries
   `active` forward automatically once the read mapping includes it.

### Read path

Two readers pass `active` to the client:

1. **`readCurrentRoundItems`** — adds `active` to the SELECT and maps
   `row.active` → `item.active` in the return shape.
2. **`getActiveSnapshot`** in battle-service — ignores the new column
   entirely (combat doesn't care). No change needed.

### Client state

Hydration in [useAuth.js](../web/src/composables/useAuth.js) already
splits `loadoutItems` into `builderItems` / `containerItems` /
`activeBags` / bagged items. The fix is to route bag rows based on
`i.active` instead of unconditionally dumping them into the container.

```js
// After the refactor
const bagRows = loadoutItems.filter((i) => bagsSet.has(i.artifactId) && !i.bagId);
state.activeBags = bagRows
  .filter((i) => i.active)
  .map((i) => ({ id: i.id, artifactId: i.artifactId }));
state.containerItems = [
  ...state.containerItems,
  ...bagRows.filter((i) => !i.active).map((i) => ({ id: i.id, artifactId: i.artifactId }))
];
```

### Payload

[useGameRun.js](../web/src/composables/useGameRun.js)
`buildLoadoutPayloadItems` grows one line: bags emitted from
`state.activeBags` get `active: 1`, bags emitted from
`state.containerItems` get `active: 0`. Non-bag entries don't emit the
field at all (defaults to 0 server-side; irrelevant for them).

### Client-side flow

`activateBag` / `deactivateBag` already call `persistRunLoadout` right
after mutating client state, so the refactor is transparent to them —
they continue calling the same endpoint, the payload now carries the
active bit, the server persists it, and the next hydrate reads it back.

`rotatedBags` is still client-only (UI decoration, no round semantics)
and out of scope. That's a deliberate non-goal: it's cosmetic.

## Non-goals

- Persisting `rotatedBags` across reloads. Cosmetic — out of scope.
- Persisting the shop offer between reloads beyond the current
  `game_run_shop_states` row. Separate concern, already handled.
- Touching combat / validation / ghost snapshot code. None of it reads
  `active`.
- Migrating existing dev sqlite databases. Pre-production; `rm` the
  file and move on.

## Test plan

1. **Unit: server read path** — add a test in
   [bag-items.test.js](../tests/game/bag-items.test.js) or
   [loadout-refactor.test.js](../tests/game/loadout-refactor.test.js)
   that seeds a bag row with `active=1` via direct SQL, reads it via
   `getActiveGameRun`, and asserts `loadoutItems[0].active === 1`.
2. **Unit: server write path** — send a `PUT /api/artifact-loadout`
   payload with `active: 1` on a bag entry, read the row back from SQL,
   assert `active === 1`. Repeat with `active: 0` to verify the toggle.
3. **Unit: round copy-forward** — seed a run with an active bag,
   resolve the round, assert round N+1's bag row still has `active=1`.
4. **Composable: hydration** — extend
   [use-shop.test.js](../tests/web/use-shop.test.js) with a hydration-
   shim test that feeds a `loadoutItems` array containing `active:1` and
   asserts `state.activeBags` (not `state.containerItems`) holds the
   bag. This pins the projection direction.
5. **Playwright e2e** — the existing
   [solo-run.spec.js](../tests/game/solo-run.spec.js) "second bag from
   container when another bag is active (after reload)" test already
   covers the happy path. Verify it still passes after the refactor; no
   changes to the test itself.

## Rollout

One commit, because:
- The server change is additive (column defaults to 0, existing rows
  behave identically).
- The client change depends on the server change being present (the
  hydrate reads `i.active`), so they must land together.
- The test surface is small enough to review atomically.

Done when all 250 tests pass, plus 3 new tests for the persistence
round-trip, and the commit message documents the `rm tmp/*.sqlite` step
for anyone with a stale dev database.
