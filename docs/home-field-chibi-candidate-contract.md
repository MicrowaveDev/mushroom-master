# Home Field Chibi Candidate Contract

Date: 2026-05-26

This contract is the stop-gate for active-roster Home Field chibi candidate generation. It keeps the first production pass small enough to review honestly before expanding to the whole roster.

For shared imagegen requirements, read [`docs/home-field-imagegen-requirements.md`](home-field-imagegen-requirements.md). For the causal history behind these rules, read [`docs/home-field-chibi-regression-ledger.md`](home-field-chibi-regression-ledger.md). Do not remove or weaken a rule until you understand which regression it was added to prevent.

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

0. Run `npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof`, then `npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>` and stop if it fails, except for the one diagnostic built-in output probe allowed by `docs/home-field-imagegen-requirements.md` when reference-image input binding is already confirmed and disk output is the remaining blocker.
1. Archive stale rejected Thalla state sheets, raw frames, reference sheets, and candidate outputs from the previous failed run with `npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>`.
2. Generate one non-production sprite-box reference sheet for consistency, or derive the non-production reference proxy with `npm run game:home-field:stage-chibi-local-source` when the run uses one supplied complete local `8x4` state sheet.
3. Review that reference sheet against the style reference and Thalla identity gate.
4. Generate one final grouped state sheet only after the reference sheet passes.
5. Split the grouped state sheet into the canonical raw frame PNGs.

The queue and preflight steps are mandatory before any stale-file archive. The queue item records the per-asset references, output paths, commands, stop gates, env-file rules, local state-sheet source mode, local-source `sourcePath`, and method-gate status. For `thalla-stage1-chibi-proof`, do not infer `.env` or neighboring repo env files. Paid API fallback is allowed only after built-in/imagegen output is unavailable and the explicit env file contains `OPENAI_IMAGEGEN_API_KEY` plus `HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1`; plain `OPENAI_API_KEY` must not count. This proof requires a real PNG file at a known filesystem path. A built-in `image_gen` render that is only visible in chat is not a valid source for the pipeline. Current Thalla reference generation also requires real reference-image input binding. Preflight passes only when one of these is true: `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` and `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` after confirming built-in imagegen writes discoverable PNG files and can attach/use the checked-in reference PNGs as actual image inputs from the same agent context that will run imagegen, a supplied local proof source path is provided through the queue-owned `--source` command or explicit `--source` override, or explicit reference-capable paid API fallback is configured through `--env-file=<explicit-env-file>`. For the current supplied complete `8x4` local state-sheet run, use `generationContract.stateSheet.localSourceMode.sourcePath` from `app/shared/home-field/home-field-generation-queue.json` and pass it with `--source` to preflight, archive, and `npm run game:home-field:stage-chibi-local-source`; the helper copies the sheet into the raw state-sheet slot and derives a non-production reference proxy for evidence without running reference imagegen. A different supplied complete `8x4` local state-sheet PNG outside `docs/reference/home-field/` must be passed explicitly with `--source` or recorded in the queue source path. For the built-in path, `view_image` may be used only as the current imagegen skill's same-context input-staging step, followed by a built-in `image_gen` call that explicitly uses those visible images as references. However, the queue-backed built-in same-context staging path is exhausted for unchanged Thalla proof runs after rollout `codex-019f1eb1-1027-7752-95cf-d4f37cb0041c`; do not run it again unless a different generation method or source-input path is available. The checked-in images under `docs/reference/home-field/` are style references, not proof source images, and must not be used as local proof sources. If built-in imagegen is the intended path and preflight fails only because disk output is unconfirmed while reference-image input binding is already confirmed, run exactly one tiny non-candidate built-in output probe in the same agent context, then `npm run game:home-field:find-imagegen-output -- --since-minutes=5`; use `--include-temp` for only one bounded retry and count only a file newer than the probe start. If a file is found, rerun preflight with both built-in confirmations; otherwise stop. If reference-image input binding is unavailable, do not run the disk-output probe because it cannot unblock this proof. Passive viewing, mentioning PNGs in the text prompt, or listing filesystem paths to them is not image-guided generation. Do not archive or otherwise move the stale latest candidate until preflight passes.

For paid API fallback, use `npm run game:home-field:chibi-reference-api-proof -- --env-file=<explicit-env-file>` for the reference sheet unless there is a stronger documented helper. This helper exists because rollout `codex-019f1ade-4d43-7b20-985a-1a1ae7e4ca6c` showed that the real API path worked but the manual sequence was too fragile: env discovery, Python SDK setup, exact prompt copying, API image edit, API-size output handling, verifier, palette audit, and blocker-note writing were all reconstructed by hand. The helper may normalize a `gpt-image-2` API output such as `1024x768` to the `512x384` sprite-box reference before verifier/audit. This is allowed only as scale normalization; it must not alter identity, pose, ornament, or palette, and it does not waive the `--fail-on-bloat` palette audit or visual reference gate. The helper intentionally requires `OPENAI_IMAGEGEN_API_KEY` and `HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1`, and ignores plain `OPENAI_API_KEY`.

