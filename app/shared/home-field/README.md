# Home Field Hub — Codex Imagegen Handoff

This directory holds the **frozen contracts** for the Home Field hub. Phase 0 of the plan is complete; the next agent (Codex) generates the tiles, props, exits, effects, and chibi spritesheets.

**For the human handing off to Codex**: the ready-to-paste agent prompt is in [`CODEX_PROMPT.md`](./CODEX_PROMPT.md). It's self-contained — copy that into your Codex session and it has everything Codex needs.

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

# Wrong (silently drops the flag — script will use its default):
npm run game:home-field:next --limit=10
```


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

## Workflow For Codex (compact)

Five npm aliases drive the entire pipeline. Run them in order per batch:

| Step | Command | What it does |
|---|---|---|
| **status** | `npm run game:home-field:status` | Lists every asset, marks `[x]` done / `[ ]` pending. Quick "where am I" check. |
| **next** | `npm run game:home-field:next -- --batch=proof-static` | Prints prompt blocks for the next batch. Pass any of `--batch=proof-static`, `--batch=proof-animated`, `--batch=proof-character`, or `--batch=full` (or use `--id=a,b,c` for a custom subset). Each block contains the marker line `Use the imagegen skill to create a production game home-field bitmap.`, the prompt body, size + transparency + constraints, and the style anchor. |
| **(imagegen)** | (your imagegen skill) | Generate each PNG. Save raw outputs to the exact `sourcePath` printed by `:next` (always under `.agent/home-field-workspace/raw/`, never under `web/public/`). |
| **produce** | `npm run game:home-field:produce -- <id_a> <id_b> ... --resize` | Reads each raw, optionally scales to target dimensions (`--resize` for static/effect, `--resize-nearest` for the chibi spritesheet), removes chroma-key if `--chroma-key=#ff00ff` is passed, validates dimensions, re-encodes deterministically, writes to `web/public/home-field/`. Prints a per-asset OK/FAIL summary. |
| **validate** | `npm run game:home-field:validate -- --check-files` | Reruns full schema check **plus** asserts every PNG exists with expected dimensions. Without `--check-files`, validates schema only. |
| **sheet** | `npm run game:home-field:sheet` | Composites a contact sheet at `.agent/home-field-workspace/review/contact-sheet.png` with sha256 manifest. Use it to review style consistency. |

### Per-batch loop

```bash
# 1. See progress
npm run game:home-field:status

# 2. Get the next batch of prompts
npm run game:home-field:next -- --batch=proof-static --all

# 3. (imagegen) Generate each asset. Save raw to the printed sourcePath.
#    If imagegen returns a different size than the manifest declares, save anyway —
#    the `--resize` flag on produce will scale it.

# 4. Produce
npm run game:home-field:produce -- --all-missing --resize

# 5. Validate (with file check)
npm run game:home-field:validate -- --check-files

# 6. Refresh the contact sheet for human review
npm run game:home-field:sheet

# 7. Commit on `main` (direct-to-main; see top of this README)
git add web/public/home-field/ app/shared/home-field/
git commit -m "Generate home field proof-static batch"
git push origin main
```

### Resize behavior (important — read once)

Imagegen tools typically return `1024×1024` PNGs. The `home-field-assets.json` manifest declares the exact target dimensions (`256×256` for terrain, `512×512` for exits, `64×64` for chibi frames, etc.). The produce script handles the size mismatch:

- `--resize` — box-average downscale (good for terrain, props, exits, effects).
- `--resize-nearest` — nearest-neighbour downscale (use for the chibi spritesheet frames so edges stay crisp at 64×64).
- (no flag) — strict mode; rejects size mismatches. Useful when you want to verify imagegen produced exact dimensions.

Recommended default: `npm run game:home-field:produce -- <ids> --resize`, and for chibi placeholder use `--resize-nearest`.

### Commit hygiene

Commit:

- approved app-facing PNGs under `web/public/home-field/`
- updates to `home-field-assets.json` if you flip `status: "missing"` → `"approved"`
- the new contact sheet if you want it on-record

Do **not** commit (already in `.gitignore`):

- `.agent/home-field-workspace/raw/`
- `.agent/home-field-workspace/processed/`
- `.agent/home-field-workspace/review/`
- `.agent/home-field-workspace/manifests/`

## Batches — recommended order

Three predefined batches stage the workload from lowest-risk to highest-risk. **STOP between batches** for human review of the contact sheet before continuing:

| Order | Batch | Command | Why first / why later |
|---|---|---|---|
| 1 | `proof-static` | `npm run game:home-field:next -- --batch=proof-static --all` | 7 single-image assets (2 grass, 1 destination-row path, 1 mushroom cluster, 1 lantern, Arena arch, Journey gate). Validates style direction with the lowest-risk imagegen path. **STOP and request human review of the contact sheet before continuing.** |
| 2 | `proof-animated` | `npm run game:home-field:next -- --batch=proof-animated --all` | 2 animated effects (`spore_motes_loop`, `tap_ripple`). Exercises the per-frame imagegen + composition path. **STOP for review.** |
| 3 | `proof-character` | `npm run game:home-field:next -- --batch=proof-character --all` | The `_placeholder` chibi spritesheet — 12 distinct frames composed into the locked `8×4` grid. **STOP for review.** |
| 4 | `full` | `npm run game:home-field:next -- --batch=full --all` | Everything still missing after the proof batches. Run only after the proof set is approved. |

Each batch ships as one commit (or a small number of related commits) on `main`. The contact sheet (`npm run game:home-field:sheet`) is the artifact reviewers look at between batches.

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
