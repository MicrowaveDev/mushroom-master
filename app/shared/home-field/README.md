# Home Field Hub — Codex Imagegen Handoff

This directory holds the **frozen contracts** for the Home Field hub. Phase 0 of the plan is complete; the next agent (Codex) generates the tiles, props, exits, effects, and chibi spritesheets.

**For the human handing off to Codex**: use the short ready-to-paste grass prompt in [`RUN_GRASS_PROMPT.md`](./RUN_GRASS_PROMPT.md). It intentionally points the next agent to checked-in instructions instead of carrying the whole workflow in the chat prompt. The longer self-contained fallback remains in [`CODEX_PROMPT.md`](./CODEX_PROMPT.md). The role split for sub-agent runs is documented in [`docs/home-field-agent-flow.md`](../../../docs/home-field-agent-flow.md).

## Before You Start (Codex)

1. **`cd` to the `mushroom-master` repo root** (the directory containing `package.json`, not this `app/shared/home-field/` directory).
2. Confirm clean state on `main`: `git status` should be empty.
3. `npm install` if you haven't already (no new deps were added in Phase 0; existing ones are enough).
4. Run `npm run game:home-field:validate` — should print `home-field validation: PASS`. If it fails, do not proceed; the schema is the gate.
5. Read the **Workflow For Codex** section below, then the **First Recommended Batch** section. Static assets (terrain, props, exits) come first; animated assets and the chibi spritesheet come in a second stage and have their own composition workflow.

## npm arg passing — important

`npm run <script>` does **not** forward flags by default. Always use `--` to separate npm's args from the script's args:

```bash
# Correct:
npm run game:home-field:next -- --limit=10
npm run game:home-field:next -- --id=grass_base_01,grass_base_02
npm run game:home-field:produce -- grass_base_01 grass_base_02
npm run game:home-field:validate -- --check-files
npm run game:home-field:validate -- --check-connectors

# Wrong (silently drops the flag — script will use its default):
npm run game:home-field:next --limit=10
```


## Source Of Truth

- **Plan**: [`docs/home-field-ingame-plan.md`](../../../docs/home-field-ingame-plan.md)
- **Tileset connector contract**: [`docs/home-field-tileset-contract.md`](../../../docs/home-field-tileset-contract.md)
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

## Workflow For Codex (compact)

The npm aliases below drive the pipeline. Run them in order per batch:

| Step | Command | What it does |
|---|---|---|
| **status** | `npm run game:home-field:status` | Lists every asset, marks `[x]` done / `[ ]` pending. Quick "where am I" check. |
| **next** | `npm run game:home-field:next -- --batch=proof-static` | Prints prompt blocks for the next batch. Pass any of `--batch=proof-static`, `--batch=proof-animated`, `--batch=proof-character`, or `--batch=full` (or use `--id=a,b,c` for a custom subset). Each block contains the marker line `Use the imagegen skill to create a production game home-field bitmap.`, the prompt body, size + transparency + constraints, and the style anchor. |
| **next-tiles** | `npm run game:home-field:next-tiles` | Prints only the first grass-family regeneration batch (`grass_base_01`, `grass_base_02`, `grass_flowers_01`). Stop after these three and review before generating path or edge tiles. |
| **rerun-grass** | `npm run game:home-field:rerun-grass` | Intentional grass-family rerun command. Emits grass rows with `needs_review` or `needs_regen` and uses the review-gate bypass explicitly, so agents do not improvise flags. |
| **rerun-grass-field** | `npm run game:home-field:rerun-grass-field` | Legacy intentional grass-family rerun command. Emits three independent per-tile prompts; keep only for comparison/debugging. |
| **rerun-grass-family** | `npm run game:home-field:rerun-grass-family` | Preferred grass rerun. Emits one shared meadow-source prompt so the family shares lighting, brushwork, and value range. |
| **next-tiles-all** | `npm run game:home-field:next-tiles-all` | Prints the full 12-tile terrain regeneration queue. Use only after the grass family is approved for the next family pass. |
| **proof-tiles** | `npm run game:home-field:proof-tiles` | Generates deterministic quiet terrain-cell proofs plus separate top-down bush/sprout props. Use this when imagegen outputs look like full illustrations or dense textures instead of repeatable tiles. |
| **(imagegen)** | (your imagegen skill) | Generate each PNG. Save raw outputs to the exact `sourcePath` printed by `:next` (always under `.agent/home-field-workspace/raw/`, never under `web/public/`). |
| **produce** | `npm run game:home-field:produce -- <id_a> <id_b> ... --resize` | Reads each raw, optionally scales to target dimensions (`--resize` for static/effect, `--resize-nearest` for the chibi spritesheet), removes chroma-key if `--chroma-key=#ff00ff` is passed, validates dimensions, re-encodes deterministically, writes to `web/public/home-field/`. Prints a per-asset OK/FAIL summary. |
| **produce-grass-family-candidate** | `npm run game:home-field:produce-grass-family-candidate` | Preferred grass producer for review runs. Reads one shared `.agent/home-field-workspace/raw/grass_family_meadow.source.png` and writes the three grass outputs under `.agent/home-field-workspace/candidates/grass-family/latest/` instead of overwriting app-facing PNGs. Supports `-- --plan=lower-band` and `-- --plan=upper-band` fallbacks. |
| **produce-grass-family** | `npm run game:home-field:produce-grass-family` | Promotion-only grass producer. Writes directly to `web/public/home-field/terrain/`; use only after explicit human approval of the candidate folder. |
| **validate** | `npm run game:home-field:validate` | Reruns full schema/map checks. `--check-files` asserts every declared PNG exists, `--check-review` requires checked-in visual verdicts, and `--production` requires files, connectors, review acceptance, and `status: "approved"` for every asset. |
| **connectors** | `npm run game:home-field:validate -- --check-connectors` | Optional strict tile adjacency check. Use while designing terrain families and before approving production terrain. |
| **sheet** | `npm run game:home-field:sheet` | Composites a contact sheet at `.agent/home-field-workspace/review/contact-sheet.png` with sha256 manifest. Use it to review style consistency. |
| **grass-family-sheet** | `npm run game:home-field:grass-family-sheet` | Composites focused grass-only repeat and mixed-pattern proof at `.agent/home-field-workspace/review/grass-family-sheet.png`. |
| **adjacency** | `npm run game:home-field:adjacency` | Composites terrain connector proof at `.agent/home-field-workspace/review/adjacency-sheet.png`, including the grass-path run and left/right edge stacks. |

