# Home Field Generation Retrospective

Date: 2026-05-23

This document is a handoff for the next agent. The current Home Field asset pass is useful as a pipeline proof, but it is **not production-ready art**. Do not treat the committed PNG set as approved. It exists to expose the problems in the generation flow, tile requirements, and preview/rendering logic.

## Update: Guardrails Added

After this retrospective was written, the workflow was hardened in follow-up commits:

- `cebff25 Gate home field production art approval`
- `63bcd6e Add home field tile regeneration queue`
- `fe0d88a Update home field retrospective status`
- current pass: add pre-generation terrain gates for adjacency proof, path-band metadata, structured review checks, and grass-first queueing

These changes did **not** make the current art production-ready. They changed the process so future agents cannot accidentally treat the current PNG set as approved.

Handled:

- Added checked-in visual review records:
  - `docs/home-field-asset-review.md`
  - `docs/home-field-asset-review.json`
- Replaced ambiguous `draft` status with explicit manifest states: `missing`, `generated`, `needs_review`, `rejected`, `approved`, `placeholder`.
- Marked current terrain/prop/exit assets as `needs_review`.
- Marked technical effect strips and `_placeholder` chibi as `placeholder`.
- Added `npm run game:home-field:validate -- --production`, which intentionally fails while any asset is unapproved or placeholder.
- Added `npm run game:home-field:next-tiles`, now narrowed to the first grass-family batch only: `grass_base_01`, `grass_base_02`, `grass_flowers_01`.
- Added `npm run game:home-field:next-tiles-all` for the full 12-tile terrain queue after the grass-family stop gate is accepted.
- Added `npm run game:home-field:adjacency`, which writes `.agent/home-field-workspace/review/adjacency-sheet.png` and a manifest for the path run, side-edge stacks, map rows, and unique neighbor pairs.
- Added path-band metadata for horizontal path tiles (`pathCenterY`, `pathWidth`) and validator checks that touching `path_h` connectors share the same band.
- Added structured review checks in `docs/home-field-asset-review.json`: `repeatCheck`, `connectorCheck`, `cleanPreviewCheck`, `sceneFitCheck`, `familyCohesionCheck`, `styleCohesionCheck`, `alphaCheck`, and `scaleCheck`.
- Added `docs/home-field-agent-flow.md` and rewrote the ready-to-paste Codex prompt around separated sub-agent roles: orchestrator, prompt/contract reviewer, imagegen worker, producer/validator, and visual critic.
- Added `npm run game:home-field:rerun-grass-field`, a field-context grass rerun queue that tells imagegen to generate a larger meadow/pattern context and save a quiet center crop instead of making isolated square textures.
- Added scene-fit language to the style anchor and prompt flow so grass is judged as the quiet stage for chibi mushroom-elf avatars, with foliage/props carrying most of the personality on object layers.
- Added `npm run game:home-field:rerun-grass-family` and `npm run game:home-field:produce-grass-family`, which replace independent grass tile generation with one shared meadow source cropped into the three grass family outputs.
- After rollout `d96d18f`, tightened the grass-family crop plan to nearby central crops, added `--plan=lower-band|upper-band` fallbacks for the same raw source, and added `npm run game:home-field:grass-family-sheet` so blocky family transitions are visible before commit.
- After rollout `7aa2fdd`, added `npm run game:home-field:produce-grass-family-candidate` and `HOME_FIELD_ASSET_ROOT` review support so failed grass candidates stay under `.agent/home-field-workspace/candidates/grass-family/latest/` instead of overwriting app-facing terrain PNGs on `main`.
- Added `/home-field-preview?debug=0` clean visual review mode.
- Updated the Playwright preview spec to capture both debug and clean mobile/desktop screenshots.
- Added chroma-key and opaque checkerboard-matte tests for `produce-home-field-assets.js`.
- Updated Home Field README / Codex prompt / tileset contract with the review-gate and clean-preview workflow.

Current status after the guardrail pass:

