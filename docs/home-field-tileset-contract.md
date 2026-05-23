# Home Field Tileset Contract

This contract defines how Home Field terrain should be authored before production image generation. It exists because pretty individual tiles are not enough: the map needs compatible neighbors, transition pieces, and object-layer props.

## Research Summary

The right model is the same one used by tile editors and game engines:

- Tiled uses terrain and Wang-tile concepts to describe which tile edges or corners can sit next to each other.
- Godot TileSet terrains use the same idea with side/corner matching so the editor can choose valid neighboring tiles.
- Phaser can consume tilemap data plus custom properties, so our JSON can carry these connector rules now and remain compatible with a future Tiled-authored map.

For Mushroom Battles we keep the system simpler than full Wang corners in v1: every terrain asset declares four side connectors: `n`, `e`, `s`, `w`.

## Connector Tokens

Use connector tokens as art contracts, not only as code metadata.

| Token | Meaning | Visual Edge Rule |
|---|---|---|
| `grass` | Open meadow grass | Broad muted green reaches the edge with no hard feature cut off. |
| `path_h` | Horizontal path lane | Dirt/path band exits west/east at the same Y and width. |
| `path_v` | Vertical path lane | Dirt/path band exits north/south at the same X and width. |
| `path_h_wide` | Destination-row path | Wider horizontal landing/path exits west/east consistently. |
| `edge_blocked` | Blocked forest/undergrowth | Dense edge/roots/rocks read as non-walkable; do not touch `grass` without a transition. |

Direct neighbors are production-safe only when touching connector tokens match, or a declared transition tile bridges the two tokens.

## Required Tile Families

### Grass

Grass tiles should be the quiet base:

- `grass_base_*`: connectors all `grass`; can repeat freely.
- `grass_accent_*`: connectors all `grass`; sparse and limited by `maxPerViewport`.
- `grass_shadow_*`: connectors all `grass`; used under props/exits only if it does not create a visible grid.

Grass style target: simple top-down storybook meadow, broad muted green fields, a few hand-drawn strokes, lots of empty walkable space. Do not generate realistic texture, dense clover carpet, full-screen illustration, or bush masses.

### Horizontal Path

Horizontal path tiles connect left-to-right:

- `path_h_mid`: `w/e = path_h`, `n/s = grass`.
- `path_h_glow`: same connectors as `path_h_mid`, but limited by `maxPerViewport`.
- `path_h_end_w`: `e = path_h`, other sides `grass`; the west end fades into grass.
- `path_h_end_e`: `w = path_h`, other sides `grass`; the east end fades into grass.

The current map needs `path_h_end_w` and `path_h_end_e` before production art is final, because a horizontal path cannot sit directly beside free grass at its open ends.

### Vertical Path

Vertical path tiles connect top-to-bottom:

- `path_v_mid`: `n/s = path_v`, `e/w = grass`.
- `path_v_end_n`: `s = path_v`, other sides `grass`.
- `path_v_end_s`: `n = path_v`, other sides `grass`.

Use these if the home field adds a route from spawn upward toward Arena/Journey instead of only a horizontal lane.

### Destination Row

Destination-row tiles are wider landing/path pieces near exits:

- `path_destination_row`: `w/e = path_h_wide`, `n/s = grass`.
- `path_destination_end_w`: `e = path_h_wide`, other sides `grass`.
- `path_destination_end_e`: `w = path_h_wide`, other sides `grass`.

Do not bake an Arena arch, Journey gate, sign, lantern, or text into any destination-row terrain tile.

### Edges And Blockers

Blocked edge tiles need their own transitions:

- `edge_roots_*`: usually `edge_blocked` on all sides; safe only beside other edge tiles unless a border layout guarantees it is outside the playable lane.
- `edge_moss_rocks_*`: same as above.
- `edge_to_grass_*`: future transition pieces when blocked terrain needs to touch grass inside the visible viewport.

For v1, most blocked personality should come from object-layer bushes, tall mushrooms, vines, and gates. Terrain blockers stay simple.

## Metadata Contract

Every terrain asset in `app/shared/home-field/home-field-assets.json` must include:

```json
{
  "tile": {
    "terrainSet": "meadow_grass",
    "placement": "free",
    "connectors": { "n": "grass", "e": "grass", "s": "grass", "w": "grass" },
    "canTouch": ["grass_base_01", "grass_base_02"],
    "repeatMode": "low_frequency",
    "needsTransitionFor": ["path_h", "path_v", "edge_blocked"]
  }
}
```

The validator enforces the shape of this metadata. A later stricter validator should also verify every `home-field-map.json` tile adjacency by comparing touching connector tokens.

The strict adjacency check now exists as an explicit development gate:

```bash
npm run game:home-field:validate -- --check-connectors
```

Normal `npm run game:home-field:validate` remains schema-only because the current proof map is allowed to exist before the full transition set is generated. Production approval requires the strict connector gate to pass.

## Agent Generation Flow

1. Read `home-field-assets.json`, `home-field-prompts.json`, `home-field-style-anchor.json`, and this contract.
2. Generate only one tile family at a time.
3. For each terrain prompt, include the connector metadata block emitted by `npm run game:home-field:next`.
4. Reject any output that ignores its edge token. A `path_h` tile must visibly connect west/east; a `grass` edge must remain grass.
5. Produce with the standard pipeline.
6. Review three scales:
   - isolated `256x256` tile;
   - `3x3` repeated patch;
   - composed `/home-field-preview` screenshot.
7. Do not continue to props/exits until the terrain family has a coherent connector set.

## Production Readiness Gate

A terrain set is production-ready only when:

- the connector set includes all needed transitions for the current map;
- `npm run game:home-field:validate -- --check-connectors` passes;
- no path/edge tile is placed directly beside an incompatible tile;
- repeated grass reads as a simple field, not wallpaper;
- path ends fade through explicit end/transition tiles;
- object-layer props provide most visual richness;
- mobile and desktop screenshots look like one cohesive scene after debug grid/labels are ignored.
