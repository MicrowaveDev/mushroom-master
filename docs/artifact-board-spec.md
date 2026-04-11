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

### Core Principle: Bags Never Occupy Grid Cells

**Bags are a unified, uniform concept:** they are pure slot providers that expand the inventory by adding extra rows below the base grid. A bag never consumes any of the base `INVENTORY_COLUMNS × INVENTORY_ROWS` cells.

This is the same model everywhere:
- Client state: bags live in `state.activeBags`, not `state.builderItems`
- Server DB: bags have no meaningful `x, y` coordinates (stored as `0, 0` as a sentinel)
- Server validation: the `family === 'bag'` check short-circuits bounds/overlap checks
- Battle snapshots: bags are filtered out of the artifact summary (`buildArtifactSummary` skips them)

There is no "virtual bag" vs "grid bag" distinction — every bag works the same way.

### Bag Activation

When a bag is clicked in the container (or auto-placed), it is added to `state.activeBags` and removed from `state.containerItems`. No grid placement happens.

**Flow:**
1. `autoPlaceFromContainer(bagId)` detects `family === 'bag'` and calls `activateBag(bagId)`
2. `activateBag(bagId)`:
   - Adds to `state.activeBags`
   - Removes from `state.containerItems`
   - Calls `persistShopOffer()` to sync state
3. Grid rows become: `effectiveRows() = INVENTORY_ROWS + sum(bagRowCount(id) for each activeBag)`

### Bag Layout Calculation

Each active bag contributes 1+ rows of slots to the grid. The number of rows and usable columns per row depends on the bag's dimensions and rotation state:

```
bagLayout(bagId):
  rotated = state.rotatedBags.includes(bagId)
  cols = rotated ? min(width, height) : max(width, height)   // capped at INVENTORY_COLUMNS
  rows = rotated ? max(width, height) : min(width, height)
  → returns { cols, rows }
```

**moss_pouch (width=1, height=2, slotCount=2):**
- Default: 2 cols × 1 row → 2 usable cells side by side, 1 hidden
- Rotated: 1 col × 2 rows → 1 usable cell per row, 2 hidden per row

**amber_satchel (width=2, height=2, slotCount=4):**
- Always: 2 cols × 2 rows → not rotatable (square), 4 usable cells total

### Bag Row Mapping

Active bags are assigned consecutive rows starting at `INVENTORY_ROWS`:

```
bagForRow(row):
  r = INVENTORY_ROWS
  for each bagId in state.activeBags:
    rowCount = bagLayout(bagId).rows
    if row >= r and row < r + rowCount:
      return { bagId, startRow: r, rowCount, cols: bagLayout(bagId).cols }
    r += rowCount
  return null
```

### Disabled Cells

Cells beyond the bag's column count in a bag row are visually hidden and non-interactive:

- `isCellDisabled(cx, cy)`: returns `true` if `cy >= INVENTORY_ROWS` AND `cx >= bag.cols` for that row
- Disabled cells get class `artifact-grid-cell--bag-disabled` with `visibility: hidden`
- `normalizePlacement()` rejects any placement whose footprint covers a disabled cell
- Drop handlers `onCellDragOver` and `onCellDrop` no-op for disabled cells

### Bag Rotation

- `rotateBag(bagId)`: toggles the bag ID in `state.rotatedBags`
- Only allowed for non-square bags (width !== height)
- **Blocked** if any items exist in the bag's row range — player must first remove them
- Visually swaps the bag row layout (cols ↔ rows), changing the shape from wide to tall or vice versa

### Bag Deactivation

- `deactivateBag(bagId)`: removes bag from `state.activeBags`, returns it to `state.containerItems`
- **Blocked** if any items are placed in the bag's rows
- Error message: `"Сначала уберите предметы из сумки"` / `"Remove items from the bag first"`

### Persistence: Client → Server Mapping

When signalling ready, `buildLoadoutPayloadItems()` in `useGameRun.js` translates the frontend state into a payload the server can validate and persist. The translation is lossless and preserves bag associations:

```
for each bagId in state.activeBags:
  → payload item { artifactId: bagId, x:0, y:0, w, h }          // bag (coords ignored)

for each artifactId in state.containerItems (bags first):
  → payload item { artifactId, x:-1, y:-1, w, h }                // container (unactivated)

for each item in state.builderItems:
  if item.y < INVENTORY_ROWS:
    → payload item { artifactId, x, y, w, h }                    // base grid item
  else:
    → find the bag whose row range contains item.y
    → payload item { artifactId, w, h, bagId }                   // bagged item

for each non-bag artifactId in state.containerItems:
  → payload item { artifactId, x:-1, y:-1, w, h }                // container (non-bag)
```

