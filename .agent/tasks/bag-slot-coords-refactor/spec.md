# Task: Bag Slot Coords Refactor

## Source of truth

### Original user request

> analyze the docs/bag-item-placement-persistence.md, is there any architecture issue? maybe its should be refactored, architecture changed to handle such cases more efficiently and more stable?
>
> ok, do the middle one

"Middle option" refers to the second bullet in the architecture analysis I gave back:

> **Drop virtual y; store `(bag_row_id, slot_x, slot_y)` on bagged items.** `y = 3` stops meaning "first active bag" and starts meaning itself. Bag reordering and rotation become safe without a coord migration. Requires changing the payload shape and the `builderItems` projection, but removes the entire class of "which bag does this y point at?" bugs.

### What "middle option" means concretely

The current schema overloads `game_run_loadout_items.x, y`:

| `bag_id IS NULL`, `x >= 0`  | base-grid coord (0 ≤ y < INVENTORY_ROWS)                           |
| `bag_id IS NULL`, `x = -1`  | container sentinel (unplaced item OR bag row)                      |
| `bag_id IS NOT NULL`, `x,y` | **virtual** grid coords where y = INVENTORY_ROWS + bag-offset      |

Virtual y is an encoding of "position of this item's bag among active bags" + "slot within the bag." That encoding breaks when bags are reordered, rotated, or deactivated — because y is recomputed from a different bag layout than the one that wrote it. This is why bag-active, bag-rotated, and bag-item-placement have all shipped as separate persistence bugs with the same structural cause.

The refactor changes `bag_id IS NOT NULL` rows to store **slot coords** instead of virtual grid coords:

| `bag_id IS NOT NULL`, `x,y` | slot coords within the bag (0 ≤ x < bag cols, 0 ≤ y < bag rows)    |

`bag_id` is also tightened from *artifact_id* (ambiguous when a player owns two of the same bag) to the loadout row id of the bag itself — the primary key on the bag's row in the same round. This requires `copyRoundForward` to remap `bag_id` from round N row ids to round N+1 row ids.

### Acceptance criteria

- **AC1.** Server-side contract change. For rows in `game_run_loadout_items` with `bag_id IS NOT NULL`, `x` and `y` store slot coords (0 ≤ x < bag cols, 0 ≤ y < bag rows in the bag's effective orientation). No virtual grid coords are written or read at the storage layer.
- **AC2.** `bag_id` references the loadout row id of the bag in the same `(game_run_id, player_id, round_number)` tuple. Not the artifact_id.
- **AC3.** `copyRoundForward` preserves bagged-item layout across round boundaries with a row-id remap: `old bag row id → new bag row id`. The remap is built in the same pass that copies rows.
- **AC4.** `validateBagContents` enforces slot bounds (`0 ≤ x < cols && 0 ≤ y < rows`) and no-overlap within each bag. A write that violates either is rejected with a clear error message.
- **AC5.** Client `buildLoadoutPayloadItems` emits `{ bagId: <bagRowId>, x: slotX, y: slotY, width, height }` for every bagged item, where slotX/slotY are computed from the client's virtual-y by subtracting the bag's `startRow`.
- **AC6.** Client `projectLoadoutItems` reconstructs virtual render coords for builderItems from the server's slot coords, given the known active-bags layout. Rows where `bag_id` does not resolve to an active bag row in the payload fall back to `containerItems`.
- **AC7.** Bag rotation and deactivation guardrails only block on contents of the *current* bag, not on later bags' contents. Later bags' slot coords are independent of bag ordering.
- **AC8.** Legacy rows (pre-refactor format: `bag_id = artifactId`, virtual `y >= INVENTORY_ROWS`, or `-1, -1`) route to `containerItems` via the projection fallback so no items are dropped on first read after deploy. Self-heals on next save.

### Constraints

- No schema migration. `x, y, bag_id` column types stay as they are. Only their semantic interpretation changes for bagged rows.
- No production data yet. Pre-production only, so a backfill migration is unnecessary and explicitly a non-goal — the projection fallback handles legacy rows.
- Pure client-only duplicate-bag state (two active `moss_pouch`es) must not collapse into one.
- The `rotateBag` / `deactivateBag` empty-downstream-bags guardrail is removed where it's no longer needed. The guardrails that *still* need to hold (this bag has items) must remain.

### Non-goals

- Changing the storage layout of non-bagged grid items.
- Adding a `placement_kind` discriminator column (the third option from the analysis). That would be a strictly-larger refactor.
- One-shot SQL backfill for legacy bagged rows. Projection fallback does the same job without a migration.
- Validating bag-item footprint against the bag's non-rectangular shape (bags are all rectangular today).

### Open assumptions

- `bag_id` staying a TEXT column that happens to hold a loadout row id (same format as `id`) is acceptable. No FK constraint will be added in this task.
- Each bag's effective `(cols, rows)` is derived on the server via `getArtifactById(bag.artifactId)` + the bag row's `rotated` flag, using `cols = rotated ? min(w,h) : max(w,h)`, `rows = rotated ? max(w,h) : min(w,h)` — mirroring `useShop.bagLayout`.
- Client state `activeBags: Array<{id, artifactId}>` already carries row ids (confirmed via the row-id refactor). `buildLoadoutPayloadItems` can use `bag.id` directly.

### Verification plan

- Unit tests:
  - `tests/web/loadout-projection.test.js`: slot-coord input → reconstructed virtual render coords in builderItems; legacy format → containerItems fallback; unresolved bagId → containerItems fallback.
  - `tests/game/validator-split.test.js` (or `bag-items.test.js`): slot bounds rejection, per-bag overlap rejection.
- Scenario test:
  - `tests/game/bag-items.test.js` `[Req 12-D, 5-A]`: updated to assert slot coords in storage (y = 0 for first slot, not y = INVENTORY_ROWS), and bag_id = bag row id, across PUT + copy-forward.
  - New: duplicate-bag scenario where two `moss_pouch` rows each hold a different item, bag_id disambiguates which slot belongs to which bag.
- End-to-end:
  - Playwright prep-screen screenshot of round 2 after a round-1 bag placement; assert bagged item renders in the bag's row band (not scattered across the base grid). Out of scope if time-boxed away, but noted.

## Implementation touchpoints

- `app/server/services/game-run-loadout.js` — `applyRunPlacements`, `copyRoundForward` (id remap), `readCurrentRoundItems` (unchanged columns, semantics re-interpreted).
- `app/server/services/loadout-utils.js` — `validateBagContents` (slot bounds + per-bag overlap).
- `web/src/composables/useGameRun.js` — `buildLoadoutPayloadItems` (virtual y → slot y).
- `web/src/composables/loadout-projection.js` — accept bag layout info; reconstruct virtual render y for builderItems; fallback for unresolved bagId.
- `web/src/composables/useShop.js` — simplify `rotateBag` and `deactivateBag` guards.
- `tests/web/loadout-projection.test.js`, `tests/game/bag-items.test.js`, possibly `tests/game/validator-split.test.js`.
- `docs/bag-item-placement-persistence.md` — update the architecture section + contract table + non-goals.

## Sequencing

1. Server: validator + copy-forward id remap + `applyRunPlacements` tolerance for new bag_id semantics.
2. Client: payload emitter + projection reconstruction + bag guardrails.
3. Tests: unit first (validator, projection), then scenario (copy-forward + duplicate bag).
4. Doc rewrite.
5. Full verification pass.