```text
npm run game:home-field:validate -- --check-files --check-connectors --check-review
# PASS

npm run game:home-field:validate -- --production
# FAIL intentionally: 0/31 assets approved, 6 placeholders remain

npm run game:home-field:next-tiles
# gated first-pass queue; can block while existing candidates are needs_review

npm run game:home-field:rerun-grass-family
# preferred next grass rerun: one shared meadow-source prompt for the 3 grass-family tiles

npm run game:home-field:produce-grass-family-candidate
# preferred producer for review runs; writes to .agent/home-field-workspace/candidates/grass-family/latest/

npm run game:home-field:adjacency
# writes the terrain connector proof sheet

npm run game:home-field:grass-family-sheet
# writes the focused grass-family repeat/mix proof sheet
```

Do not "fix" the production gate by changing statuses. It should pass only after real art is regenerated, reviewed, and explicitly accepted.

## Current State

The committed asset set has these strengths:

- every declared Home Field PNG exists;
- `npm run game:home-field:validate -- --check-files --check-connectors` passes;
- `/home-field-preview` loads actual PNGs in mobile and desktop screenshots;
- the map has explicit connector metadata for grass, path, and side-edge tiles.

But visually it still fails the product goal: it does not look like a cohesive, polished in-game hub similar to a Cult of the Lamb style home location. It looks like a mixed proof board: some AI props, some deterministic procedural tiles, some rough effects, and a placeholder character.

## Main Visual Problems

### 1. Mixed Art Sources Break Cohesion

The terrain, props, exits, effects, and chibi placeholder come from different production paths:

- deterministic proof terrain from `generate-home-field-proof-tiles.js`;
- imagegen props/exits with checkerboard cleanup;
- hand-coded effect placeholder strips;
- hand-coded placeholder chibi spritesheet.

Even when individual pieces are readable, they do not share the same line weight, palette, texture density, perspective, or shadow model. The field therefore reads as assembled test assets, not one game scene.

### 2. Terrain Still Reads As Procedural Or Wallpaper-Like

The grass tiles are structurally repeatable, but not artistically convincing:

- repeated blobs make the tile grid visible;
- grass lacks hand-authored intentionality;
- some terrain cells have too much abstract patterning and not enough quiet ground;
- border tiles use painterly darkness that does not blend naturally with the simple grass proof tiles;
- path tiles are too graphic/flat compared with the darker edge terrain and generated props.

The important lesson: passing connector validation is necessary but far from sufficient. The current contact sheet proves dimensions and repeatability, not production quality.

### 3. Props Look Better Than Terrain But Are Not Clean Enough

The generated props have a stronger direction than the terrain: chunky, readable, and closer to the target style. But they still have issues:

- several assets retained edge artifacts after checkerboard removal;
- some props include white or pale halos from background cleanup;
- scale is inconsistent between mushrooms, signposts, exits, and lanterns;
- signpost art is too detailed for its small preview size;
- the exit props are more detailed than the rest of the field, so they dominate visually.

The next flow should enforce alpha quality and scale consistency before accepting any prop, not only file dimensions.

### 4. Effects And Chibi Are Only Technical Placeholders

The effect strips and `_placeholder` chibi were created deterministically to satisfy the full file gate. They are not art direction candidates.

This is acceptable for testing `--check-files`, but their manifest status is now `placeholder`. A future pass must replace them with real per-frame art.

### 5. Preview Screen Is A Layout Lab, Not A Real Scene

`/home-field-preview` is useful, but it currently has debug affordances that make visual review harder:

- visible tile grid lines;
- dashed mobile safe frame;
- CSS label pills over exits/chibi;
- fixed CSS object scaling that may not match the eventual Phaser/canvas renderer;
- object overlap rules treat some art-only signs as decorative to make the test pass.

The screenshot test checks containment and overlap, not whether the scene feels like a real game. A production review mode should allow turning debug overlays off and should render the same asset scale/anchor logic that the real home scene will use.

## Problems Faced During Generation

### Imagegen Did Not Reliably Produce True Transparency

Several "transparent PNG" prompts returned a visible checkerboard background baked into the image. The pipeline rejected them with:

```text
no transparency detected; alpha coverage coverage=100.0%
```

