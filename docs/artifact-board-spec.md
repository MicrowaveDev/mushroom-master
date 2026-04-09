# Artifact Board System — Technical Specification

## Game Design Overview

### Core Loop

The game is a mushroom auto-battler with a roguelike run structure inspired by Backpack Battles:

```
Start Run → [Prep Phase → Battle Phase → Result Phase] × up to 9 rounds → Run Complete
```

Each run is isolated — artifacts and bags purchased during a run are cleared when it ends.

### Prep Phase (where the artifact board lives)

The player has three zones during prep:

1. **Shop** — 5 random artifacts offered each round. Player spends coins to buy.
2. **Container (Backpack)** — holding area for purchased items not yet placed on the grid.
3. **Inventory Grid** — the active loadout. Only grid-placed artifacts contribute combat stats.

The player's goal: fill the 3x2 inventory grid with artifacts that maximize their mushroom's combat effectiveness, while managing a limited coin budget.

### Artifacts: Combat Modifiers

Artifacts provide **four stat bonuses** that directly modify mushroom combat stats:

| Stat | Effect in Battle |
|------|-----------------|
| **Damage** | Additive to base attack. Higher = more resolved damage per hit. |
| **Armor** | Additive to base defense. Reduces all incoming damage (min 1). |
| **Speed** | Modifies action order. Faster = acts first each combat step. |
| **Stun Chance** | % chance to stun opponent (skip their next action). Capped at 35%. |

**Design tension:** Powerful artifacts have trade-offs. Glass Cap gives +5 DMG but costs -2 ARM. Truffle Bulwark gives +7 ARM but costs -2 SPD, -1 DMG. Players must balance offense, defense, and utility.

**Size matters:** Artifacts come in 1x1, 1x2, 2x1, and 2x2. Larger artifacts are generally more powerful but harder to fit in the limited grid.

### Bags: Inventory Expansion

Bags are **not combat items** — they have no stat bonuses (`bonus: {}`). They are purely a storage investment:

- **Moss Pouch** (2 coins, 2 extra cells): Adds 1 row of 2 usable cells
- **Amber Satchel** (3 coins, 4 extra cells): Adds 2 rows (3 + 1 usable cells)

**Strategic trade-off:** Spending coins on a bag means fewer coins for combat artifacts this round, but more grid space for future rounds. Bags persist across rounds within a run, so early bag purchases compound in value.

