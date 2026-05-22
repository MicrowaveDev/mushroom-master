# Home Field Hub — Codex Imagegen Handoff

This directory holds the **frozen contracts** for the Home Field hub. Phase 0 of the plan is complete; the next agent (Codex) generates the tiles, props, exits, effects, and chibi spritesheets.

## Source Of Truth

- **Plan**: [`docs/home-field-ingame-plan.md`](../../../docs/home-field-ingame-plan.md)
- **ADR**: [`docs/adr/0001-home-field-renderer.md`](../../../docs/adr/0001-home-field-renderer.md)
- **Requirements**: [`docs/game-requirements.md`](../../../docs/game-requirements.md) Section 15.
- **User flows**: [`docs/user-flows.md`](../../../docs/user-flows.md) Flow B Step 1.
- **Style anchor description**: [`home-field-style-anchor.json`](./home-field-style-anchor.json)
- **Prompts**: [`home-field-prompts.json`](./home-field-prompts.json)
- **Assets manifest**: [`home-field-assets.json`](./home-field-assets.json)
- **Map**: [`home-field-map.json`](./home-field-map.json)
- **Validator**: [`home-field-validator.js`](./home-field-validator.js) (same code used by the CLI and the runtime)

## What's locked

| Decision | Value |
|---|---|
| Renderer | Phaser 3.88.x, dynamic-imported |
| Coordinate system | Pixel world, integer coordinates |
| World size | `1792 × 1024` (7 × 4 tiles of 256 px) |
| Tile size | `256` |
| Anchor convention | terrain `{0,0}`, props/exits `{0.5, 0.85..1.0}`, effects `{0.5, 0.5}` |
| Locale | All in-world text is rendered at runtime; **no `*_ru` / `*_en` PNGs** |
| Atlas format | Phaser MultiAtlas, committed under `web/public/home-field/atlases/` |
| Chibi spritesheet | `512 × 256` (8 cols × 4 rows of `64×64`); rows = down, up, left, right; per row: 2 idle + 6 walk |
| Branch policy | direct-to-main on `mushroom-master` |

## Workflow For Codex

### 1. See what's needed

```bash
npm run game:home-field:next
```

Default emits 5 prompts. Use `--all` for the full queue, `--type=terrain|prop|exit|effect|character`, or `--id=a,b,c` to scope. Each prompt block begins with the marker line `Use the imagegen skill to create a production game home-field bitmap.` which is the handshake your imagegen skill recognises.

### 2. Generate

For each asset in the queue:

1. Use the imagegen skill with the prompt block (subject + details + size + transparency + constraints + style anchor) printed by `:next`.
2. Save the raw output to the exact `sourcePath` printed in the prompt block. This will be a path under `.agent/home-field-workspace/raw/`. Do not save raw output anywhere under `web/public/`.

### 3. Produce

```bash
npm run game:home-field:produce -- <asset_id_a> <asset_id_b> ...
# or
npm run game:home-field:produce -- --all-missing
```

This reads raw PNGs, validates dimensions against the assets manifest, re-encodes deterministically, and writes the final PNG to `web/public/home-field/<type>/<id>.png`. Pass `--chroma-key=#ff00ff` if imagegen returns a flat magenta background instead of transparent.

### 4. Validate

```bash
npm run game:home-field:validate                # schema only (works even when PNGs missing)
npm run game:home-field:validate -- --check-files   # also asserts every PNG exists with expected dimensions
```

Validator enforces:

- ID shape (`lower_snake_case`, no locale suffix)
- type, collision, anchor convention per type
- animation strip dimensions and `stillFrameIndex` range
- tile-layer tile alignment to `tileSize`
- spawn inside world and not inside collision
- Arena + Journey hotspots fit inside `camera.mobileSafeFrame`
- character spritesheet locked to `8×4 × 64×64`

### 5. Review the contact sheet

```bash
npm run game:home-field:sheet
```

Writes `.agent/home-field-workspace/review/contact-sheet.png` plus a manifest with sha256 of every input PNG and the output. Use it to scan for style consistency, seam issues, and silhouette readability.

### 6. Commit

Commit:

- approved app-facing PNGs under `web/public/home-field/`
- any updates to `home-field-assets.json` (e.g. `status: "missing"` → `"approved"`)
- the new contact-sheet (if you want to ship it for review)

Do **not** commit:

- `.agent/home-field-workspace/raw/`
- `.agent/home-field-workspace/processed/`
- `.agent/home-field-workspace/review/`
- `.agent/home-field-workspace/manifests/`

These are all in `.gitignore`. The local-only workspace exists so iteration on raw imagegen output stays out of the repo.

### 7. Push

```bash
git checkout main
git pull
# ...commit on main per the direct-to-main policy...
git push origin main
```

## First Recommended Batch

The plan's "Step 8 — Minimum First Agent Batch" calls for this proof set (in order):

1. `grass_base_01` (terrain)
2. `grass_base_02` (terrain)
3. `path_destination_row` (terrain)
4. `mushroom_cluster_small_amber` (prop)
5. `mycelium_lantern_amber` (prop)
6. `arena_mushroom_arch` (exit)
7. `journey_gate_under_construction` (exit)
8. `spore_motes_loop` (effect, animated proof)
9. `_placeholder` (chibi placeholder spritesheet)

Run the queue with `npm run game:home-field:next --id=grass_base_01,grass_base_02,path_destination_row,mushroom_cluster_small_amber,mycelium_lantern_amber,arena_mushroom_arch,journey_gate_under_construction,spore_motes_loop,_placeholder` and process them through the workflow above. Validate every step; review the contact sheet before continuing to the rest of the assets.

After the proof set is reviewed and committed, run `npm run game:home-field:next` with no filters to drive the remaining assets.

## Style Constraints — Do's And Don'ts

From [`home-field-style-anchor.json`](./home-field-style-anchor.json):

**Do**

- Lush deep green grass with mossy variation
- Amber and violet bioluminescent accents
- Single top-left warm key light, perpetual dusk
- Soft elliptical drop shadow under ground entities
- Clean medium-weight outline (slightly darker than fill)
- Mushroom-elf chibi with visible elf ears in every facing direction

**Do not**

- No medieval stone, no sci-fi, no urban props
- No bright cartoon palettes, no neon, no rainbow
- No pure-black outlines or pure-white highlights
- No photoreal textures
- **No text in any image** — signposts are art-only blank surfaces; runtime draws localized labels
- No human-only chibis with mushroom hats; the heroines are mushroom-elves
- No `*_ru.png` / `*_en.png` baked-text assets (validator rejects them)

## When You Hit A Snag

- **Validator failure**: read the error code; the validator messages are explicit about which field violated which rule.
- **Dimensions wrong**: re-run imagegen with the exact size from the prompt block. Phaser's MultiAtlas pack relies on dimensions matching the manifest.
- **No transparency**: imagegen sometimes returns flat backgrounds; pass `--chroma-key=#ff00ff` to `produce` to strip it (have imagegen use a magenta key).
- **Tile seams visible in contact sheet**: regenerate the terrain tile with `seamless edges` emphasised in the prompt; do not patch seams in post.
- **Animation strip wrong shape**: each animated asset is a horizontal strip of `frameWidth × frameHeight` cells. Total width = `frameWidth × frames`; total height = `frameHeight`. See the animation block in the prompt.
- **Chibi rows misordered**: row order is locked to `down, up, left, right` top to bottom. The validator enforces this. Walk frames per row are columns 2–7; idle frames are columns 0–1.
