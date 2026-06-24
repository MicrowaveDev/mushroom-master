# Home Field Chibi Candidate Contract

Date: 2026-05-26

This contract is the stop-gate for active-roster Home Field chibi candidate generation. It keeps the first production pass small enough to review honestly before expanding to the whole roster.

For the causal history behind these rules, read [`docs/home-field-chibi-regression-ledger.md`](home-field-chibi-regression-ledger.md). Do not remove or weaken a rule until you understand which regression it was added to prevent.

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
- Idle action: column `0` is the normal planted pose; column `1` is a little `1-3px` bob/squish that can loop back to normal, not a crouch, seated pose, or deep squat
- Transparent background
- Character feet/base grounded near the bottom of each frame
- No baked ground shadow in frames; the renderer supplies the shared separate `chibi_shadow` layer under the feet/base

## Stage 1 Frame Contract

Stage 1 proves identity and mobile readability before full animation polish. It still uses all 32 runtime slots, but it does not require all 32 frames to be unique; simple holds/in-betweens are acceptable when the grouped sheet preserves consistency.

Use a grouped-state visual workflow:

0. Run `npm run game:home-field:preflight-chibi-proof` and stop if it fails.
1. Archive stale rejected Thalla state sheets, raw frames, reference sheets, and candidate outputs from the previous failed run under `.agent/home-field-workspace/rejected/`.
2. Generate one non-production reference turnaround sheet for consistency.
3. Review that reference sheet against the style reference and Thalla identity gate.
4. Generate one final grouped state sheet only after the reference sheet passes.
5. Split the grouped state sheet into the canonical raw frame PNGs.

The preflight step is mandatory before any stale-file archive. This proof requires a real PNG file at a known filesystem path. A built-in `image_gen` render that is only visible in chat is not a valid source for the pipeline. Preflight passes only when one of these is true: `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` after confirming built-in imagegen writes discoverable PNG files, supplied local source images exist via `HOME_FIELD_CHIBI_LOCAL_IMAGE_INPUTS`, or the user explicitly requested CLI fallback and `OPENAI_API_KEY` is configured. Do not archive or otherwise move the stale latest candidate until preflight passes.

The archive step is mandatory for regeneration runs after a rejection only after preflight passes. Previous rejected state sheets, raw frames, reference sheets, and candidate outputs are negative examples only. Do not let `test -f` or producer success on existing files count as generation work.

The reference turnaround sheet is allowed only as visual guidance. Save it under:

```text
.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png
```

The reference sheet should show the same Thalla design in the four facing directions `down`, `up`, `left`, and `right`, with the same proportions, camera angle, palette, and detail budget. It may include labels outside the art if useful for human review, but it is not a production raw source, not a runtime spritesheet, and must not be sliced into final frames.

Generate final idle/walk states as one coherent `8x4` state sheet for the same character, saved under:

```text
.agent/home-field-workspace/raw/thalla_chibi.states.source.png
```

This grouped state sheet is the required source for all final state tiles so face, cap, robe, outline, palette, detail level, pose, and motion stay consistent across idle and walk frames. Row order is `down`, `up`, `left`, `right`; columns `0-1` are idle; columns `2-7` are the walk lane. Idle column `0` is the normal planted pose, and idle column `1` is only a little `1-3px` bob/squish: the cap/head top may dip a few pixels and the body may compress slightly, but the character must remain standing with nearly the same alpha height. This bob/squish must exist in the grouped state sheet itself. Do not synthesize idle motion after splitting by shifting, squashing, stretching, repainting, or otherwise changing frame pose/silhouette. Do not bend the knees into a crouch, make the body sit low, or shorten the visible silhouette dramatically. The source may be exactly `512x256` or a larger proportional `8x4` sheet for cleaner downscaling. It may use true transparency or flat `#ff00ff` chroma key. Do not generate final idle/walk states as 32 separate imagegen calls; that was the main style-drift failure in the 2026-06-22 rerun. Single-cell image regeneration is allowed only as a targeted, human-approved repair after a grouped sheet mostly passes but one cell is defective; deterministic post-split edits may clean alpha, remove chroma-key fringe, crop, or resize only, not alter pose, motion, silhouette, style, or identity.

Quality bar: the composed chibi must look at least as crisp, contrasted, and finished as the approved Home Field props at scene scale. Avoid blurry/downscaled sticker results. Require a chunky readable silhouette, thicker warm dark outline, clear face/cap/robe value separation, and finished hand-drawn polish comparable to the bushes, mushrooms, and gates in the clean preview.

Deterministic/mechanical fallback drawings are allowed only as explicitly requested diagnostics. They must not be committed or reported as a fresh imagegen art candidate, even if they pass dimensions, alpha, frame-count, and manifest checks.

After every image generation step, immediately run `npm run game:home-field:verify-chibi-proof-files -- --path=<generated_png_path>` or the stage-specific verifier below. A chat-visible image, rollout record, or cache search is not enough; the PNG must exist at the documented repo path before continuing.

If built-in imagegen renders in chat but the file path is unknown, run `npm run game:home-field:find-imagegen-output -- --since-minutes=30` once. Use `--include-temp` only for one bounded retry. If no file is found, stop and report the image-output blocker instead of running broad filesystem searches or creating deterministic fallback art.

After generating the grouped state sheet, run:

```bash
npm run game:home-field:verify-chibi-proof-files -- --state-sheet
npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --resize
```

Use smooth resizing (`--resize`) when composing higher-resolution isolated source frames into the `64x64` runtime sheet. Do not use nearest-neighbor resizing for production candidates; hard pixel stair-steps are a rejection signal for this hand-drawn field-sprite style.