When a bag is activated from the container, it does NOT occupy existing grid cells. Instead, it **appends colored rows** below the base grid. These rows are visually distinct (dashed border in the bag's color) to differentiate them from the base inventory.

### Economy

**Round income:** Coins are awarded each round (5, 5, 5, 6, 6, 7, 7, 8, 8 for rounds 1-9). Unspent coins carry over.

**Shop refresh:** Costs 1 coin for the first 3 refreshes per round, then 2 coins. Refresh count resets each round.

**Sell refund:** Full price if sold in the same round purchased, half price (floor) if sold in later rounds. Non-empty bags cannot be sold.

### Mushrooms and Artifact Synergy

Five playable mushrooms each have base stats and passives that favor different artifact strategies:

| Mushroom | Archetype | Key Passive | Best Artifact Pairing |
|----------|-----------|-------------|----------------------|
| **Thalla** | Control | Stun echo: +2 DMG after successful stun | Stun + Speed |
| **Lomie** | Defensive | Soft Wall: first hit reduced by 3 | Armor stacking |
| **Axilin** | Aggressive | Every 3rd hit: +3 bonus DMG | Pure damage |
| **Kirt** | Balanced | If not stunned: +1 SPD next turn | Flexible |
| **Morga** | Glass cannon | First action: +4 DMG | Damage + Stun (first-strike) |

### Bag Appearance in Shop

Bags appear in the shop with **escalating probability**:
- Base chance: 15% per shop slot
- +8% for each consecutive round without a bag appearing
- Hard pity: if 5+ rounds without a bag, one is forced into the offer

### Combat Resolution

Battles are deterministic 1v1 duels resolved server-side in up to 12 steps:
1. Speed determines action order each step
2. Attacker deals `base_attack + artifact_damage - defender_armor` (min 1)
3. Stun roll: if successful, defender skips next action
4. Battle ends on death or after step 12 (no draws in game runs)

### Visual Design Rules

**Artifact rendering by family:**

| Family | Shell Color | Border | Accent | Visual Feel |
|--------|------------|--------|--------|-------------|
| Damage | `#f5d59d` warm gold | `#9d6130` brown | `#cc6b2c` orange | Warm, aggressive |
| Armor | `#d8e5cc` sage | `#5f7c4f` forest | `#86a46d` green | Natural, sturdy |
| Stun | `#dfe3b7` olive | `#7a6f26` dark gold | `#c2a942` gold | Electric, volatile |
| Bag | `${color}33` tinted | `${color}` solid | `${color}` solid | Matches bag type |

**Bag cells in the grid** are visually distinct:
- Dashed border (not solid) in the bag's color
- Radial gradient glow from the bag's color
- Disabled/overflow cells are hidden (`visibility: hidden`)

**Bags in the shop/container** render as **empty colored cells** (no interior glyph), signaling they are storage, not combat items.

---

## 1. Grid System

### Constants

| Constant | Value | File |
|----------|-------|------|
| `INVENTORY_COLUMNS` | 3 | `web/src/constants.js` |
| `INVENTORY_ROWS` | 2 | `web/src/constants.js` |
| `MAX_ARTIFACT_COINS` | 5 | `web/src/constants.js` |
| `SHOP_OFFER_SIZE` | 5 | `web/src/constants.js` |
| `REROLL_COST` | 1 | `web/src/constants.js` |

### Cell Sizes (CSS `--artifact-cell-size`)

| Context | Value |
|---------|-------|
| Default | 50px |
| Inventory grid | 44px |
| Container item visual | 44px |
| Shop item visual | 44px |
| Battle prep inventory | 40px |
| Fighter inline (replay) | 22px |
| Results screen | 38px |

### Grid Layout

- CSS Grid with `grid-template-columns: repeat(columns, var(--artifact-cell-size))`
- Background grid layer and piece layer are stacked via `position: absolute` inside `.inventory-shell`
- Cells are square: width = height = `--artifact-cell-size`
- Gap between cells: 8px (inventory-shell), 3px (fighter inline)

---

## 2. Artifact Data Model

### Schema

```
{
  id: string                          — unique identifier
  name: { ru: string, en: string }    — multilingual display name
  family: 'damage' | 'armor' | 'stun' | 'bag'
  width: number                       — grid cells wide (1 or 2)
  height: number                      — grid cells tall (1 or 2)
  price: number                       — coin cost (1, 2, or 3)
  bonus: { damage?, armor?, speed?, stunChance? }
  slotCount?: number                  — bag family only (2 or 4)
  color?: string                      — bag family only (hex)
}
```

### All Artifacts

**Damage family:**

| ID | Size | Price | Bonus |
|----|------|-------|-------|
| `spore_needle` | 1x1 | 1 | +2 DMG |
| `sporeblade` | 1x1 | 1 | +3 DMG |
| `amber_fang` | 1x2 | 2 | +4 DMG, -1 ARM |
| `glass_cap` | 2x1 | 2 | +5 DMG, -2 ARM |
| `fang_whip` | 2x1 | 2 | +6 DMG, -3 ARM |
| `burning_cap` | 2x2 | 2 | +8 DMG, -2 ARM, -1 SPD |

**Armor family:**

| ID | Size | Price | Bonus |
|----|------|-------|-------|
| `bark_plate` | 1x1 | 1 | +2 ARM |
| `loam_scale` | 1x1 | 1 | +3 ARM, -1 SPD |
| `mycelium_wrap` | 2x1 | 1 | +3 ARM |
| `stone_cap` | 1x2 | 2 | +4 ARM |
| `root_shell` | 2x2 | 2 | +5 ARM, -1 SPD |
| `truffle_bulwark` | 2x2 | 2 | +7 ARM, -2 SPD, -1 DMG |

**Stun family:**

| ID | Size | Price | Bonus |
|----|------|-------|-------|
| `shock_puff` | 1x1 | 1 | +8% STUN |
| `glimmer_cap` | 1x1 | 1 | +6% STUN |
| `dust_veil` | 1x2 | 2 | +12% STUN |
| `static_spore_sac` | 1x2 | 2 | +14% STUN, -1 DMG |
| `thunder_gill` | 2x1 | 2 | +20% STUN, -1 ARM |
| `spark_spore` | 2x2 | 2 | +25% STUN, -2 DMG |

**Hybrid:**

| ID | Size | Price | Bonus |
|----|------|-------|-------|
| `moss_ring` | 1x1 | 1 | +1 DMG, +1 ARM |
| `haste_wisp` | 1x1 | 1 | +1 SPD |

**Bag family:**

| ID | Size | Price | Slots | Color |
|----|------|-------|-------|-------|
| `moss_pouch` | 1x2 | 2 | 2 | `#6b8f5e` (green) |
| `amber_satchel` | 2x2 | 3 | 4 | `#d4a54a` (amber) |

---

## 3. Bag System

### Bag Activation

When a bag is clicked in the container (or auto-placed), it does NOT occupy cells like a regular artifact. Instead it **expands the grid** by adding extra rows.

**Flow:**
1. `autoPlaceFromContainer(bagId)` detects `family === 'bag'` and calls `activateBag(bagId)`
2. `activateBag`: adds to `state.activeBags`, removes from `state.containerItems`
3. Grid rows become: `effectiveRows() = INVENTORY_ROWS + sum(bagRowCount(id) for each activeBag)`

### Bag Layout Calculation

```
bagLayout(bagId):
  rotated = state.rotatedBags.includes(bagId)
  cols = rotated ? min(width, height) : max(width, height)  // capped at INVENTORY_COLUMNS
  rows = rotated ? max(width, height) : min(width, height)
```

**moss_pouch (1x2):**
- Default: 2 cols, 1 row — 2 usable cells side by side, 1 hidden
- Rotated: 1 col, 2 rows — 1 usable cell per row, 2 hidden per row

**amber_satchel (2x2):**
- Always: 2 cols, 2 rows — not rotatable (square)

### Disabled Cells

Cells beyond the bag's column count in a bag row are disabled:
- `isCellDisabled(cx, cy)`: returns true if `cx >= bagCols` for that row
- Disabled cells: `visibility: hidden`, cannot receive drops
- Placement validation (`normalizePlacement`) also checks `isCellDisabled`

### Bag Rotation

- `rotateBag(bagId)`: toggles ID in `state.rotatedBags`
- Only allowed for non-square bags (width !== height)
- Requires all items in bag rows to be removed first
- Visually swaps the bag row layout (cols <-> rows)

### Bag Deactivation

- `deactivateBag(bagId)`: removes from `state.activeBags`, returns to `state.containerItems`
- Blocked if any items are placed in the bag's rows
- Error message: "Remove items from the bag first"

### Bag Rendering

- In shop and container: bags render as **empty colored cells** (no glyph SVG), using the bag's theme colors
- The `renderArtifactFigure` function skips `renderArtifactGlyph` when `artifact.family === 'bag'`
- Each cell still has the shell/border/glow SVG rects, just no interior glyph

---

## 4. Rendering Pipeline

### artifactTheme(artifact) -> { shell, border, accent, ink, glow }

| Family | shell | border | accent | ink | glow |
|--------|-------|--------|--------|-----|------|
| damage | `#f5d59d` | `#9d6130` | `#cc6b2c` | `#4f2f12` | `rgba(255,183,112,0.45)` |
| armor | `#d8e5cc` | `#5f7c4f` | `#86a46d` | `#21351c` | `rgba(148,188,138,0.35)` |
| stun | `#dfe3b7` | `#7a6f26` | `#c2a942` | `#393214` | `rgba(233,218,129,0.4)` |
| bag | `${color}33` | `${color}` | `${color}` | `#2a2a2a` | `${color}40` |

### renderArtifactFigure(artifact, displayWidth, displayHeight) -> HTML

Produces a grid of SVG cells:
```html
<div class="artifact-figure-grid"
     style="grid-template-columns: repeat(W, minmax(0, 1fr))">
  <div class="artifact-figure-cell">
    <svg viewBox="0 0 80 80">
      <rect x="4" y="4" width="72" height="72" rx="20"
            fill="${shell}" stroke="${border}" stroke-width="6" />
      <rect x="10" y="10" width="60" height="60" rx="16"
            fill="${glow}" opacity="0.8" />
      ${isBag ? '' : renderArtifactGlyph(artifact, theme, x, y)}
    </svg>
  </div>
  ...
</div>
```

### renderArtifactGlyph(artifact, theme, x, y) -> SVG paths

Each artifact ID maps to a unique SVG glyph. Bag glyphs (moss_pouch, amber_satchel) include a `<text>` element showing `slotCount`.

---

## 5. Shop System

### Legacy Shop (ArtifactsScreen)

**Coin budget:** `MAX_ARTIFACT_COINS` (5), shared between purchases and rerolls.

| Action | Function | Effect |
|--------|----------|--------|
| Buy | `buyFromShop(id)` | Remove from shopOffer, add to containerItems + freshPurchases |
| Return | `returnToShop(id)` | Remove from containerItems + freshPurchases, add back to shopOffer |
| Reroll | `rerollShop(free)` | Generate new 5-item offer, deduct 1 coin from budget |
| Sell price | `getSellPrice(id)` | Full price if in freshPurchases, else floor(price/2) |

### Game Run Shop (PrepScreen)

**Coins:** Per-player, earned each round (`ROUND_INCOME` array), carried between rounds.

| Action | Function | API Endpoint | Effect |
|--------|----------|-------------|--------|
| Buy | `buyRunShopItem(id)` | `POST /api/game-run/:id/buy` | Deduct coins, remove from gameRunShopOffer, add to containerItems |
| Sell | `sellRunItemAction(id)` | `POST /api/game-run/:id/sell` | Refund coins, remove from builderItems/containerItems/activeBags |
| Refresh | `refreshRunShop()` | `POST /api/game-run/:id/refresh-shop` | Deduct coins, new offer from server |
| Refresh cost | `getRunRefreshCost()` | — | `refreshCount < 3 ? 1 : 2` |
| Sell price | `getRunSellPrice(id)` | — | Full if in freshPurchases, else floor(price/2) |

---

## 6. Container Flow

### Container Zone

Displays purchased artifacts not yet placed on the grid.

**Click behavior:**
- Regular artifact: `autoPlaceFromContainer(id)` — finds first valid grid position
- Bag: `activateBag(id)` — expands grid instead of placing

### Auto-Place Algorithm

```
autoPlaceFromContainer(artifactId):
  if family === 'bag': activateBag(artifactId); return
  orientations = [preferred, rotated]  // skip rotated if square
  for each orientation:
    for y = 0..effectiveRows():
      for x = 0..INVENTORY_COLUMNS:
        if normalizePlacement(artifact, x, y, w, h) succeeds:
          place and return
  error: "Does not fit in inventory"
```

### Manual Placement

`placeFromContainer(artifactId, x, y)`: tries preferred orientation first, then rotated. Calls `normalizePlacement` for validation.

### Unplace

`unplaceToContainer(artifactId)`: removes from `builderItems`, adds back to `containerItems`.

---

## 7. Placement Validation

### normalizePlacement(artifact, x, y, width, height) -> builderItems[] | null

1. Check bounds: `x + w <= INVENTORY_COLUMNS` and `y + h <= effectiveRows()`
2. Build occupancy map of all other placed items
3. For each cell `(x+dx, y+dy)`:
   - Must not be occupied by another artifact
   - Must not be a disabled bag cell (`isCellDisabled`)
4. Returns new `builderItems` array with the candidate added, or `null` if invalid

### buildOccupancy(items) -> Map<"x:y", artifactId>

Iterates all items' cells and creates a lookup map. Used for overlap detection.

### preferredOrientation(artifact) -> { width, height }

Returns the artifact's preferred display orientation (typically `{ width: max(w,h), height: min(w,h) }` — horizontal preferred).

---

## 8. Drag and Drop

### Drag Sources

| Source | CSS Selector | State Set | Validation |
|--------|-------------|-----------|------------|
| Shop item | `.shop-item[draggable]` | `draggingSource='shop'` | Must have enough coins |
| Container item | `.container-item[draggable]` | `draggingSource='container'` | Always allowed |
| Inventory piece | `.artifact-piece-wrap[draggable]` | `draggingSource='inventory'` | Always allowed |

### Drop Targets

| Target | Accepts From | Handler | Action |
|--------|-------------|---------|--------|
| Container zone | shop, inventory | `onContainerDrop` | Buy or unplace |
| Inventory cell | container, inventory | `onInventoryCellDrop` | Place or move |
| Shop zone | container, inventory | `onShopDrop` | Return to shop |
| Sell zone | container, inventory | `onSellZoneDrop` | Sell for coins (game run only) |

### Drag State

```
state.draggingArtifactId: string  — artifact being dragged
state.draggingSource: string      — 'shop' | 'container' | 'inventory'
```

Cleared by `onDragEndAny()` after any drag operation.

---

## 9. Sell Zone (Game Run Only)

- Visible on PrepScreen below the inventory
- Shows dynamic sell price during dragover
- Full price if item is in `freshPurchases`, half price otherwise
- Server validates: non-empty bags cannot be sold

---

## 10. ArtifactGridBoard Component

**File:** `web/src/components/ArtifactGridBoard.js`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | Number | 3 | Grid columns |
| `rows` | Number | 2 | Grid rows (dynamic with bags) |
| `items` | Array | `[]` | Placed pieces `[{ artifactId, x, y, width, height }]` |
| `variant` | String | `'inventory'` | `'inventory'` or `'catalog'` |
| `renderArtifactFigure` | Function | required | Renders artifact HTML |
| `getArtifact` | Function | required | Looks up artifact by ID |
| `interactiveCells` | Boolean | false | Cells are clickable |
| `clickablePieces` | Boolean | false | Pieces are clickable |
| `rotatablePieces` | Boolean | false | Show rotate button |
| `droppable` | Boolean | false | Cells accept drops |
| `draggablePieces` | Boolean | false | Pieces are draggable |
| `bagRows` | Array | `[]` | `[{ row, color, artifactId, slotCount }]` |

### Emits

| Event | Payload | When |
|-------|---------|------|
| `cell-click` | `{ x, y }` | Interactive cell clicked |
| `piece-click` | item | Clickable piece clicked |
| `piece-rotate` | item | Rotate button clicked |
| `cell-drop` | `{ x, y, event }` | Item dropped on cell |
| `piece-drag-start` | `{ item, event }` | Piece drag started |
| `piece-drag-end` | `{ item, event }` | Piece drag ended |

### Variants

- **inventory**: Full interactive grid. Two layers: background (cells) + pieces (positioned via grid-column/row). Supports drag-drop, click, rotate.
- **catalog**: Static read-only display. No background grid. Pieces rendered inline. Used in shop cards and container items.

### Bag Cell Rendering

Bag rows inject CSS custom properties per cell:
```css
--bag-color: #6b8f5e
--bag-color-light: #6b8f5e33
--bag-color-glow: #6b8f5e40
```

Cells with `cx >= slotCount` get class `artifact-grid-cell--bag-disabled` (hidden).

---

## 11. State Management

### Artifact-Related State Fields

```
builderItems: Array<{ artifactId, x, y, width, height }>
containerItems: Array<artifactId>
activeBags: Array<artifactId>
rotatedBags: Array<artifactId>
freshPurchases: Array<artifactId>
shopOffer: Array<artifactId>              — legacy shop
gameRunShopOffer: Array<artifactId>       — game run shop
gameRunRefreshCount: number
rerollSpent: number                       — legacy shop
draggingArtifactId: string
draggingSource: 'shop' | 'container' | 'inventory' | ''
sellDragOver: boolean
actionInFlight: boolean
```

### State Reset Points

| Event | Fields Reset |
|-------|-------------|
| New game run | builderItems, containerItems, activeBags, rotatedBags, freshPurchases |
| Page reload (with active run) | Restored from server loadoutItems + shopState |
| Page reload (no run) | Restored from shopState (persistShopOffer payload) |

---

## 12. Persistence

### persistShopOffer Payload

Sent to `PUT /api/shop-state` after every mutation:
```json
{
  "offer": ["id1", "id2", ...],
  "container": ["id3", ...],
  "freshPurchases": ["id3"],
  "builderItems": [{ "artifactId": "id4", "x": 0, "y": 0, "width": 1, "height": 1 }],
  "activeBags": ["moss_pouch"],
  "rotatedBags": [],
  "rerollSpent": 0
}
```

### Game Run State Restoration

On page reload with an active game run (`state.bootstrap.activeGameRun`):

1. Server returns `loadoutItems` (filtered by `purchased_round IS NOT NULL`) and `shopOffer`
2. Frontend separates items:
   - **activeBags**: bag-family items whose ID is in `shopState.activeBags`
   - **builderItems**: non-bag items with `x >= 0, y >= 0`
   - **containerItems**: items with `x < 0` (unplaced) + unactivated bags
3. `rotatedBags` restored from `shopState.rotatedBags`
4. `freshPurchases` restored from `shopState.freshPurchases`, filtered to items in loadout

---

## 13. Game Run vs Legacy Shop

| Feature | Legacy (ArtifactsScreen) | Game Run (PrepScreen) |
|---------|--------------------------|----------------------|
| Coin source | Fixed budget of 5 | Per-round income from server |
| Shop generation | Client-side random | Server-side deterministic (seeded RNG) |
| Shop persistence | Client shopState | Server `game_run_shop_states` table |
| Sell mechanism | Return to shop (full refund if fresh) | Sell zone (refund to coin pool) |
| Refresh cost | 1 coin (fixed) | 1 coin (first 3), 2 coins (4+) |
| Loadout save | Manual "Save" button | Auto on "Ready" signal |
| State on reload | From `shopState` | From server `loadoutItems` + `shopState` |

---

## 14. Key Function Signatures

### Grid Utilities (`web/src/artifacts/grid.js`)

```
buildOccupancy(items: Item[]) -> Map<string, string>
getArtifactPrice(artifact: Artifact) -> number
pickRandomShopOffer(artifacts: Artifact[], excludeIds: Set) -> string[]
preferredOrientation(artifact: Artifact) -> { width, height }
deriveTotals(items: Item[], artifacts: Artifact[]) -> { damage, armor, speed, stunChance }
```

### Shop Composable (`web/src/composables/useShop.js`)

```
effectiveRows() -> number
bagLayout(bagId: string) -> { cols: number, rows: number }
bagRowCount(bagId: string) -> number
bagForRow(row: number) -> { bagId, startRow, rowCount, cols } | null
isCellDisabled(cx: number, cy: number) -> boolean
normalizePlacement(artifact, x, y, width?, height?) -> Item[] | null
activateBag(artifactId: string) -> void
deactivateBag(artifactId: string) -> void
rotateBag(bagId: string) -> void
autoPlaceFromContainer(artifactId: string) -> void
placeFromContainer(artifactId: string, x: number, y: number) -> boolean
unplaceToContainer(artifactId: string) -> void
rotatePlacedArtifact(item: Item) -> void
buyFromShop(artifactId: string) -> boolean
returnToShop(artifactId: string) -> void
getSellPrice(artifactId: string) -> number
rerollShop(free: boolean) -> void
```

### Game Run Composable (`web/src/composables/useGameRun.js`)

```
startNewGameRun(mode?: string) -> async void
resumeGameRun() -> void
signalReady() -> async void
continueToNextRound() -> async void
loadRunShopOffer() -> async void
buyRunShopItem(artifactId: string) -> async void
sellRunItemAction(artifactId: string) -> async void
refreshRunShop() -> async void
getRunRefreshCost() -> number
getRunSellPrice(artifactId: string) -> number
abandonRun() -> async void
```

---

## 15. CSS Classes Reference

### Grid

| Class | Purpose |
|-------|---------|
| `.inventory-shell` | Relative container for grid layers |
| `.artifact-grid-board` | Root component |
| `.artifact-grid-board--inventory` | Inventory variant |
| `.artifact-grid-board--catalog` | Catalog variant (static) |
| `.artifact-grid-background` | Cell background layer |
| `.artifact-grid-pieces` | Piece layer (absolute) |
| `.artifact-grid-cell` | Individual grid cell |
| `.artifact-grid-cell--interactive` | Clickable cell |
| `.artifact-grid-cell--drop-target` | Dragover highlight (gold glow) |
| `.artifact-grid-cell--bag` | Bag row cell, enabled (dashed colored border) |
| `.artifact-grid-cell--bag-disabled` | Bag row cell, disabled (hidden) |

### Pieces

| Class | Purpose |
|-------|---------|
| `.artifact-piece-wrap` | Piece container (grid positioned) |
| `.artifact-piece` | Piece element (button or div) |
| `.artifact-piece.mini` | Catalog variant (smaller shadow) |
| `.artifact-piece-rotate` | Rotation button (top-right circle) |
| `.artifact-figure-grid` | Multi-cell figure container |
| `.artifact-figure-cell` | Individual SVG cell |
| `.artifact-figure-svg` | SVG element (viewBox 0 0 80 80) |

### Container

| Class | Purpose |
|-------|---------|
| `.artifact-container-zone` | Backpack area |
| `.artifact-container-header` | Header with count |
| `.artifact-container-count` | Count badge |
| `.artifact-container-items` | Flex-wrap item list |
| `.artifact-container-empty` | Empty state hint |
| `.container-item` | Individual item card |
| `.container-item-visual` | Grid board preview |
| `.container-item-copy` | Text info |

### Shop

| Class | Purpose |
|-------|---------|
| `.artifact-shop` | Shop container |
| `.artifact-shop-header` | Header with refresh button |
| `.artifact-shop-items` | 2-column item grid |
| `.shop-item` | Individual shop card |
| `.shop-item--expensive` | Unaffordable (disabled opacity) |
| `.shop-item--bag` | Bag border styling |
| `.shop-item-visual` | Grid board preview |
| `.shop-item-name` | Artifact name |
| `.shop-item-price` | Price display |
| `.shop-item-tags` | Stat chips row |

### Sell Zone

| Class | Purpose |
|-------|---------|
| `.sell-zone` | Drop target area (dashed border) |
| `.sell-zone--active` | Dragover state (orange highlight) |

### Bags

| Class | Purpose |
|-------|---------|
| `.active-bags-bar` | Flex row of active bag chips |
| `.active-bag-chip` | Individual bag chip (bordered pill) |
| `.active-bag-action` | Rotate/remove button in chip |

### Stats

| Class | Purpose |
|-------|---------|
| `.artifact-stat-chip` | Stat badge |
| `.artifact-stat-chip--pos` | Positive bonus (green) |
| `.artifact-stat-chip--neg` | Negative penalty (red) |
| `.artifact-stat-chip--bag` | Bag slot count badge |