**Ordering matters:** bags are always emitted **before** bagged items so that `validateLoadoutItems` sees the bag registered in `bagSlotUsage` by the time a bagged item references it.

**Container marker:** items in the container (bought but not placed) use `x=-1, y=-1` as a sentinel. Bags get `x=0, y=0` because bags never have grid coordinates regardless of container/active state — the `state.activeBags` set on the client is the only source of truth for which bags are expanded.

### Server Validation

`validateLoadoutItems(items, coinBudget)` in `app/server/services/loadout-utils.js`:

1. **Partitions items** into `gridItems` (no `bagId`) and `baggedItems` (has `bagId`).
2. **For each gridItem:**
   - If `artifact.family === 'bag'` → register in `bagSlotUsage.set(bagId, 0)` and **skip** bounds/overlap checks (bags never occupy cells).
   - If `x < 0 || y < 0` → item is in the container, **skip** bounds/overlap checks (container items stay in the loadout for persistence but contribute no combat stats).
   - Otherwise → enforce `x, y, x+w, y+h` within `INVENTORY_COLUMNS × INVENTORY_ROWS`, check no overlap with `occupied` set.
3. **For each baggedItem:**
   - `bagId` must reference a bag already in `bagSlotUsage` (throws `"Bag X is not placed on the grid"` otherwise)
   - Consumes `item.width × item.height` slot cells (so a 1×2 item uses 2 slots, a 2×2 uses 4)
   - Total consumed cells must not exceed `bagArtifact.slotCount` (throws `"Bag X is full"` otherwise)
4. **Coin budget check**: sum of all item prices must not exceed `coinBudget`. In game runs this is `sum(ROUND_INCOME[0..currentRound])` — the cumulative income ceiling. Outside a game run, it's the legacy `MAX_ARTIFACT_COINS` (5). See [balance.md](./balance.md) for the rationale.

### Combat Stat Contribution

`buildArtifactSummary(items)` skips two item types when computing combat totals:
- **Bags** (`family === 'bag'`) — bags have empty `bonus: {}`, they only provide storage
- **Container items** (`x < 0 || y < 0` AND no `bagId`) — unplaced items don't fight

Placed grid items and bagged items (items inside bags) both contribute stats. This means filling a bag with 1×1 combat artifacts effectively gives the player **extra stat slots beyond the base 3×2 grid**.

### Bag Rendering

- In shop and container: bags render as **empty colored cells** (no interior glyph), using the bag's theme derived from `artifact.color`
- `renderArtifactFigure()` skips `renderArtifactGlyph()` when `artifact.family === 'bag'`
- Each cell still has the shell/border/glow SVG rects — just no glyph inside
- Bag-row cells in the inventory grid get `.artifact-grid-cell--bag` class with `--bag-color` CSS variables (dashed colored border)

### State Restoration on Reload

When the page reloads during an active game run, `refreshBootstrap` in `useAuth.js` restores inventory state from **two sources**:

1. **`activeGameRun.loadoutItems`** (server DB) — authoritative source for **which artifacts** the player owns in this run (filtered to `purchased_round IS NOT NULL` to exclude pre-run items)
2. **`shopState`** (client persistShopOffer payload, stored server-side) — authoritative source for **placement positions** (`builderItems`), `activeBags`, and `rotatedBags`

The two sources are joined by `artifactId`:

```
ownedIds        = set of loadoutItems.artifactId
bagsOwned       = ownedIds where family === 'bag'
storedPositions = map[artifactId → { x, y, w, h }] from shopState.builderItems
                  (filtered to owned artifacts only)

state.activeBags = [...shopState.activeBags].filter(id => ownedIds.has(id) && bagsOwned.has(id))
state.rotatedBags = shopState.rotatedBags.filter(id => state.activeBags.includes(id))

state.builderItems = []
state.containerItems = []
for each owned loadoutItem (non-bag):
  if storedPositions.has(item.artifactId):
    state.builderItems.push({ ...item, ...storedPositions[item.artifactId] })
  else:
    state.containerItems.push(item.artifactId)

// Unactivated owned bags also go to container
state.containerItems += bagsOwned.filter(id => !state.activeBags.includes(id))

state.freshPurchases = shopState.freshPurchases.filter(id => ownedIds.has(id))
```

