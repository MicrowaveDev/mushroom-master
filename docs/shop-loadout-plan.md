# Shop-based Loadout Plan

## Goal
Replace the current "exactly 3 artifacts from a catalog" loadout flow with a
coin-budget shop, where the player drafts artifacts from a random offer and
drags them into the inventory (Backpack-Battles style).

## Design

### Economy
- Player starts each prep session with **5 coins**.
- Every artifact has a **price** of `1` or `2` coins, derived from its bonuses:
  - weak / 1x1 cheap pieces → 1 coin
  - strong / multi-cell / high-bonus → 2 coins
- Inventory stops accepting artifacts when total cost would exceed 5 coins.

### Artifact catalog (grow 9 → 20)
Add 11 new artifacts across the three families (damage / armor / stun), mixing
shapes (1x1, 1x2, 2x1, 2x2) and bonus weights. Each gets a `price` field.
Keep the existing 9 (price fill-in: 1 for weakest, 2 for strongest per family).

### Shop offer
- On prep-screen entry (and after each battle / reroll request) generate **5
  distinct random artifacts** from the 20-pool and show them in a **bottom-left
  shop container**.
- Shop state is client-side: persisted in `localStorage` per player under
  `mushroom-shop-offer:<playerId>` so navigation doesn't reset it; refreshed
  each time the player returns from a battle.
- Artifacts dragged out are **consumed** from the shop; dragging them back
  returns them to the shop.

### Drag-and-drop (HTML5)
- `draggable="true"` on both shop tiles and placed inventory pieces.
- `dragstart`: capture `{ source: 'shop'|'inventory', artifactId, w, h }`.
- `dragover` on inventory cell: validate fit + coin budget; add preview class.
- `drop` on inventory cell: if valid, place piece, debit coins, remove from
  shop list.
- `drop` on shop container: return the piece, refund coins.
- Rotation: existing per-piece rotate button stays; still constrained by grid.

### Server
- `REQUIRED_ARTIFACT_COUNT` becomes `MAX_ARTIFACT_COINS = 5`.
- `validateLoadoutItems` now checks: ≥0 items, ≤ 6 pieces sanity cap, unique,
  no overlap, fits grid, **total price ≤ 5**.
- Battle start allows 0-piece loadouts (weaker player).
- Bot loadout generator: draws random artifacts while remaining budget
  allows, then auto-places them; falls back gracefully if it can't fit.

## Layout change (artifacts screen)
- Right panel: inventory grid (unchanged 3x2).
- Left panel split: top shows a small "Coins remaining" badge; **shop
  container anchored to the bottom-left**, showing the 5 offers, a reroll
  button (free, once per battle), and a "coins: X/5" HUD.

## Files to touch
1. `app/server/game-data.js`
   - Add 11 artifacts, add `price` on all.
   - Replace `REQUIRED_ARTIFACT_COUNT` with `MAX_ARTIFACT_COINS = 5`.
   - Add `getArtifactPrice(artifact)` helper.
2. `app/server/services/game-service.js`
   - Update `validateLoadoutItems` (budget + sanity cap, no exact count).
   - Update `createBotLoadout` to use budget draft.
3. `web/src/main.js`
   - Wire `MAX_ARTIFACT_COINS`, price display.
   - New `ShopContainer` component (bottom-left, 5 slots).
   - Replace `autoPlaceArtifact` catalog with shop-drag flow.
   - Drag-and-drop handlers on `ArtifactGridBoard` and the shop.
   - Persist shop offer in `localStorage`.
   - Save loadout enabled whenever coins are within budget.
4. `web/src/styles.css`
   - New `.artifact-shop` styles, drag-preview highlight.
   - Adjust `.artifact-layout` grid so shop sits bottom-left.

## Out of scope (for this iteration)
- Persisting the shop offer server-side.
- Paid rerolls or wave-based shop refresh within the same battle.
- Selling artifacts for real currency (`spore`).
