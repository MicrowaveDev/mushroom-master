# Evidence — bag-slot-coords-refactor

> **Historical ship record — read the current contract in
> [docs/bag-item-placement-persistence.md](../../../docs/bag-item-placement-persistence.md).**
>
> This evidence bundle covers the *initial* slot-coords refactor only.
> Three follow-on waves landed in the same session and aren't reflected
> here: legacy `bag_id=artifactId` handling was stripped, hardcoded
> absolute paths were replaced with `app/shared/repo-root.js`, and
> tetromino bag shapes shipped (see the "Non-rectangular bag shapes"
> section in the current contract doc). The AC8 PASS below ("Legacy
> rows self-heal via projection fallback") was specifically *reverted*
> by the legacy-strip wave — the projection now rejects those shapes
> via the inactive-bag / out-of-bounds path instead of absorbing them.
> Total verification state after all four waves: 311/311 unit+scenario,
> 17/17 bag-relevant Playwright e2e.

## Summary

Reworked `game_run_loadout_items` bagged-row semantics from virtual grid
coords to slot coords, and tightened `bag_id` from artifactId to the
bag's loadout row id. Round-trip pieces (payload emit, server validator,
copy-forward, client projection, bag rotate/deactivate relayout) are
all coord-kind consistent. Legacy rows absorb into the container via
the projection fallback; no migration required.

## Acceptance-criterion status

| AC  | Status | Where proven |
|-----|--------|--------------|
| AC1 Server stores slot coords for bagged rows | PASS | [tests/game/bag-items.test.js](../../../tests/game/bag-items.test.js) `[Req 12-D, 5-A]` reads back `x=0, y=0` (not `y=INVENTORY_ROWS`) after a PUT that placed a bagged item in slot (0,0). |
| AC2 bag_id references bag's row id | PASS | Same scenario reads the bag row id via `SELECT id FROM game_run_loadout_items WHERE artifact_id='moss_pouch'` and asserts `round2Bagged.rows[0].bag_id === round2BagRowId` (not the artifact id). |
| AC3 copyRoundForward remaps bag_id per-round | PASS | Same scenario asserts `round2BagRowId !== round1BagRowId` and that zero round-2 rows point at the round-1 id. Implemented in [game-run-loadout.js](../../../app/server/services/game-run-loadout.js) `copyRoundForward` two-pass map. |
| AC4 validateBagContents enforces slot bounds + per-bag overlap | PASS | [tests/game/validator-split.test.js](../../../tests/game/validator-split.test.js): "rejects bagged-item slot coords outside bag footprint", "rejects bagged items that overlap inside the same bag", "duplicate bags disambiguate by row id". |
| AC5 Client payload emits slot coords + bag row id | PASS | [useGameRun.js](../../../web/src/composables/useGameRun.js) `buildLoadoutPayloadItems` emits `y: item.y - info.startRow` and `bagId: info.bagRowId`. Proven end-to-end by the scenario test, which exercises the PUT → validator → DB round trip. |
| AC6 Projection reconstructs virtual render y | PASS | [tests/web/loadout-projection.test.js](../../../tests/web/loadout-projection.test.js): "slot coords land at reconstructed virtual y", "second-slot reconstructs to startRow + slotY", "items in second bag land past first bag's rows", "duplicate active bags route items to the right instance". Inactive/legacy/OOB fallbacks each have a dedicated regression test. |
| AC7 Rotate/deactivate guardrails relaxed to current bag only | PASS | [tests/web/use-shop.test.js](../../../tests/web/use-shop.test.js): "deactivating an earlier empty bag succeeds and shifts later bag's items up", "rotating an earlier empty bag succeeds and shifts a later bag's items", "deactivating a non-empty bag is still blocked". |
| AC8 Legacy rows self-heal via projection fallback | PASS | projection tests: "legacy bagId = artifactId falls back to containerItems", "legacy bagged items at (-1,-1) fall back", "bagged item referencing inactive bag falls back". |

## Verification run

```
node --test tests/game/*.test.js tests/web/*.test.js
# tests 297
# pass 297
# fail 0
```

Raw sweep: [raw/full-sweep.txt](raw/full-sweep.txt).
Targeted tests (bag-items + validator-split + loadout-projection + use-shop):
[raw/targeted-tests.txt](raw/targeted-tests.txt) (81 ok / 0 not-ok).

## Files changed