**Why two sources?** The server's `loadoutItems` knows **what** the player owns (via `buyRunShopItem` / `sellRunItem`), but the placement positions are client-side UI state (moving an artifact on the grid doesn't hit the server until `signalReady`). To preserve positions across a mid-prep reload, the client writes placements to `shopState` on every mutation via `persistShopOffer()`. On reload, both sources are joined to rebuild the full UI state.

This also makes the system **resilient to desync**: if `shopState` gets ahead of `loadoutItems` (e.g. due to a buy that hit the server but the placement wasn't persisted yet), the filter `ownedIds.has(id)` drops stale entries gracefully.

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

There are two shop modes, chosen by context:

- **Game Run Shop** ([PrepScreen](../web/src/pages/PrepScreen.js)) — per-round shop inside an active `game_run`. Coins scale with round. This is the main gameplay loop.
- **Legacy Shop** ([ArtifactsScreen](../web/src/pages/ArtifactsScreen.js)) — single-battle prep, fixed 5-coin budget. Used outside a game run for testing and the legacy single-duel flow.

See [balance.md](./balance.md) for per-round income, refresh costs, and the full economy rules.

### Mode comparison

| Feature | Game Run (PrepScreen) | Legacy (ArtifactsScreen) |
|---------|----------------------|--------------------------|
| Coin source | Per-round income from server (`ROUND_INCOME`) | Fixed budget of 5 |
| Shop generation | Server-side deterministic (seeded RNG) | Client-side random |
| Shop persistence | Server `game_run_shop_states` table | Client `shopState` payload |
| Sell mechanism | Sell zone (refund to coin pool) | Return to shop (full refund if fresh) |
| Refresh cost | 1 coin (first 3), 2 coins (4+) | 1 coin (fixed) |
| Loadout save | Auto on "Ready" signal | Manual "Save" button |
| State on reload | Server `loadoutItems` + client `shopState` | Client `shopState` only |
| Coin budget validation | `sum(ROUND_INCOME[0..currentRound])` | `MAX_ARTIFACT_COINS` (5) |

### Game Run Shop — Actions

| Action | Function | API Endpoint | Effect |
|--------|----------|-------------|--------|
| Buy | `buyRunShopItem(id)` | `POST /api/game-run/:id/buy` | Deduct coins, remove from gameRunShopOffer, add to containerItems |
| Sell | `sellRunItemAction(id)` | `POST /api/game-run/:id/sell` | Refund coins, remove from builderItems/containerItems/activeBags |
| Refresh | `refreshRunShop()` | `POST /api/game-run/:id/refresh-shop` | Deduct coins, new offer from server |
| Refresh cost | `getRunRefreshCost()` | — | `refreshCount < 3 ? 1 : 2` |
| Sell price | `getRunSellPrice(id)` | — | Full if in freshPurchases, else `max(1, floor(price/2))` |

### Starter Loadout

When a new player picks their first character via `selectActiveMushroom()`, the server auto-seeds a full 5-coin starter loadout by running `createBotLoadout()` with the mushroom's affinity. This avoids the "empty grid vs synergistic ghost" problem in round 1. Subsequent character switches preserve the existing loadout. See [balance.md Issue #1](./balance.md) for the rationale.

### Legacy Shop — Actions (single-battle prep)

| Action | Function | Effect |
|--------|----------|--------|
| Buy | `buyFromShop(id)` | Remove from shopOffer, add to containerItems + freshPurchases |
| Return | `returnToShop(id)` | Remove from containerItems + freshPurchases, add back to shopOffer |
| Reroll | `rerollShop(free)` | Generate new 5-item offer, deduct 1 coin from `MAX_ARTIFACT_COINS` budget |
| Sell price | `getSellPrice(id)` | Full price if in freshPurchases, else floor(price/2) |

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

See "State Restoration on Reload" in §3 for the full two-source join algorithm (`loadoutItems` + `shopState`).

---

## 13. Key Modules

Use this as a map to find the relevant code. Most function names are self-descriptive — this section lists only the non-obvious ones.

| Module | Purpose | Key exports |
|--------|---------|-------------|
| [`web/src/artifacts/grid.js`](../web/src/artifacts/grid.js) | Pure grid math (no state) | `buildOccupancy`, `preferredOrientation`, `deriveTotals`, `getArtifactPrice`, `pickRandomShopOffer` |
| [`web/src/composables/useShop.js`](../web/src/composables/useShop.js) | Reactive shop/inventory state for legacy + game run | `effectiveRows`, `bagLayout`, `isCellDisabled`, `normalizePlacement`, `activateBag`, `rotateBag`, `autoPlaceFromContainer` |
| [`web/src/composables/useGameRun.js`](../web/src/composables/useGameRun.js) | Game run flow + payload builder | `startNewGameRun`, `signalReady`, `continueToNextRound`, `buildLoadoutPayloadItems`, `buyRunShopItem`, `sellRunItemAction` |
| [`web/src/composables/useAuth.js`](../web/src/composables/useAuth.js) | State restoration on reload | `refreshBootstrap`, `persistShopOffer` |
| [`web/src/components/ArtifactGridBoard.js`](../web/src/components/ArtifactGridBoard.js) | The grid view component | props: `columns`, `rows`, `items`, `bagRows`, `variant` |
| [`app/server/services/loadout-utils.js`](../app/server/services/loadout-utils.js) | Server-side validation + summaries | `validateLoadoutItems(items, budget)`, `buildArtifactSummary(items)` |
| [`app/server/services/run-service.js`](../app/server/services/run-service.js) | Round resolution + ghost generation | `resolveRound`, `getRunGhostSnapshot` |

### Non-obvious behaviors (worth documenting here)

- **`normalizePlacement(artifact, x, y, w, h)`** returns the new `builderItems` array with the placement applied, or `null` if the placement violates bounds / overlap / disabled-cell rules. Callers must replace `state.builderItems = next` on success.
- **`bagLayout(bagId)`** returns `{ cols, rows }` where `cols` is capped at `INVENTORY_COLUMNS` even if the bag's width exceeds it. Rotation swaps the contributing bag dimensions.
- **`effectiveRows()`** = `INVENTORY_ROWS + sum(bagLayout(bagId).rows for each activeBag)` — determines how tall the grid is right now.
- **`buildLoadoutPayloadItems()`** — see "Persistence: Client → Server Mapping" in §3 for the full translation rules.
- **`validateLoadoutItems(items, budget)`** — the `budget` parameter is required; in game runs it's `sum(ROUND_INCOME[0..currentRound])`, outside a run it's `MAX_ARTIFACT_COINS`.

---

## 14. Load-Bearing CSS Classes

Only the classes that **E2E tests depend on** or that **have specific states** (hover, drop-target, disabled, etc.) are listed here. Styling-only classes are omitted — they can be found in [styles.css](../web/src/styles.css) and will drift over time.

### State-bearing grid classes

| Class | Applied when | Used by |
|-------|-------------|---------|
| `.artifact-grid-cell--drop-target` | Cell is under a valid drag | CSS highlight |
| `.artifact-grid-cell--bag` | Cell is in an active bag row and is usable | Coloring + drop validation |
| `.artifact-grid-cell--bag-disabled` | Cell is in a bag row but overflow (hidden) | `visibility: hidden`, non-droppable |

### E2E-selector classes (stable API for tests)

| Class | Purpose | E2E tests rely on it |
|-------|---------|---------------------|
| `.prep-screen` | Root of the prep phase | Yes |
| `.run-hud` | Round/wins/lives/coins bar | Yes |
| `.shop-item` | Individual shop card | Yes |
| `.shop-item--bag` | Bag shop card (border color) | Yes |
| `.shop-item--expensive` | Unaffordable (opacity + non-draggable) | Yes |
| `.container-item` | Item in the backpack | Yes |
| `.artifact-container-zone` | Drop target for selling/unplacing | Yes |
| `.artifact-inventory-grid` | Root of the inventory (used as scope in tests) | Yes |
| `.inventory-pieces .artifact-piece` | A placed piece on the grid | Yes |
| `.active-bags-bar` | Container for active bag chips | Yes |
| `.active-bag-chip` | Individual bag chip (click removes/rotates bag) | Yes |
| `.sell-zone` / `.sell-zone--active` | Sell drop target + dragover state | Yes |
| `.replay-layout` | Replay screen root | Yes |
| `.replay-result-button-full` | "Continue" / "Home" button after battle | Yes |
| `.run-complete-screen` | Game-over screen | Yes |

### Data attributes (use these in E2E tests instead of complex selectors)

| Attribute | On | Value |
|-----------|----|----|
| `data-artifact-id` | `.shop-item`, `.container-item`, `.artifact-piece` | Artifact ID |
| `data-cell-x`, `data-cell-y` | `.artifact-grid-cell` | Grid coordinates |

If you add a new CSS class that E2E tests depend on, **add it to this table** and mark it stable. Anything not in this table is free to be renamed / refactored without breaking tests.
