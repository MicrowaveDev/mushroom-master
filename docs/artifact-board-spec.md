# Artifact Board System

Current technical summary for the prep board. For the runtime data flow, read [shop-bag-inventory-architecture.md](shop-bag-inventory-architecture.md). For the design decision, read [inventory-architecture-research.md](inventory-architecture-research.md).

## Core Loop

```
Start run -> [Prep -> Battle -> Result] x up to 9 rounds -> Run complete
```

Each run owns its loadout rows. Artifacts and bags bought during a run are cleared when the run ends.

## Prep Surfaces

1. **Shop**: per-round artifact offers.
2. **Container**: unlimited holding area for owned but unplaced rows.
3. **Flat grid**: active loadout surface. Active bags provide cells; artifacts occupy cells.

Only placed non-bag artifacts contribute combat stats.

## Artifacts

Artifacts modify combat stats:

| Stat | Battle effect |
|---|---|
| Damage | Adds to attack |
| Armor | Reduces incoming damage, minimum 1 |
| Speed | Affects action order |
| Stun Chance | Chance to skip opponent's next action, capped |

Artifacts may be larger than `1x1`. Their full footprint must be covered by active bag cells.

## Bags

Bags are storage artifacts. They do not contribute stats.

The starter bag is seeded at `(0, 0)` and provides the initial `3x3` play area. Bought bags start in the container and become active when placed.

An active bag row stores:

- `artifactId`
- row `id`
- absolute anchor `x`, `y`
- `active = 1`
- optional `rotated = 1`

An inactive bag row stores `x = -1`, `y = -1`, `active = 0`.

There is no `bag_id` ownership field. Bag membership is derived by overlap.

## Grid Rules

The grid is `BAG_COLUMNS` wide and at least `BAG_ROWS` tall. It grows downward when active bag footprints extend lower.

Placement is valid when:

1. active bag footprints do not overlap;
2. placed artifact footprints do not overlap;
3. every placed artifact cell is covered by at least one active bag shape cell;
4. coordinates fit inside the grid width;
5. total artifact price fits the round budget.

Artifacts may span multiple bags when each occupied cell is covered.

## Client Buckets

| Bucket | Meaning |
|---|---|
| `containerItems` | `{ id, artifactId }[]` for unplaced rows |
| `activeBags` | `{ id, artifactId, anchorX, anchorY }[]` |
| `builderItems` | placed non-bag artifacts with absolute coords |
| `rotatedBags` | row ids of rotated bags |

Row id, not artifact id, is the identity for duplicates.

## User Actions

- **Buy**: server creates a row; client adds it to the container.
- **Place artifact**: client validates cell coverage and emits absolute coords.
- **Activate bag**: client finds a non-overlapping anchor and persists it as active.
- **Move/rotate/deactivate bag**: overlapping artifacts are returned to the container before the bag change is applied.
- **Sell**: server blocks selling a non-empty bag by deriving overlapping contents.

## Persistence

`game_run_loadout_items` is authoritative. `PUT /api/artifact-loadout` sends the full flat row projection:

- active bags: absolute anchors;
- inactive/container rows: `(-1, -1)`;
- placed artifacts: absolute anchors;
- no `bagId`.

Round copy-forward duplicates rows and preserves absolute coordinates, active state, rotation state, purchase round, and refund flags.

## Server Validation

`validateLoadoutItems` runs:

1. `validateBagPlacement`;
2. `validateGridItems`;
3. `validateItemCoverage`;
4. `validateCoinBudget`.

Invalid writes return `400 Bad Request`.

## Battle

Battle summaries ignore:

- bags;
- container rows;
- uncovered rows, which should be impossible after validation.

Placed non-bag artifacts contribute their bonuses to the selected mushroom's combat stats.