The reference helper is not a production generator. It proves whether the style/scale/palette reference gate can pass. The final grouped state sheet must also be generated with the passed reference PNG attached as an actual image input. If the active generation path cannot attach the approved reference to the state-sheet call, stop before producing raw frames or candidate spritesheets. In supplied complete local state-sheet mode, the staged sheet is the production source and the derived reference proxy is evidence only; do not regenerate the state sheet or rerun reference imagegen.

The archive step is mandatory for regeneration runs after a rejection only after preflight passes. Previous rejected state sheets, raw frames, reference sheets, and candidate outputs are negative examples only. Do not let `test -f` or producer success on existing files count as generation work. Use the archive helper instead of broad `rg`, `find`, or custom shell moves; it reruns preflight with the current environment and prints the moved-file manifest.

The sprite-box reference sheet is allowed only as visual guidance. Save it under:

```text
.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png
```

The reference sheet should show the same Thalla design in the four facing directions `down`, `up`, `left`, and `right`, with the same proportions, camera angle, palette, and detail budget. It must behave like a compact sprite extraction guide: four tiny source-sprite views inside invisible `96x96` boxes with most of the sheet left as empty `#ff00ff`, not a conventional large character-turnaround sheet. Prefer a compact source canvas around `512x384` or smaller; do not accept a `1536x1024` showcase canvas with enlarged figures just because the empty magenta ratio is high. Each major visible character blob should fit within the verifier's `128x128px` tolerance for the `96x96` source-sprite contract. It may include labels outside the art if useful for human review, but it is not a production raw source, not a runtime spritesheet, and must not be sliced into final frames.

For current Thalla runs, create this reference with image-guided generation from the checked-in PNG references, not another text-only prompt-only attempt. Attach or same-context stage these images as actual image inputs to the generation call and state their roles before imagegen:

- `docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png`: primary positive compact grouped-sheet proportions and charm; fix palette bloat/ornament.
- `docs/reference/home-field/chibi-thalla-liked-2026-06-23.png`: primary positive youthful little-girl face/cap/robe appeal, compact visible oval/almond doll eyes, rounded cheeks, and soft cute expression; simplify heavily.
- `docs/reference/home-field/chibi-style-agent-log-reference.png`: target scale, outline weight, and scene-scale simplicity only; do not copy symbols/costumes.

If the active imagegen path cannot attach or use those checked-in PNGs as actual same-context image inputs to the generation call, stop and report that image-guided generation is required. Do not keep retrying text-only reference sheets; rollout `codex-019f105b-b55a-7ad0-9f8d-38903fdf7999` proved they still drift into oversized anime/turnaround art even with the tightened prompt. Do not retry the old image-guided turnaround wording unchanged either; rollout `codex-019f140b-07a4-7e10-85e1-f64c9d8a0bdb` only loaded the references for viewing and still produced large painterly turnaround figures instead of tiny sprite-box views. Rollout `codex-019f1482-8954-7b52-9f75-b377cf957645` proved the sprite-box prompt still fails when the run only views reference PNGs before a text prompt; that passive sequence is not sufficient image binding.

Generate final idle/walk states as one coherent `8x4` state sheet for the same character, saved under:

```text
.agent/home-field-workspace/raw/thalla_chibi.states.source.png
```

This grouped state sheet is the required source for all final state tiles so face, cap, robe, outline, palette, detail level, pose, and motion stay consistent across idle and walk frames. Row order is `down`, `up`, `left`, `right`; columns `0-1` are idle; columns `2-7` are the walk lane. Idle column `0` is the normal planted pose, and idle column `1` is only a little `1-3px` bob/squish: the cap/head top may dip a few pixels and the body may compress slightly, but the character must remain standing with nearly the same alpha height. This bob/squish must exist in the grouped state sheet itself. Do not synthesize idle motion after splitting by shifting, squashing, stretching, repainting, or otherwise changing frame pose/silhouette. Do not bend the knees into a crouch, make the body sit low, or shorten the visible silhouette dramatically. The source may be exactly `512x256` or a larger proportional `8x4` sheet for cleaner downscaling. It may use true transparency or flat `#ff00ff` chroma key. Do not generate final idle/walk states as 32 separate imagegen calls; that was the main style-drift failure in the 2026-06-22 rerun. Single-cell image regeneration is allowed only as a targeted, human-approved repair after a grouped sheet mostly passes but one cell is defective; deterministic post-split edits may clean alpha, remove chroma-key fringe, crop, or resize only, not alter pose, motion, silhouette, style, or identity.