## Agent Flow

Use [`docs/home-field-agent-flow.md`](../../../docs/home-field-agent-flow.md) for generation runs. The important split is:

- Orchestrator owns commands, commit, push, and stop gates.
- Prompt/Contract Reviewer checks prompts and contracts before imagegen.
- Imagegen Worker writes only raw PNGs.
- Producer/Validation Worker creates candidate PNGs and review sheets through scripts.
- Visual Critic updates review JSON but cannot approve art without explicit human approval.

No role may both generate and approve its own image.

## Layout Preview Screen

Before production Phaser rendering lands, use the deterministic E2E layout lab at `/home-field-preview`.

It renders the intended 7×4 green field as tile cells, then places the object layer on top:

- Journey gate in the top-left destination area;
- Arena arch in the top-right destination area;
- selected chibi spawn in the lower-middle;
- sign, mushroom clusters, and lantern as repeatable placement examples;
- a visible mobile safe frame for screenshot review.

The screen is intentionally public so screenshot tests can verify composition without a logged-in session. It has two review modes:

- `/home-field-preview` shows the debug grid, labels, path glow, and mobile safe frame for layout checks.
- `/home-field-preview?debug=0` hides debug overlays for production-style art review.

Run it with the screenshot suite:

```bash
npm run game:test:screens
```

For a focused local check, use:

```bash
npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js
```

Screenshots are written to `.agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/`.

## Tilemap Contract

The home field is built from **tilemap layers plus object layers**, not from one large background illustration.

Terrain PNGs under `web/public/home-field/terrain/` are **single reusable tile cells**:

- each terrain image is one `256x256` tile;
- terrain tiles must be full-bleed ground/border/path cells;
- terrain tiles must work when repeated edge-to-edge with compatible neighbors;
- every terrain tile declares `tile.connectors.n/e/s/w` in `home-field-assets.json`; those connector tokens are part of the art brief, not optional metadata;
- terrain tiles must not contain a whole field, horizon, sky, vignette, large foreground object, sign, exit, character, or unique center composition;
- grass tiles must be low-frequency map cells with broad readable patches, not dense texture paintings;
- tiny details are limited: a few spore dots, clover marks, pebble/root marks, or mycelium strokes only when they stay quiet in a repeated patch;
- horizontal path tiles must expose clean west/east connectors at the same Y position;
- vertical path tiles must expose clean north/south connectors at the same X position;
- path end/transition tiles are required before a path can visually terminate into grass;
- blocked-edge tiles must be repeatable border cells, not complete forest scenes, and must not touch grass inside the visible field without a transition.

