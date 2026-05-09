# Artifact Regeneration Plan

> Status: shipped on 2026-05-09. This document is now the historical ship record for the targeted regeneration pass. The live contract still lives in `app/server/game-data.js`, `docs/artifact-image-reference.md`, `docs/artifact-bitmap-todolist.md`, and the artifact image pipeline scripts.

## Source Of Truth

Original request:

- Regenerate `lomie_mirror_route_map.png`.
- Regenerate `golden_spore_mace.png`.
- Regenerate `haste_wisp.png`.
- Regenerate `heartwood_splinter_bow.png`.
- Regenerate `morga_afterimage_crown.png`.
- Fix `moss_pouch.png`, which has a ratio problem.
- Regenerate `obsidian_throne_chip.png`.
- Do not treat `portal_cut_sickle.png` as a normal redraw target yet; it looks like two merged Backpack Battles-style artifacts, so add that idea to backlog.
- Investigate uneven artifact bitmap quality/compression, especially `spore_burst_arrow.png` and recent artifacts.
- Make compression/detail handling deterministic and consider how many grid cells each artifact occupies in-game.

Success conditions:

- The listed regeneration targets have simpler, chunkier, less noisy PNGs.
- `moss_pouch` uses the same displayed footprint in generation, validation, contact sheets, and game rendering.
- Recent artifacts no longer feel inconsistently compressed or blurred relative to their footprint size.
- `portal_cut_sickle` is documented as a future merged-artifact seed, not accidentally overfit as a current normal item.
- The full artifact sheet and thumbnail/readability review make the result easy to inspect.

Non-goals:

- No combat balance, shop economy, unlock, or battle-effect changes.
- No fusion/merge mechanic implementation in this pass.
- No full 117-artifact redraw unless the targeted pass reveals a systemic failure.

Open assumptions:

- `moss_pouch` should visually match the displayed legacy bag orientation: 2x1 landscape in the shop/grid, even though the stored artifact data is `width: 1`, `height: 2`.
- `portal_cut_sickle` can stay live temporarily, but the next art pass should either simplify it into one ordinary sickle-like object or replace it after a merge mechanic exists.

## Current Findings

The validation suite accepts the regenerated artifact PNGs, but validation is still geometry-oriented. It does not judge whether an icon is too detailed, visually compressed, or conceptually muddy; use the official contact sheet and thumbnail review as visual evidence.

`moss_pouch` had a real source-of-truth mismatch, fixed in this pass:

- `getBagShape(moss_pouch)` treats legacy rectangular bags as landscape, so the displayed bag footprint is 2x1.
- Artifact image tools now use the canonical displayed bag shape for generation, validation, contact sheets, thumbnail labels, visual classification, and figure fallback rendering.
- `moss_pouch.png` was regenerated as a horizontal 2x1 pouch.

The recent blanket simplification pass reduced noise, but it applied the same treatment to every footprint. That made some 2x1/2x2 pieces look lower quality than older approved anchors. Detail normalization should be deterministic by occupied cell count, not a one-size filter.

## Regeneration Targets

| Artifact | Footprint | Required Direction |
| --- | ---: | --- |
| `lomie_mirror_route_map` | 1x2 | Redraw as a clean black-violet mirror tablet with a thick frame, 2-3 broad teal route lines, and very few gate dots. Avoid icy crystal texture and micro-cracks. |
| `golden_spore_mace` | 2x2 | Redraw as a solid blocky mace head with a short handle, a few large gold spore bumps, and one cyan biostasis mark. Avoid dense holes and filigree. |
| `haste_wisp` | 1x1 | Redraw as a compact speed leaf/flame emblem with one bright tip and one motion stripe. It should read as speed/utility, not a detailed feather. |
| `heartwood_splinter_bow` | 2x1 | Redraw as one broad black heartwood bow with a green resin string and one amber arrowbud. Avoid small bark knots and tiny end decorations. |
| `morga_afterimage_crown` | 2x1 | Redraw as two simple crown silhouettes, left solid and right translucent, connected by one white speed band. It must not read as a flame smear. |
| `moss_pouch` | displayed 2x1 | Fix pipeline first, then redraw as a horizontal two-slot moss pouch/satchel. The mouth, tie, and belly should span both cells. |
| `obsidian_throne_chip` | 1x2 | Redraw as a tall, broad obsidian throne shard with a simple white mold crown and one ash edge. Avoid gritty stone texture and tiny fractures. |

Quality-watch candidate:

| Artifact | Reason |
| --- | --- |
| `spore_burst_arrow` | The concept is acceptable, but it shows the uneven recent-art quality/compression problem. Reprocess after the deterministic detail pipeline exists; regenerate only if it still reads bad at 48px. |

Backlog, not current redraw:

| Artifact | Backlog Direction |
| --- | --- |
| `portal_cut_sickle` | Reserve as a future merge/fusion recipe seed: portal edge + blade/sickle. If touched before fusion exists, simplify it into one ordinary live item and keep the merged concept in the catalog backlog. |

