# Client row-id refactor

## Problem

The web client tracks loadout items by `artifactId` across three buckets
(`builderItems`, `containerItems`, `activeBags`), but the game allows a player
to own multiple copies of the same artifact. Every state mutation that filters
or matches by `artifactId` treats duplicates as a single entity, which causes
silent data loss. The surface-level placement bug was patched in commit
3a3ec16 (use `(x,y)` anchor for placed items, array index for container slots),
but sell / buy / bag-activate / bag-deactivate still share the same
anti-pattern and only avoid visible breakage because the client does a
`refreshBootstrap` round-trip after each mutation.

The server already assigns a stable per-row id (`game_run_loadout_items.id`)
and exposes it on the hydration path via `getActiveGameRun → loadoutItems[].id`.
The client currently reads that field and throws it away in
[useAuth.js](../web/src/composables/useAuth.js) during the bootstrap projection.

This refactor threads the server row id through every client state bucket and
every mutation so row identity — not artifact identity — is the source of
truth. Server endpoints that create or mutate rows gain id affordances so the
client never has to guess.

## Goals

1. Every slot in `builderItems`, `containerItems`, and `activeBags` carries
   the server row id that backs it.
2. Mutations (sell, place, unplace, activate/deactivate bag, return to shop)
   target a specific row id, never `artifactId`.
3. The server accepts a row id in `/sell` and `/artifact-loadout` payloads so
   duplicates are disambiguated at the boundary. Backward compat: if the
   client omits the id, the server falls back to the existing artifactId+
   sort-order matching.
4. `/buy` returns the new row id so the client can register the purchase in
   local state without waiting for a bootstrap round-trip.
5. `useAuth.js` hydration captures the row id from `loadoutItems` into every
   state bucket.
6. `buildLoadoutPayloadItems` forwards the row id to the server when known.
7. No artifactId filter anti-patterns remain in sell/buy/bag handlers.
8. `tests/web/use-shop.test.js` fixtures carry row ids; new tests cover the
   duplicate-aware sell and buy-returns-id paths.

## Non-goals

- `freshPurchases` stays a `string[]` of artifactIds. It's decorative UI
  state (badge styling) and doesn't affect correctness.
