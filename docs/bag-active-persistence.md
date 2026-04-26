# Bag Active Persistence

`active` is persisted on each `game_run_loadout_items` bag row.

## Contract

| Bag state | Coordinates | `active` |
|---|---|---|
| Active on the grid | absolute anchor `(x, y)` | `1` |
| In container | `(-1, -1)` | `0` |

The starter bag is seeded as an active bag at `(0, 0)`.

## Write Path

Freshly bought bags are inserted inactive at `(-1, -1)`.

`PUT /api/artifact-loadout` updates bag rows through `applyRunPlacements`:

- explicit `active: 1` persists the bag as active;
- explicit `active: 0` moves it to the container sentinel;
- omitted `active` preserves the existing value for compatibility with partial or older payloads.

Non-bag rows always persist `active = 0`.

## Read Path

`readCurrentRoundItems` exposes `active` to the client. Projection routes active bag rows to `activeBags` and inactive bag rows to `containerItems`.

## Round Copy

`copyRoundForward` preserves `active`, coordinates, and rotation state.