Quality bar: the composed chibi must look at least as crisp, contrasted, and finished as the approved Home Field props at scene scale. Avoid blurry/downscaled sticker results. Require a chunky readable silhouette, thicker warm dark outline, clear face/cap/robe value separation, and finished hand-drawn polish comparable to the bushes, mushrooms, and gates in the clean preview.

### Limited Sprite Palette

Developer feedback on the 2026-06-26 candidate: "Palette is too large. It needs fewer than 20 colors." Treat this as a production art-direction gate.

For Stage 1 chibis, generate with a deliberately small sprite palette:

- target `12-18` artist-visible colors across the whole character sheet, and stay under `20`;
- exclude transparency and the flat `#ff00ff` chroma-key background from that count;
- do not count unavoidable single-pixel edge interpolation from resize/alpha cleanup as new design colors, but visible clusters, gradients, airbrush shading, soft glow, or many near-duplicate beige/gold tones do count as palette bloat;
- use shared ramps: one warm dark outline/shadow, one shared deep umber/plum, one or two bone highlights, `2-3` cap tones, `2-3` robe/body tones, `2` gold identity tones, and `2-3` face/skin tones;
- reuse colors between cap, robe, skin, and gold marks whenever possible instead of introducing new local shades for tiny details;
- use broad flat clusters and one-step shadows/highlights, not painterly gradients, soft blush fields, many cap spots, scattered gold freckles, or separate tones for each facial/robe detail.
- represent Thalla's authority through the cap silhouette, robe blocks, posture, and `1-2` flat mycelium/spore marks only; do not spend palette or detail on royal regalia, crown jewels, forehead gems, brooches, chest medallions, pendants, jewelry-like cap crests, gold filigree, scalloped collars, ornamental robe borders, decorative trim clusters, sleeve cuff trim, clasps, collar jewels, or repeated gold badges.

This is not permission to switch to hard pixel art, clean vector/cel icon art, or a generic flat anime turnaround. The desired result is still a hand-drawn 2D field sprite with smooth-enough silhouettes after `--resize`, but its source art must be designed like an indexed small-palette sprite. Do not use "exactly 16 swatches", "hard-edged cel shading", or similar prompt overcorrections if they destroy the warmer BJD-inspired field-sprite charm. If the composed preview looks like it uses a soft illustration palette with more than roughly `20` visible colors, mark it `needs_regen` even when mechanical validators pass.

Deterministic/mechanical fallback drawings are allowed only as explicitly requested diagnostics. They must not be committed or reported as a fresh imagegen art candidate, even if they pass dimensions, alpha, frame-count, and manifest checks.

After every image generation step, immediately run `npm run game:home-field:verify-chibi-proof-files -- --path=<generated_png_path>` or the stage-specific verifier below. If built-in imagegen writes outside the repo, claim the file into the documented path with `npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference|state-sheet>` instead of manually copying and hashing it. A chat-visible image, rollout record, or cache search is not enough; the PNG must exist at the documented repo path before continuing.

If built-in imagegen renders in chat during reference or state-sheet generation but the file path is unknown, immediately run `npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference|state-sheet>`. Use `--include-temp` only for one bounded retry. Count only a file newer than that render. If no file is found, stop and report the image-output blocker instead of running broad filesystem searches or creating deterministic fallback art. Keep `npm run game:home-field:find-imagegen-output` only for the preflight diagnostic probe, where there is intentionally no proof destination.

After generating the grouped state sheet, run:

```bash
npm run game:home-field:verify-chibi-proof-files -- --state-sheet
npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --resize
```

Use smooth resizing (`--resize`) when composing higher-resolution isolated source frames into the `64x64` runtime sheet. Do not use nearest-neighbor resizing for production candidates; hard pixel stair-steps are a rejection signal for this hand-drawn field-sprite style.