The workaround was local border-connected checkerboard removal. That got assets through alpha validation, but it is not a production-quality cutout process. It can leave halos, partial background fragments, and damaged antialiased edges.

Recommendation:

- prompt transparent assets on a flat chroma-key background, not a checkerboard;
- make `--chroma-key` the documented default for generated props/exits/effects unless true alpha is verified;
- add a validator that samples all four corners and flags checkerboard-like RGB backgrounds before produce;
- add a visual alpha review sheet with both light and dark backgrounds.

### The Produce Script Had A Stale Chroma-Key Helper Call

`app/scripts/produce-home-field-assets.js` called `remove_chroma_key.py` using the old positional CLI shape:

```bash
remove_chroma_key.py raw out --key #ff00ff
```

The current helper expects:

```bash
remove_chroma_key.py --input raw --out out --key-color #ff00ff
```

This was patched, but it shows that the asset pipeline needs its own test for `--chroma-key`.

Recommendation:

- add a tiny fixture PNG and a node test that runs `produce-home-field-assets.js --chroma-key=#ff00ff`;
- keep helper CLI assumptions out of docs unless covered by a test.

### The Agent Continued Past Human Review Gates

The original prompt says to stop after batches and report the contact sheet. In practice the flow continued because the user kept asking "continue", and the task moved toward "make all checks pass" rather than "stop and reject weak art".

Handled:

- `docs/home-field-asset-review.json` now records per-asset visual verdicts.
- Current weak candidates are `needs_review` + `needs_regen`, not silently approved.
- Placeholder effects/chibi are represented separately from generated art.
- `npm run game:home-field:validate -- --production` fails until all assets are `approved` and accepted by review.

Remaining recommendation:

- after `game:home-field:sheet`, update the review manifest before proceeding;
- never mark an imagegen candidate as `approved` without explicit human approval;
- use `npm run game:home-field:validate -- --production` before any production-ready claim.

### Prompts Were Too Broad For Terrain Tiles

The prompt language improved over time, but it still did not force terrain to be authored like a small tile piece. Imagegen often produced either:

- a pretty full scene cropped into a square;
- a detailed texture;
- a tile with a unique focal point;
- a style that only looked good in isolation.

Recommendation:

- generate terrain in a 3x3 context prompt and crop the center tile only if the model obeys the repeated pattern;
- alternatively, use deterministic/vector-assisted base tiles and reserve imagegen for object-layer props;
- create separate prompt templates for: base grass, accent grass, horizontal path mid, path end, side border, corner, and transition;
- forbid "painting", "wallpaper", "illustration", and "lush detail" in terrain prompts. Ask for "flat game ground cell, broad shapes, no focal object".

### Connector Metadata Is Textual, But Visual Connector Fit Is Manual

`--check-connectors` verifies declared metadata adjacency. It cannot see whether the path edge visually lines up, whether a grass edge is too dark, or whether a repeated tile shows a seam.

Recommendation:

- add a generated adjacency proof sheet that shows every compatible pair side-by-side;
- add path-band metadata (`pathCenterY`, `pathWidth`, maybe `pathCenterX`) for path tiles and require consistency;
- add an image-analysis heuristic that compares edge color profiles for supposed matching connectors;
- keep manual visual review as final authority.

## Requirements That Need Tightening

### Production Art Definition

Current docs say "production-ready" but do not define enough visual criteria. Add concrete acceptance rules:

- one coherent palette across terrain, props, exits, and chibi;
- one consistent outline thickness range;
- one shadow direction and softness;
- no baked checkerboard or matte halo;
- no prop scale surprises in `/home-field-preview`;
- no visible tile repetition in the first viewport;
- debug grid disabled screenshot must look like a game scene before approval.

### Tile Family Completeness

The current map uses side-edge and horizontal-path transitions, but the tileset is still under-modeled. A better v1 set should include:

- base grass: 2-3 quiet variants;
- accent grass: 1-2 sparse variants;
- horizontal path: mid, west end, east end;
- vertical path: mid, north end, south end if spawn-to-exit route is vertical;
- top destination landing: center plus left/right ends;
- left/right forest borders plus top-left/top-right/bottom-left/bottom-right corner variants;
- optional shadow-under-exit terrain overlays.

The current `edge_left_forest_01` and `edge_right_forest_01` stack, but there are no true corner pieces, so the map edges can still feel cropped.

### Status Semantics

`draft` currently means too many things:

- technically generated;
- visually plausible but not approved;
- placeholder but gate-satisfying;
- final candidate pending review.

Recommendation:

```text
missing -> generated -> needs_review -> rejected | approved
placeholder should be separate from generated art
```

Handled:

- `docs/home-field-asset-review.json` is now the review manifest.
- `docs/home-field-asset-review.md` gives the readable summary.
- `placeholder` is a separate production-blocking status.

## Rendering Logic Issues To Analyze

### CSS Preview Versus Final Renderer

The current preview uses DOM/CSS. The future game-like field may use Phaser or canvas. Another agent should verify whether:

- anchors in `home-field-assets.json` match CSS preview behavior;
- object scale in preview matches intended Phaser sprite scale;
- mobile overrides in CSS hide map/layout problems that would reappear in Phaser;
- debug-only label pills should be separate from real UI labels.

### Object Placement And Scale

The current map positions signs and exits manually in pixel coordinates. On mobile, CSS overrides reposition some objects independently of `home-field-map.json`. That means the map JSON is not the sole source of truth for placement in the preview.

Recommendation:

- avoid per-object mobile overrides except for camera framing;
- simulate camera crop/zoom from `home-field-map.json` instead of changing object positions;
- review a no-debug screenshot at 390x844 and 1440x900 as the primary art gate.

### Debug Overlay Confuses Art Review

Grid lines and dashed safe frames are useful for tests, but they make it hard to judge final feeling.

Handled:

- `/home-field-preview?debug=0` exists.
- E2E captures debug and clean mobile/desktop screenshots.
- Production art approval should use the clean screenshots, not the debug lab.

## Recommended Next Agent Flow

1. Start with terrain only:

   ```bash
   npm run game:home-field:next-tiles
   ```

2. Generate and produce only the emitted terrain assets. Use the producer command printed in each prompt block.
3. Run:

   ```bash
   npm run game:home-field:validate -- --check-files --check-connectors --check-review
   npm run game:home-field:sheet
   npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line
   ```

4. Open the current contact sheet:

   ```text
   .agent/home-field-workspace/review/contact-sheet.png
   ```

5. Open current clean screenshots:

   ```text
   .agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/home-field-preview-mobile-clean.png
   .agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/home-field-preview-desktop-clean.png
   ```

6. Update the review manifest:

   ```text
   docs/home-field-asset-review.json
   ```

7. Stop after terrain and require human review before props/exits/effects/chibi.

## Suggested Concrete Tasks

- Add `docs/home-field-asset-review.md` with per-asset visual verdicts. **Done.**
- Add `/home-field-preview?debug=0` clean screenshot mode. **Done.**
- Add e2e screenshots for both debug and clean mode. **Done.**
- Add chroma-key fixture test for `produce-home-field-assets.js`. **Done.**
- Add an alpha halo/checkerboard detector for props/exits. **Partly done: opaque checkerboard-like matte detection exists; halo/edge-quality visual sheet is still missing.**
- Add `npm run game:home-field:next-tiles` regeneration queue for current rejected terrain. **Done, and narrowed to grass-first stop rule.**
- Add adjacency proof sheet for terrain connector pairs. **Done.**
- Add path-band metadata checks for path connector alignment. **Done for horizontal path connectors.**
- Add structured clean-preview/style/alpha/scale checks to the review JSON. **Done.**
- Add mobile-size object readability sheet for props/exits. **Done for static object candidates via `npm run game:home-field:mobile-readability-sheet`.**
- Add object visible-bounds checks for mobile readability. **Done for the current foliage cleanup rows via asset `readability` metadata and `--check-readability`.**
- Replace current procedural grass/path tiles with a more coherent low-detail hand-authored style.
- Replace checkerboard-cleaned props with chroma-keyed or true-alpha versions.
- Replace placeholder effects and chibi with real generated or hand-authored spritesheets.