- `bagId` inside loadout items continues to reference the bag's artifactId,
  not its row id. Bags are one-per-artifactId-per-round by construction
  (commit 3a3ec16 pins them at `(-1,-1)`, and two bags with the same
  artifactId can't coexist as active grid decorations in practice). Changing
  this would require a server schema change that's out of scope here.
- Legacy `applyLegacyPlacements` name stays as-is. Renaming it is orthogonal
  churn.

## Phases

### Phase 1 — Server: expose and accept row ids (non-breaking)

All changes in this phase are additive: clients that don't send the new
fields keep working exactly as before.

1. `buyRunShopItem` in
   [run-service.js](../app/server/services/run-service.js) returns the newly
   inserted row id in its response shape:
   ```js
   return { id: newRowId, coins, artifactId, price, shopOffer };
   ```
2. `sellRunItem` in
   [run-service.js](../app/server/services/run-service.js) grows an optional
   `id` parameter. When set, the server picks the exact row instead of
   calling `deleteOneByArtifactId`. Add a new helper
   `deleteLoadoutItemById(client, rowId, playerId, gameRunId, roundNumber)`
   that enforces ownership (the row must belong to the caller's active run
   and current round) and returns `{ id, artifactId, purchasedRound }` or
   throws. Route handler in [create-app.js](../app/server/create-app.js)
   forwards `req.body.id` alongside `req.body.artifactId`.
3. `applyLegacyPlacements` in
   [game-run-loadout.js](../app/server/services/game-run-loadout.js) gains
   id-based matching. When a payload entry carries `id`, match that exact
   row and update its coords; fall back to the existing sort-order
   bucket-shift only for entries without `id`. Skip silently (don't throw)
   when an id references an unknown row — the client may be stale and a
   fresh bootstrap will reconcile.
4. New service-level tests in [bag-items.test.js](../tests/game/bag-items.test.js)
   or a new file:
   - `buyRunShopItem returns the new row id and inserts a matching row`
   - `sellRunItem with {id} deletes the exact row even when duplicates exist`
   - `sellRunItem without {id} falls back to last-by-sort-order`
   - `applyRunLoadoutPlacements respects row id when disambiguating duplicates`

### Phase 2 — Client: thread row id through state (atomic refactor)

This phase changes data shapes and must land as one coherent change so every
reader and writer moves together.

1. **State shape**
   - `builderItems[i].id` (new field, from hydration or buy response).
   - `containerItems`: `string[]` → `Array<{ id, artifactId }>`. All callers
     updated from `.includes(id)` to `.some(c => c.artifactId === id)` (or
     better, `.some(c => c.id === rowId)` where a row id is available).
   - `activeBags`: `string[]` → `Array<{ id, artifactId }>`. Same treatment.
   - `freshPurchases`: unchanged `string[]`.

2. **Hydration** in [useAuth.js](../web/src/composables/useAuth.js)
   - Carry `id` from `loadoutItems` into each bucket it projects into.
   - `rotatedBags` stays as `string[]` of artifactIds (UI-only).

3. **Buy flow** in [useGameRun.js](../web/src/composables/useGameRun.js)
   `buyRunShopItem`
   - Read `data.id` from the new response and push
     `{ id: data.id, artifactId }` into `containerItems`.

4. **Sell flow** in [useGameRun.js](../web/src/composables/useGameRun.js)
   `sellRunItemAction(rowId)`
   - Signature change: accept a row id, not an artifactId. The caller passes
     the id from whichever bucket holds the clicked item.
   - POST `/sell` with `{ id }` in the body. The server resolves the
     artifactId internally and returns it so the client can also drop from
     `freshPurchases`.
   - Client state updates filter by `id` across `builderItems`,
     `containerItems`, `activeBags`. `freshPurchases` is still removed by
     artifactId since it's decorative.

5. **Place/unplace/drag flows** in [useShop.js](../web/src/composables/useShop.js)
   - `placeFromContainer` / `autoPlaceFromContainer` take the specific
     container slot by index (today) and move its `{ id, artifactId }` into
     `builderItems` preserving the id.
   - `unplaceToContainer(item)` already takes the full item. Push
     `{ id: item.id, artifactId: item.artifactId }` back into
     `containerItems`.
   - `activateBag` / `deactivateBag` pop/push the full `{ id, artifactId }`
     object across `containerItems` and `activeBags`.
   - `returnToShop` still takes `artifactId` at the API level because the
     server doesn't know about "return to shop" as an operation — it's a
     pure client-side undo within the shop buffer.

6. **Payload building** in
   [useGameRun.js](../web/src/composables/useGameRun.js)
   `buildLoadoutPayloadItems`
   - Forward `id` for every item that has one. New/freshly-bought items that
     haven't been reconciled with a row id yet still go out by artifactId
     only, and the server's existing fallback handles them.

7. **Component props** in
   [PrepScreen.js](../web/src/pages/PrepScreen.js) and
   [ArtifactGridBoard.js](../web/src/components/ArtifactGridBoard.js)
   - `containerArtifacts` computed gets the id-aware shape. Any child that
     emits an id uses the row id, not the artifactId.
   - `@piece-click="$emit('unplace', $event)"` already forwards the full item.
   - Sell-zone drop resolves to the dragged instance's row id.

### Phase 3 — Tests

1. Update fixtures in [use-shop.test.js](../tests/web/use-shop.test.js) to
   include `id` on every placed item and to seed `containerItems` with
   `{ id, artifactId }` objects. The existing tests should keep passing
   semantically — they'll just also assert the id follows the item.
2. New regression tests in
   [use-shop.test.js](../tests/web/use-shop.test.js):
   - `containerItems hydrated from loadoutItems carry the row id`
   - `placing a container item moves the id into builderItems`
   - `sellRunItemAction(rowId) removes only the targeted row from every bucket`
   - `buyRunShopItem response row id is stored on the new container slot`
3. New service tests in
   [bag-items.test.js](../tests/game/bag-items.test.js) or a new file:
   - Phase 1 server tests listed above.

### Phase 4 — Cleanup

1. Grep for residual `filter(x => x.artifactId !== id)` patterns in
   `web/src/composables` and fix any stragglers.
2. Remove the sort-order fallback comment trail where it's no longer
   load-bearing (keep the fallback itself — it remains the safety net for
   pre-refactor clients).
3. Document the new client state shapes in
   [loadout-refactor-plan.md](loadout-refactor-plan.md) under §2.5
   projection notes.

## Risk assessment

- **Server endpoints**: additive, backward compatible. Low risk.
- **Atomic client refactor**: this is the high-risk part. The data-shape
  flip for `containerItems` and `activeBags` touches every file in
  `web/src/composables`. Mitigation: land Phase 2 as a single commit with
  all readers and writers updated together, and run the full test suite
  before pushing.
- **Silent desyncs**: the refactor's whole point is to remove the class of
  bugs where `refreshBootstrap` paints over wrong local state. The
  regression tests pin the invariants so future drift is caught.

## Done when

- All 240+ existing tests still pass.
- New phase 1 + phase 3 tests are green.
- Grep for `filter((i) => i.artifactId !==` and `filter((id) => id !==` in
  `web/src/composables` returns no results (or only `rotatedBags` / other
  intentionally artifact-keyed buckets).
- `sellRunItemAction` takes a row id. The UI click path threads the id from
  the clicked element through the handler chain.
- `buyRunShopItem` stores the returned row id on the new container slot so
  the next action against that item doesn't need a bootstrap refresh.