See [`docs/home-field-tileset-contract.md`](../../../docs/home-field-tileset-contract.md) for the current connector vocabulary and required grass/path/edge families.

Run the connector gate while editing the map:

```bash
npm run game:home-field:validate -- --check-connectors
```

The current proof map is wired to pass this strict gate with explicit horizontal path-end tiles (`path_h_end_w`, `path_h_end_e`) and left/right forest-border tiles (`edge_left_forest_01`, `edge_right_forest_01`). If future map edits fail this gate, add transition/end tiles instead of hiding neighbor changes inside base grass or mid-path art.

Terrain acceptance is stricter than "looks pretty":

- inspect every terrain tile as a `3x3` repeated patch in the contact sheet;
- inspect terrain connector pairs in `npm run game:home-field:adjacency`, especially grass-path ends and left/right edge stacks;
- inspect the same tile inside a `7x4` map preview before accepting it as production-ready;
- reject any map placement where touching connector tokens do not match and no explicit transition tile bridges them;
- reject dense AI texture, unique center highlights, tiny realistic grass blades, obvious wallpaper, cut-off edge marks, and any tile that would have been better as an object-layer prop.
- for the first grass family, reject independent per-tile generation. Use one shared meadow source and crop the base/accent tiles from it so lighting, brushwork, and value range match.

Reference model:

- [Tiled terrain/Wang thinking](https://docs.mapeditor.org/en/latest/manual/terrain/): terrain cells are neighbor-compatible pieces in a tileset, not one-off illustrations.
- [Phaser tilemap](https://docs.phaser.io/api-documentation/3.88.2/class/tilemaps-tilemap) and [ObjectLayer](https://docs.phaser.io/api-documentation/4.0.0/class/tilemaps-objectlayer) thinking: ground is a tile layer; exits, signs, mushrooms, lanterns, effects, and chibi are object/sprite layers.

Object PNGs under `props/`, `exits/`, `effects/`, and `characters/` are placed on object/sprite/effect layers:

- mushrooms, lanterns, signposts, gates, and arches are not terrain;
- exits are separate sprites anchored to map coordinates;
- collision and hotspots come from `home-field-map.json`, not from pixels baked into terrain art.

The contact sheet is the first review gate: terrain must be inspected as repeated patches, not as isolated pretty squares. The adjacency sheet is the second terrain gate: path bands and side-edge stacks must visually connect before any path/edge family is approved. The `/home-field-preview` screen is the composed-scene gate: once real PNGs exist, it must render those assets in-map so composition can be reviewed in mobile/desktop screenshots. If a tile looks good alone but reads as wallpaper, dense noise, disconnected path, or full-screen art when repeated, regenerate it.

## Production Art Bar

The deterministic `game:home-field:proof-tiles` output is a **layout proof**, not final production art. It may be committed with `status: "needs_review"` or `status: "placeholder"` so the map and screenshot tests can exercise real PNG loading, but it must not be promoted to `approved`.

The target scene is a composed in-game hub, not a texture pack: chibi mushroom-elf avatars should stand clearly on a soft green field, with chunky inked foliage, flowers, vines, mushrooms, exits, and props placed around them on object layers. The grass tiles are the readable stage. If grass texture competes with character feet, hides blob shadows, or makes the viewport feel like wallpaper, reject it even when the file and connector checks pass.

To mark a home-field asset `approved`, all of the following must be true:

- it matches the locked style anchor in `home-field-style-anchor.json`, especially the painterly dark-green forest-floor reference;
- terrain looks hand-authored and organic, not generated from visible math/procedural strokes;
- bush silhouettes and readable sprout clusters live in `props/`, not baked into repeated grass terrain;
- the `3x3` repeated contact-sheet patch has no obvious stamp, row, diagonal, edge seam, center target, or wallpaper rhythm;
- `/home-field-preview` screenshots show a believable game field after ignoring debug grid/labels;
- non-terrain assets have transparent alpha, readable silhouettes, consistent top-down lighting, and scale correctly next to the chibi/exits;
- the clean preview passes the scene-fit test: terrain, props, exits, and chibi placeholders feel like they belong to one authored screenshot.

The checked-in review source is [`docs/home-field-asset-review.json`](../../../docs/home-field-asset-review.json), with a readable companion at [`docs/home-field-asset-review.md`](../../../docs/home-field-asset-review.md). An asset can be marked `approved` only when its review row has `"verdict": "approved"` and `"accepted": true`. `placeholder` is a separate status and never passes production validation.

Use this command before any production-ready claim:

```bash
npm run game:home-field:validate -- --production
```

### Per-batch loop

```bash
# 1. See progress
npm run game:home-field:status

# 2. Generate the terrain-cell + foliage-prop proof batch
npm run game:home-field:proof-tiles

# For later prop/exit/effect/character batches, get prompts with:
# npm run game:home-field:next -- --batch=proof-static --all

# For intentional grass reruns after review rows exist, use the shared-source queue:
npm run game:home-field:rerun-grass-family

# After imagegen saves the one shared meadow source, produce the three candidate crops:
npm run game:home-field:produce-grass-family-candidate

# Optional fallback from the same raw source if the default crop plan is blocky:
npm run game:home-field:produce-grass-family-candidate -- --plan=lower-band
npm run game:home-field:produce-grass-family-candidate -- --plan=upper-band

# For later non-grass terrain/props, produce the raw files generated in that batch:
npm run game:home-field:produce -- path_dirt_straight path_spore_glow path_destination_row edge_roots_01 edge_moss_rocks_01 bush_cluster_dark_01 bush_cluster_light_01 leaf_sprout_01

# 5. Validate the candidate folder and confirm produced count
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:validate -- --ids=grass_base_01,grass_base_02,grass_flowers_01 --check-files --check-connectors --check-review
npm run game:home-field:status

# 6. Refresh review sheets for human review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:grass-family-sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:adjacency

# 7. Stop for human approval. Do not commit app-facing PNGs unless approved.
```

Final handoff must include the candidate folder as a clickable Markdown link, not a backticked path:

```md
Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)
```

### Resize behavior (important — read once)

Imagegen tools typically return `1024×1024` PNGs. The `home-field-assets.json` manifest declares the exact target dimensions (`256×256` for terrain, `512×512` for exits, `64×64` for chibi frames, etc.). The produce script handles the size mismatch:

- `--resize` — box-average downscale (good for terrain, props, exits, effects).
- `--resize-nearest` — nearest-neighbour downscale (use for the chibi spritesheet frames so edges stay crisp at 64×64).
- `--crop-center[=0.82]` — terrain-only center crop before resize, useful when imagegen adds unwanted edge vignette.
- `--seamless-terrain` — terrain-only soft opposite-edge harmonization for generated sources that are close but not edge-compatible.
- `--quiet-terrain[=0.35]` — terrain-only contrast reduction for generated sources with too much broad lighting variation.
- (no flag) — strict mode; rejects size mismatches. Useful when you want to verify imagegen produced exact dimensions.

Recommended default: `npm run game:home-field:produce -- <ids> --resize`, and for chibi placeholder use `--resize-nearest`.

### Commit hygiene

Commit:

- approved app-facing PNGs under `web/public/home-field/`
- updates to `home-field-assets.json` if you change `status`
- updates to `docs/home-field-asset-review.json` when a visual verdict changes

Do **not** commit (already in `.gitignore`):

- `.agent/home-field-workspace/raw/`
- `.agent/home-field-workspace/candidates/`
- `.agent/home-field-workspace/processed/`
- `.agent/home-field-workspace/review/`
- `.agent/home-field-workspace/manifests/`

## Batches — recommended order

Three predefined batches stage the workload from lowest-risk to highest-risk. **STOP between batches** for human review of the contact sheet before continuing:

| Order | Batch | Command | Why first / why later |
|---|---|---|---|
| 1 | `proof-tiles` | `npm run game:home-field:proof-tiles` then `npm run game:home-field:produce -- grass_base_01 grass_base_02 grass_flowers_01 path_dirt_straight path_spore_glow path_destination_row edge_roots_01 edge_moss_rocks_01 bush_cluster_dark_01 bush_cluster_light_01 leaf_sprout_01` | 8 quiet terrain cells plus 3 foliage props. Validates actual repeatability and proves that bush masses live on the object layer instead of being stamped into grass tiles. **STOP and review the contact sheet plus `/home-field-preview` screenshots before continuing.** |
| 2 | `proof-static` | `npm run game:home-field:next -- --batch=proof-static --all` | First prop/exit proof assets after the terrain contract is working. **STOP and request human review of the contact sheet before continuing.** |
| 3 | `proof-animated` | `npm run game:home-field:next -- --batch=proof-animated --all` | 2 animated effects (`spore_motes_loop`, `tap_ripple`). Exercises the per-frame imagegen + composition path. **STOP for review.** |
| 4 | `proof-character` | `npm run game:home-field:next -- --batch=proof-character --all` | The `_placeholder` chibi spritesheet — 12 distinct frames composed into the locked `8×4` grid. **STOP for review.** |
| 5 | `full` | `npm run game:home-field:next -- --batch=full --all` | Everything still missing after the proof batches. Run only after the proof set is approved. |

Each batch ships as one commit (or a small number of related commits) on `main`. The contact sheet (`npm run game:home-field:sheet`) and clean preview screenshots are the artifacts reviewers look at between batches. The prompt queue blocks if existing generated candidates still need a checked-in visual verdict; use `--ignore-review-gate` only when intentionally regenerating the blocked assets.

## Animated Assets And Chibi Spritesheet

Imagegen tools typically generate a single image at a standard square size (e.g. `1024×1024`). They are unreliable at producing wide multi-frame strips (`2048×256`, `4096×512`) in one call. For animated effects and the chibi spritesheet, use a **per-frame workflow**:

### Per-frame raw naming

For an animated asset like `spore_motes_loop` (8 frames at 256×256), save **each frame as its own raw PNG**:

```
.agent/home-field-workspace/raw/spore_motes_loop.frame_00.source.png
.agent/home-field-workspace/raw/spore_motes_loop.frame_01.source.png
.agent/home-field-workspace/raw/spore_motes_loop.frame_02.source.png
...
.agent/home-field-workspace/raw/spore_motes_loop.frame_07.source.png
```

Each frame is generated as an individual imagegen call at the frame's `frameWidth × frameHeight` size (or cropped to that size if imagegen returns a larger image). The frames must form a clean loop (frame 0 connects seamlessly to frame 7 → 0).

### Compose

Run produce with the `--compose-frames` flag (or it auto-detects: if `<id>.source.png` doesn't exist but `<id>.frame_NN.source.png` files do, frame-composition mode triggers):

```bash
npm run game:home-field:produce -- spore_motes_loop
```

The produce script will:

1. Detect the per-frame raw files.
2. Verify each frame matches the asset's declared `frameWidth × frameHeight`.
3. Compose them left-to-right into a `(frames × frameWidth) × frameHeight` horizontal strip.
4. Write the strip as a deterministic PNG to `outputPath`.

### Chibi spritesheet (the hardest case)

The placeholder chibi is `8 cols × 4 rows × 64×64 = 32 frames`. Recommended generation strategy:

1. **Generate per-pose frames** at 64×64 each:
   - 4 idle poses (one per direction): `_placeholder.frame_idle_down.source.png`, `…_idle_up.source.png`, `…_idle_left.source.png`, `…_idle_right.source.png`
   - For the v1 placeholder, use **only one walk frame per direction** (the silhouette is generic; movement readability comes from the chibi pose itself). Save as `_placeholder.frame_walk_down.source.png`, etc.
2. The produce script for character placeholders will replicate the single walk frame across columns 2–7 of each row (acceptable for a placeholder; specific-character chibis will get full 6-frame walks in a later phase).

Per-character chibis (not the placeholder) require the full `8 × 4` grid; that workstream is out of scope for v1 — only the placeholder is needed to unblock the renderer spike.

### Validate and review

```bash
npm run game:home-field:validate -- --check-files
npm run game:home-field:sheet
```

The validator's animation rules will reject any strip where `width !== frameWidth * frames` or `height !== frameHeight`; the contact sheet's manifest will record the sha256 of every composed strip so reviewers can verify reproducibility.

## Style Constraints — Do's And Don'ts

From [`home-field-style-anchor.json`](./home-field-style-anchor.json):

**Do**

- Cute dark occult storybook mood: cozy, eerie, ritual woodland, playful danger
- Chunky moss/grass patches instead of realistic blade detail
- Big readable silhouettes and simplified cut-paper/storybook shapes
- Amber and violet bioluminescent accents
- Single top-left warm candle key light, perpetual dusk, soft violet fill
- Soft compact blob shadow under ground entities
- Bold clean dark-plum/umber outline on props, exits, effects, and chibi
- Mushroom-elf chibi with visible elf ears in every facing direction

**Do not**

- No medieval stone, no sci-fi, no urban props
- No bright cartoon palettes, no neon, no rainbow
- No pure-black outlines or pure-white highlights
- No photoreal textures
- No generic soft fantasy painting or over-detailed concept-art rendering
- No direct copying of Cult of the Lamb characters, icons, cult symbols, UI, logo shapes, or exact compositions
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