## Known Issues Remaining

- Current terrain still needs regeneration. Start with `npm run game:home-field:rerun-grass-family`, not the older isolated-tile or independent field-context reruns.
- The next run must stop after the grass family. Do not run the full 12-tile terrain queue until the grass sheet/preview is accepted.
- Recent grass reruns proved the isolated `256x256` prompt still creates visible square seams; the next run must use field-context generation and reject candidates with columns, rows, diagonal mottling, value bands, or repeated stamp clusters.
- Regression case: rollout `d96d18f` used the shared meadow source correctly, but the first crop plan sampled regions too far apart, so the clean preview still showed rectangular value boundaries. The fix is not a new independent tile run; it is a tighter same-source crop plan plus focused grass-family proof review.
- Regression case: rollout `7aa2fdd` followed the shared-source flow and correctly rejected all three tiles, but still committed app-facing PNGs that were marked `needs_regen`. The fix is candidate-root production: review `.agent/home-field-workspace/candidates/grass-family/latest/` first, then promote to `web/public/home-field/terrain/` only after explicit human approval.
- Regression case: rollout `f0d5ab2` included the candidate folder as a backticked absolute path, not a clickable folder link. The fix is to require the final response line `Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)` in the run prompt, flow template, and producer output.
- Regression case: rollout `019e5bfb-a59f` produced candidate sheets but no composed field screenshot. The fix is `npm run game:home-field:candidate-preview`, which renders `/home-field-preview?debug=0` through Playwright with candidate grass PNGs route-intercepted from `.agent/home-field-workspace/candidates/grass-family/latest/` and writes mobile/desktop clean field screenshots to `.agent/home-field-workspace/review/`.
- Regression case: rollout `019e5c3e-454b` followed the object-candidate flow and correctly left the bushes unapproved, but the standalone 256px contact sheet made them look more readable than they were in the mobile field. The fix is `npm run game:home-field:mobile-readability-sheet`, `--check-readability`, and prompt language that rejects tiny leaf noise and requires object props to read at 48-64px.
- Regression case: rollout `019e5c66-22e1` improved alpha/candidate discipline but the bush art still used too many visible leafy segments. The fix is stronger bush prompt/review language: only 2-4 large overlapping foliage masses, no many small mini-crowns or segmented shrub pieces.
- Regression case: rollout `019e5c77-bc0a` produced much better large-mass bush shapes, but `bush_cluster_light_01` was too bright/yellow in the mobile scene. Shape/readability can pass while scene attention still fails; light foliage needs a specific value/saturation gate.
- Grass flowers remain the easiest repeat marker. Keep base terrain mostly quiet; move stronger flowers, vines, foliage, and personality to object-layer transparent props rather than stamping them into repeatable grass cells.
- The adjacency proof sheet exists, but it is still a visual-review artifact; it does not algorithmically score edge beauty.
- Connector validation now checks horizontal path-band metadata, but edge color-profile heuristics are still not implemented.
- Vertical path-band metadata (`pathCenterX`) is reserved for future vertical path tiles.
- Clean preview exists, but the final Home Field renderer is still DOM/CSS preview, not the eventual Phaser/canvas scene.
- Mobile preview still uses CSS camera/object overrides; the map JSON is not yet the sole source of placement truth.
- Effects and `_placeholder` chibi remain technical placeholders.
- Props/exits still need a light/dark alpha review sheet and scale-consistency pass after terrain is approved.
- Production validation is expected to fail until all assets are regenerated and approved.

## Bottom Line

The pipeline now proves that the app can load a complete Home Field asset set, and the approval workflow now blocks false production sign-off. The next improvement is to regenerate only the grass family through `npm run game:home-field:rerun-grass-family`, produce via `npm run game:home-field:produce-grass-family-candidate`, review the candidate folder plus contact/grass-family/adjacency sheets, then stop for human approval before promotion or path/edge tiles.