## Footprint-Aware Detail Policy

The bitmap pipeline should normalize final detail density using the artifact's displayed footprint:

- Resolve the rendered shape first:
  - normal artifacts: `width x height`
  - all bags: `getBagShape(artifact)`, including rectangular legacy bags like `moss_pouch`
  - shaped bags: their mask dimensions
- Keep final dimensions deterministic: `cols * 160` by `rows * 160`.
- Apply lighter smoothing/quantization to larger footprints and stronger simplification only to true 1x1 icons.
- Never run a blanket compression/simplification pass across mixed footprints.
- Prefer prompt-level simplification over destructive postprocessing. Postprocessing should reduce tiny noise while preserving silhouette and large color regions.
- Use thumbnail review at 32px, 48px, and 64px as sign-off evidence; coverage validation alone is not enough.

Suggested pipeline command shape:

```bash
npm run game:artifacts:normalize-detail -- artifact_id...
```

Implemented as `npm run game:artifacts:normalize-detail -- artifact_id...`. The script reads the canonical displayed footprint, preserves final dimensions at `cols * 160` by `rows * 160`, and applies deterministic footprint-aware smoothing/quantization without a blanket mixed-size downsampling pass.

## Implementation Plan

1. Fix canonical bitmap footprint handling.

   Update chroma-key conversion, coverage validation, contact sheet dimensions, thumbnail review metadata, and artifact figure fallback rendering to use `getBagShape(artifact)` for all bag artifacts. Update the visual-classification snapshot so `moss_pouch` is `wide` if the game displays it as 2x1.

2. Add deterministic footprint-aware detail normalization.

   Add a script or conversion option that normalizes tiny detail based on occupied cells. It should read the artifact definition, preserve final PNG dimensions, and avoid uniform downsampling across 1x1, 2-cell, and 4-cell pieces.

3. Regenerate the seven requested targets.

   Use `docs/artifact-image-style-prompt.md` plus the target table above. Generate one raw source at a time, copy it into `.agent/artifact-image-workspace/raw/{id}.source.png`, convert it with the chroma-key helper, and run the footprint-aware normalizer.

4. Reprocess `spore_burst_arrow` after the normalizer exists.

   Start with deterministic reprocessing from the current raw source. Regenerate only if the thumbnail sheet still shows poor readability or uneven compression.

5. Refresh docs/provenance/review sheets.

   Update `app/shared/artifact-image-metadata.json`, regenerate the full contact sheet, regenerate the thumbnail readability sheet, and keep `portal_cut_sickle` listed as merge-backlog rather than a normal redraw target.

6. Verify.

   Run:

   ```bash
   npm run game:artifacts:validate -- lomie_mirror_route_map golden_spore_mace haste_wisp heartwood_splinter_bow morga_afterimage_crown moss_pouch obsidian_throne_chip spore_burst_arrow
   npm run game:artifacts:provenance:generate
   npm run game:artifacts:provenance:check
   npm run game:artifacts:sheet
   npm run game:artifacts:sheet -- --validate-only
   npm run game:artifacts:thumbnail-review
   node --test tests/web/artifact-render.test.js tests/game/artifact-visual-classification.test.js tests/game/bag-items.test.js
   npm run game:test
   ```

7. Commit as one focused art-pipeline pass.

   Keep the commit scoped to artifact pipeline fixes, the seven regenerated PNGs, optional `spore_burst_arrow` reprocessing, metadata, and docs. Do not update hub pointers unless explicitly requested.

## Completion Notes - 2026-05-09

- Completed Step 1: canonical bitmap footprint handling now uses `getBagShape(artifact)` for all bag artifacts in chroma-key conversion, coverage validation, contact sheet dimensions, thumbnail footprint labels, prompt generation, visual classification, and artifact figure fallback rendering.
- Completed Step 2: added `npm run game:artifacts:normalize-detail -- artifact_id...`, a deterministic footprint-aware detail normalization pass that preserves `cols * 160` by `rows * 160` PNG dimensions.
- Completed Step 3: regenerated `lomie_mirror_route_map`, `golden_spore_mace`, `haste_wisp`, `heartwood_splinter_bow`, `morga_afterimage_crown`, `moss_pouch`, and `obsidian_throne_chip` from fresh imagegen raws.
- Completed Step 4: reprocessed `spore_burst_arrow` with the deterministic normalizer; no redraw was needed after review.
- Completed Step 5: regenerated `app/shared/artifact-image-metadata.json`, `.agent/artifact-image-workspace/review/contact-sheet.png`, `.agent/artifact-image-workspace/review/contact-sheet.manifest.json`, and `.agent/tasks/artifact-image-system/phase-1/raw/thumbnail-review.png`.
- Completed Step 6: targeted validation, provenance generation/check, contact-sheet generation/DOM validation, and thumbnail review generation passed. Broader unit verification is recorded in the handoff for this pass.