If alpha/halo validation fails because chroma-key tolerance needs recovery, run `npm run game:home-field:recover-chibi-alpha -- thalla`. The helper iterates bounded safe tolerances, reruns split/produce/file verification, and stops only when alpha/halo validation passes. Do not hand-try tolerance values, and do not use alpha recovery to mask style, pose, identity, baked-shadow, or animation failures.

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
- use `docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png` as a positive direction for compact grouped-sheet proportions and charm, while fixing its palette bloat, ornament, and sticker softness;
- use `docs/reference/home-field/chibi-thalla-liked-2026-06-23.png` as the primary positive direction for Thalla's youthful little-girl chibi face/body read: rounded cheeks, sweet simple expression, compact but visible oval/almond doll eyes, tiny childlike body, and soft hand-drawn field-sprite charm;
- use BJD-inspired chibi doll simplicity: smooth porcelain/resin-like face planes translated into hand-drawn 2D art, rounded cheeks, compact calm face features, visible dark oval/almond doll eyes, mitten-like hands, tiny feet, and a quiet collectible-doll posture;
- mushroom-elf biology first, not a human wearing a mushroom hat and not hair/wig under a mushroom cap
- visible elf ears whenever ears are visible
- strong silhouette readable without labels
- simple readable costume, not portrait-level detail
- elevated top-down 2.5D map-sprite camera, with the top of the mushroom cap/head visible
- compact standing pose seen from above like a small hub character, not a front-facing portrait sticker
- clear feet/base grounding
- no baked ground shadow in any chibi frame; use the separate shared `chibi_shadow` renderer/asset layer under the character
- warm dark outline and quiet Home Field palette fit
- no old monk, elderly gnome, beige mascot pawn, faceless mushroom token, skull-mask face, hollow pin-dot eyes, blank mask face, or generic robed elder read; mechanical validators do not approve a source that misses the youthful little-girl Thalla reference style
- limited source palette: `12-18` visible swatches, fewer than `20` total design colors, with shared ramps instead of many near-duplicate highlights and shadows
- no text, UI, frame borders, floor plane, or baked background
- no glossy anime eyes, eyelashes, or huge white portrait eyes; eyes must be compact but visibly cute dark oval/almond doll features, smaller than the reference screenshot's biggest facial read but not reduced to hollow pin-dots or a skull-mask face
- no realistic doll-photo rendering, glossy plastic toy rendering, fashion-doll proportions, or porcelain figurine material study
- no dense cap spots, scattered gold freckles, robe filigree, many tear/drop marks, or baked blob/cast shadows; if a detail does not read as one of the few large identity marks at `64px`, remove it
- no earrings, fashion jewelry, royal regalia, crown jewels, forehead gems, brooches, chest medallions, pendants, jewelry-like cap crests, scalloped collars, ornamental robe borders, decorative trim clusters, sleeve cuff trim, clasps, collar jewels, repeated gold badges, large standalone character-turnaround proportions, soft painterly turnaround figures, quadrant-filling reference art, or over-flat cel/vector/pixel style introduced only to satisfy the palette budget

For Thalla, use `docs/design-requirements.md` as the authoritative design source: ancient gold-white mushroom-elf sovereign, black eyes with fiery-gold life, gold tear-like spore traces, luminous gold mycelium across skin, sacred fungal regalia, and a warm bone/gold/white/brown palette. Simplify aggressively for `64px`. Imagegen prompts may translate that canon into "field-sprite leader" / "calm biostasis stillness" language when "sovereign", "regal", or "sacred regalia" repeatedly pulls in jewelry-like ornament.

Mechanical checks are necessary but not sufficient. A candidate that passes dimensions, alpha, sheet mapping, or mobile readability still fails if it reads as pixel art, a tiny beige featureless doll, a busy ornate fantasy sprite, a generic elf, a straight portrait sticker, a human with a mushroom hat or hair under a mushroom cap, glossy anime-eyed turnaround art, quadrant-filling character art, an old mushroom monk, an elderly gnome, a beige mascot pawn, a faceless mushroom token, a skull-mask face, hollow pin-dot eyes, a blank mask face, or a different renderer from the Home Field reference.

Stage 1 detail budget:

- `2-3` main body/costume color regions, not layered regalia filigree
- fewer than `20` artist-visible colors across the source sheet; prefer `12-18`
- `1` bold cap/head silhouette and `1` simple robe/body silhouette
- `1-2` large gold mycelium/spore marks total per frame; no scattered small cap freckles or many gold droplets
- tiny face features only; eyes/mouth must not become portrait focal points, glossy anime eyes, eyelashes, or oversized white-eye stickers
- no jewelry clusters, royal regalia, crown jewels, forehead gems, brooches, chest medallions, pendants, jewelry-like cap crests, scalloped collars, ornamental robe borders, decorative trim clusters, sleeve cuff trim, clasps, collar jewels, repeated gold badges, tiny chains, lace, runic micro-marks, particle halos, visible hair bangs, wig fringe, or hairlike strands
- no tall full-body fashion-pose proportions; keep the sprite squat and grounded

## Candidate Workflow

1. Generate only the Stage 1 grouped Thalla state sheet under `.agent/home-field-workspace/raw/thalla_chibi.states.source.png`.
2. Split that sheet into the 32 raw Thalla frame files under `.agent/home-field-workspace/raw/`.
3. Produce the candidate sheet under `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`.
4. Validate only `thalla`, including `--check-chibi-animation`.
5. Build contact/readability/alpha evidence and mobile+desktop Home Field previews using candidate routing.
6. Update `docs/home-field-asset-review.json` for `thalla` only.

The Stage 1 batch may end with `needs_review`, `needs_regen`, or `rejected`. Human approval is required before promotion to app-facing PNGs or expansion to the next roster stage.