Server:
- [app/server/services/loadout-utils.js](../../../app/server/services/loadout-utils.js) — rewrote `validateBagContents` with row-id + artifactId resolution, slot bounds, per-bag overlap set.
- [app/server/services/game-run-loadout.js](../../../app/server/services/game-run-loadout.js) — `copyRoundForward` now two-pass with bag_id remap.
- [app/server/services/shop-service.js](../../../app/server/services/shop-service.js) — sell-non-empty-bag check matches on row id (with artifactId legacy fallback).
- [app/server/services/battle-service.js](../../../app/server/services/battle-service.js) — `getActiveSnapshot` now includes `id`, `active`, `rotated` in the projected items so `validateLoadoutItems` has what it needs.
- [app/server/models/GameRunLoadoutItem.js](../../../app/server/models/GameRunLoadoutItem.js) — comment updated to reflect new coord contract.

Client:
- [web/src/composables/useGameRun.js](../../../web/src/composables/useGameRun.js) — `buildLoadoutPayloadItems` emits slot coords + bag row id.
- [web/src/composables/loadout-projection.js](../../../web/src/composables/loadout-projection.js) — accepts `getArtifact`, reconstructs virtual render y, unified fallback for all legacy / stale / OOB shapes.
- [web/src/composables/useAuth.js](../../../web/src/composables/useAuth.js) — passes an artifact lookup into the projection.
- [web/src/composables/useShop.js](../../../web/src/composables/useShop.js) — `bagForRow` exposes row id; `normalizePlacement` and inventory-move set `bagId` at placement time; `rotateBag` / `deactivateBag` guardrails narrowed to current bag, added `buildActiveLayout` + `relayoutBaggedItems` helpers to recompute later-bag virtual y.

Docs:
- [docs/bag-item-placement-persistence.md](../../../docs/bag-item-placement-persistence.md) — rewritten as a current-contract reference (not a fix narrative).

Tests:
- [tests/web/loadout-projection.test.js](../../../tests/web/loadout-projection.test.js) — regenerated with slot-coord semantics, new duplicate-bag and OOB-fallback tests, projection now takes a `getArtifact` callback.
- [tests/game/validator-split.test.js](../../../tests/game/validator-split.test.js) — new slot-bounds, per-bag overlap, and duplicate-bag tests; updated slotCount test to place items at distinct slots.
- [tests/game/bag-items.test.js](../../../tests/game/bag-items.test.js) — `[Req 2-B]`, `[Req 5-A]` validator tests updated to supply slot coords; `[Req 12-D, 5-A]` scenario rewritten to exercise slot coords + bag row id + copy-forward remap.
- [tests/web/use-shop.test.js](../../../tests/web/use-shop.test.js) — `[regression] deactivate/rotate blocks when a later bag contains items` replaced with new `[bag-relayout]` tests pinning the relaxed guardrail.

## Scope call-outs

- **No schema migration.** Column types unchanged. Only the semantic
  interpretation of `x, y, bag_id` for rows with `bag_id IS NOT NULL`
  changed. AGENTS.md "Review Priorities" rule (prefer deterministic
  preservation over schema churn) respected.
- **Legacy rows handled at read-time, not via SQL backfill.** The
  projection fallback drops legacy `bag_id = artifactId` rows and
  `(-1, -1)` sentinels to the container. Pre-production data; no live
  users are affected.
- **Duplicate-bag correctness.** Two `moss_pouch` rows in the same
  round are unambiguously distinct under the new schema. Validator
  tests pin this; projection tests pin it too.
- **`battle-service.getActiveSnapshot` fix was load-bearing.** Without
  `id`, `active`, `rotated` in the projected items, `validateLoadoutItems`
  couldn't resolve bagIds or compute rotation-aware footprints, which
  was why `resolveRound` initially threw "Bag grlitem_… is not placed
  on the grid" in the scenario test until this was patched.

## Not covered / out of this task

- **Playwright prep-screen screenshot for round 2 prep.** Would be a
  stronger end-to-end signal, but the scenario test already covers the
  PUT + copy-forward invariants at the DB level, and the projection
  tests cover the virtual-y reconstruction the browser would observe.
  Running the Playwright suite requires a dev server stack I didn't
  stand up for this task — noting explicitly per AGENTS.md UI
  Verification Rules.
- **Slot-coord migration of any production rows.** Explicit non-goal
  in the spec — pre-production data only, projection absorbs legacy.

## Problems

None — all 297 tests pass; all 8 acceptance criteria PASS with cited
proof. No `problems.md` written (not warranted under the proof-loop
rules).
