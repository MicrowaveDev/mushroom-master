# Home Field Chibi Candidate Contract

Date: 2026-05-26

This contract is the stop-gate for active-roster Home Field chibi candidate generation. It keeps the first production pass small enough to review honestly before expanding to the whole roster.

## Staged Scope

Stage 1 is a one-character proof:

- Generate `thalla` only.
- Candidate-only output. Do not overwrite app-facing PNGs.
- Do not approve candidates and do not set `accepted: true`.

Stage 2 may generate `lomie`, `axilin`, `kirt`, and `dalamar` only after Stage 1 passes mobile readability, identity, alpha, and Home Field preview review.

Stage 3 may add `morga` after her character-design contract is explicit enough for production chibi work. Until then, Morga is not part of the first proof batch.

## Sheet Shape

Each character still uses the locked Home Field runtime sheet shape:

- Output canvas: `512x256`
- Frame size: `64x64`
- Grid: `8` columns x `4` rows
- Row order: `down`, `up`, `left`, `right`
- Columns per row: `0-1` idle frames, `2-7` walk frames
- Transparent background
- Character feet/base grounded near the bottom of each frame
- Compact blob shadow under the feet/base

## Stage 1 Frame Contract

Stage 1 proves identity and mobile readability before full animation polish. Do not require 32 unique frames for the first run.

Use a two-step visual workflow:

1. Generate one non-production reference turnaround sheet for consistency.
2. Generate the final raw frame files as isolated per-frame PNGs.

The reference turnaround sheet is allowed only as visual guidance. Save it under:

```text
.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png
```

The reference sheet should show the same Thalla design in the four facing directions `down`, `up`, `left`, and `right`, with the same proportions, camera angle, palette, and detail budget. It may include labels outside the art if useful for human review, but it is not a production raw source, not a runtime spritesheet, and must not be sliced into final frames.

Generate each final raw file as its own isolated `64x64` or documented `128x128` transparent frame. Do not generate the final raw frames by cropping a larger contact sheet, grid sheet, character lineup, or full scene. If any final raw frame contains multiple sprites, miniature sprites, a field background, a border, or cropped sheet artifacts, discard that raw output and regenerate the affected frame.

Ignore the legacy single manifest `sourcePath` (`.agent/home-field-workspace/raw/thalla_chibi.source.png`) for Stage 1 production. It may exist for older prompt printers, but it is not a valid input for the compact frame contract. Stage 1 producers must use the isolated raw frame files below.

The minimum accepted Stage 1 input is 8 unique poses:

- idle down, walk down
- idle up, walk up
- idle left, walk left
- idle right, walk right

The current composer consumes 12 raw frame slots. Fill those slots by using the same idle pose for `idle_*_0` and `idle_*_1`, or by making a very subtle breathing variant. The single walk pose for each direction is replicated across columns `2-7` of that row.

For retina/source quality, the raw isolated frames may be generated at `128x128` if the run prompt requests it. They must still be simple map sprites and must downscale cleanly to the current `64x64` runtime frames. Larger source pixels are for cleaner alpha and shape control, not for extra detail.

Raw frame names for Stage 1:

```text
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_down_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_down_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_up_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_up_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_left_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_left_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_right_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_right_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right.source.png
```

Full 32-frame walk coverage is an optional later animation stage, not the gate for the first visual proof.

## Visual Contract

The chibi must read at `64px` on the green Home Field on mobile and desktop:

- follow [`docs/home-field-chibi-style-reference.md`](home-field-chibi-style-reference.md) for the target field-sprite proportions: squat body, oversized but not eye-dominated head, warm dark irregular outline, simple costume blocks, planted feet/base, compact shadow, and elevated 2.5D map read;
- mushroom-elf biology first, not a human wearing a mushroom hat
- visible elf ears whenever ears are visible
- strong silhouette readable without labels
- simple readable costume, not portrait-level detail
- elevated top-down 2.5D map-sprite camera, with the top of the mushroom cap/head visible
- compact standing pose seen from above like a small hub character, not a front-facing portrait sticker
- clear feet/base grounding
- warm dark outline and quiet Home Field palette fit
- no text, UI, frame borders, floor plane, or baked background
- no huge white portrait eyes; eyes must be much smaller than the reference screenshot's biggest facial read and should not dominate the head

For Thalla, use `docs/design-requirements.md` as the authoritative design source: ancient gold-white mushroom-elf sovereign, black eyes with fiery-gold life, gold tear-like spore traces, luminous gold mycelium across skin, sacred fungal regalia, and a warm bone/gold/white/brown palette. Simplify aggressively for `64px`.

Stage 1 detail budget:

- `2-3` main body/costume color regions, not layered regalia filigree
- `1` bold cap/head silhouette and `1` simple robe/body silhouette
- `1-2` gold mycelium/spore marks total per frame
- tiny face features only; eyes/mouth must not become portrait focal points or oversized white-eye stickers
- no jewelry clusters, tiny chains, lace, runic micro-marks, particle halos, or hairlike strands
- no tall full-body fashion-pose proportions; keep the sprite squat and grounded

## Candidate Workflow

1. Generate only the Stage 1 raw Thalla frames under `.agent/home-field-workspace/raw/`.
2. Produce the candidate sheet under `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`.
3. Validate only `thalla`.
4. Build contact/readability/alpha evidence and mobile+desktop Home Field previews using candidate routing.
5. Update `docs/home-field-asset-review.json` for `thalla` only.

The Stage 1 batch may end with `needs_review`, `needs_regen`, or `rejected`. Human approval is required before promotion to app-facing PNGs or expansion to the next roster stage.