Ignore the legacy single manifest `sourcePath` (`.agent/home-field-workspace/raw/thalla_chibi.source.png`) for Stage 1 production. It may exist for older prompt printers, but it is not a valid input for the compact frame contract. Stage 1 producers must use the split raw frame files below.

The minimum accepted Stage 1 producer input is 32 isolated character-only frames derived from the grouped state sheet:

- `2` idle frames per direction: normal planted pose, then a little `1-3px` bob/squish pose
- `6` walk-lane frames per direction

The idle loop and walk lane may be simple, but neither may be static. Idle should be a two-frame `normal -> little bob/squish -> normal` loop, with only `1-3px` of vertical motion/compression so it stays readable at `64px`. The validator rejects deep idle squats when frame `1` loses too much visible height, shifts its alpha center too far, or drops the cap/body too low. The validator passing is not permission to manufacture the bob after split; if the grouped state sheet lacks the bob, regenerate that grouped sheet. Aim for a simple `4`-pose walk cycle distributed across the `6` walk-lane slots; the extra two slots may be subtle holds, settles, or in-betweens, not six important poses. At least `3` unique walk frames per direction must survive into the composed candidate sheet.

For retina/source quality, the raw isolated frames may be generated at `128x128` if the run prompt requests it. They must still be simple map sprites and must downscale cleanly to the current `64x64` runtime frames. Larger source pixels are for cleaner alpha and shape control, not for extra detail.

Raw frame names for Stage 1:

```text
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_down_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_down_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down_2.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down_3.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down_4.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_down_5.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_up_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_up_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up_2.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up_3.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up_4.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_up_5.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_left_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_left_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left_2.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left_3.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left_4.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_left_5.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_right_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_idle_right_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right_0.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right_1.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right_2.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right_3.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right_4.source.png
.agent/home-field-workspace/raw/thalla_chibi.frame_walk_right_5.source.png
```

Run `npm run game:home-field:verify-chibi-proof-files -- --frames` after frame generation and before candidate production.

## Visual Contract

The chibi must read at `64px` on the green Home Field on mobile and desktop:

- follow [`docs/home-field-chibi-style-reference.md`](home-field-chibi-style-reference.md) for the target field-sprite proportions: squat body, oversized but not eye-dominated head, warm dark irregular outline, simple costume blocks, planted feet/base over the shared chibi shadow layer, and elevated 2.5D map read;
- use BJD-inspired chibi doll simplicity: smooth porcelain/resin-like face planes translated into hand-drawn 2D art, rounded cheeks, small calm face features, mitten-like hands, tiny feet, and a quiet collectible-doll posture;
- mushroom-elf biology first, not a human wearing a mushroom hat
- visible elf ears whenever ears are visible
- strong silhouette readable without labels
- simple readable costume, not portrait-level detail
- elevated top-down 2.5D map-sprite camera, with the top of the mushroom cap/head visible
- compact standing pose seen from above like a small hub character, not a front-facing portrait sticker
- clear feet/base grounding
- no baked ground shadow in any chibi frame; use the separate shared `chibi_shadow` renderer/asset layer under the character
- warm dark outline and quiet Home Field palette fit
- no text, UI, frame borders, floor plane, or baked background
- no huge white portrait eyes; eyes must be much smaller than the reference screenshot's biggest facial read and should not dominate the head
- no realistic doll-photo rendering, glossy plastic toy rendering, fashion-doll proportions, or porcelain figurine material study
- no dense cap spots, scattered gold freckles, robe filigree, many tear/drop marks, or baked blob/cast shadows; if a detail does not read as one of the few large identity marks at `64px`, remove it

For Thalla, use `docs/design-requirements.md` as the authoritative design source: ancient gold-white mushroom-elf sovereign, black eyes with fiery-gold life, gold tear-like spore traces, luminous gold mycelium across skin, sacred fungal regalia, and a warm bone/gold/white/brown palette. Simplify aggressively for `64px`.

Mechanical checks are necessary but not sufficient. A candidate that passes dimensions, alpha, sheet mapping, or mobile readability still fails if it reads as pixel art, a tiny beige featureless doll, a busy ornate fantasy sprite, a generic elf, a straight portrait sticker, a human with a mushroom hat, or a different renderer from the Home Field reference.

Stage 1 detail budget:

- `2-3` main body/costume color regions, not layered regalia filigree
- `1` bold cap/head silhouette and `1` simple robe/body silhouette
- `1-2` large gold mycelium/spore marks total per frame; no scattered small cap freckles or many gold droplets
- tiny face features only; eyes/mouth must not become portrait focal points or oversized white-eye stickers
- no jewelry clusters, tiny chains, lace, runic micro-marks, particle halos, or hairlike strands
- no tall full-body fashion-pose proportions; keep the sprite squat and grounded

## Candidate Workflow

1. Generate only the Stage 1 grouped Thalla state sheet under `.agent/home-field-workspace/raw/thalla_chibi.states.source.png`.
2. Split that sheet into the 32 raw Thalla frame files under `.agent/home-field-workspace/raw/`.
3. Produce the candidate sheet under `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`.
4. Validate only `thalla`, including `--check-chibi-animation`.
5. Build contact/readability/alpha evidence and mobile+desktop Home Field previews using candidate routing.
6. Update `docs/home-field-asset-review.json` for `thalla` only.

The Stage 1 batch may end with `needs_review`, `needs_regen`, or `rejected`. Human approval is required before promotion to app-facing PNGs or expansion to the next roster stage.
