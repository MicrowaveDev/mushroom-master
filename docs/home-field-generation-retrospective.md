# Home Field Generation Retrospective

Date: 2026-05-23

This document is a handoff for the next agent. The current Home Field asset pass is useful as a pipeline proof, but it is **not production-ready art**. Do not treat the committed PNG set as approved. It exists to expose the problems in the generation flow, tile requirements, and preview/rendering logic.

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

This is acceptable for testing `--check-files`, but the manifest status should remain `draft`. A future pass must replace them with real per-frame art.

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

Recommendation:

- make the batch gate mechanical: after `game:home-field:sheet`, require a checked-in review record with `accepted: true` before the next batch can proceed;
- add `status: "rejected"` or `status: "needs_regen"` to the manifest so weak outputs are not silently promoted to `draft`;
- never mark an imagegen candidate as anything beyond `draft` without explicit human approval.

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

If the manifest remains simple, add a separate review manifest in `.agent` or `docs/` listing each asset's current visual verdict.

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

Recommendation:

- support `/home-field-preview?debug=0` for clean screenshots;
- e2e should capture both debug and clean modes;
- production art approval should use clean mode.

## Recommended Next Agent Flow

1. Do not generate more assets immediately.
2. Open the current contact sheet:

   ```text
   .agent/home-field-workspace/review/contact-sheet.png
   ```

3. Open current screenshots:

   ```text
   .agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/home-field-preview-mobile.png
   .agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/home-field-preview-desktop.png
   ```

4. Write an asset-by-asset verdict table:

   ```text
   assetId | approve/reject | reason | next action
   ```

5. Adjust requirements and prompts before regeneration.
6. Add clean preview mode and an alpha/background quality gate.
7. Regenerate only one family at a time, starting with terrain.
8. Stop after the terrain family and require human review before props/exits.

## Suggested Concrete Tasks

- Add `docs/home-field-asset-review.md` with per-asset visual verdicts.
- Add `/home-field-preview?debug=0` clean screenshot mode.
- Add e2e screenshots for both debug and clean mode.
- Add chroma-key fixture test for `produce-home-field-assets.js`.
- Add an alpha halo/checkerboard detector for props/exits.
- Add adjacency proof sheet for terrain connector pairs.
- Replace current procedural grass/path tiles with a more coherent low-detail hand-authored style.
- Replace checkerboard-cleaned props with chroma-keyed or true-alpha versions.
- Replace placeholder effects and chibi with real generated or hand-authored spritesheets.

## Bottom Line

The pipeline now proves that the app can load a complete Home Field asset set, but the art process is not yet capable of reliably producing production-ready tilemap art. The next improvement should be to harden the review gates and rendering proof before another image generation pass. Otherwise the system will continue producing valid PNGs that look like placeholders.
