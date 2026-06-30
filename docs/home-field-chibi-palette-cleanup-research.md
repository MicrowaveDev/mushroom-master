# Home Field Chibi Palette And Cleanup Research

Date: 2026-06-30

This note records the palette and cleanup findings from the Thalla Stage 1 proof reruns. It complements:

- [`docs/home-field-chibi-style-reference.md`](home-field-chibi-style-reference.md)
- [`docs/home-field-imagegen-requirements.md`](home-field-imagegen-requirements.md)
- [`docs/home-field-chibi-regression-ledger.md`](home-field-chibi-regression-ledger.md)

Use this document when deciding whether a future run needs a palette audit helper, a palette-aware cleanup pass, or a different imagegen path.

## Local Evidence

Attached review images were copied into checked-in reference storage so the research is not tied to temporary clipboard paths:

- Previous better / production-ready palette capture: [`docs/reference/home-field/chibi-thalla-palette-before-2026-06-30.png`](reference/home-field/chibi-thalla-palette-before-2026-06-30.png)
- Palette capture after the 2026-06-30 built-in reference-bound run: [`docs/reference/home-field/chibi-thalla-palette-after-2026-06-30.png`](reference/home-field/chibi-thalla-palette-after-2026-06-30.png)
- Developer-cleaned sheet, described in review as cleaned by Tetro Diffusion: [`docs/reference/home-field/chibi-thalla-retro-cleaned-2026-06-30.png`](reference/home-field/chibi-thalla-retro-cleaned-2026-06-30.png)

The live reference from rollout `codex-019f1a06-dd6d-78d3-9d13-212a7f67232a` was:

- `.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png`
- `1536x1024`
- sha256 `d10b313024a1f43eff547126fbb34374bd0f11d3eb5dea4bc6332ce52a678194`

That rollout stopped correctly at the reference gate. It did not produce a grouped `8x4` state sheet, split frames, candidate spritesheet, candidate evidence, preview, or approval.

## Palette Measurements

The Aseprite screenshots are UI captures, not raw asset palettes, so treat these as review signals rather than canonical image statistics.

- The previous palette capture sampled as roughly `256` occupied swatch cells.
- The after-run palette capture sampled as roughly `251` occupied swatch cells.
- Conclusion: the new built-in reference-bound run did not materially solve palette bloat at the visible swatch level.

For asset images, exclude the `#ff00ff` / hot-magenta background before measuring. Raw unique RGB counts are too sensitive to antialiasing, resize, and compression, so use them only as diagnostics. More useful metrics are:

- exact non-magenta colors above `0.1%` of non-background pixels;
- coarse visible-color bins after grouping near-neighbor colors;
- a generated palette swatch image for human review.

Observed diagnostics from the attached/referenced images:

| Image | Exact non-magenta colors at >=0.1% | Coarse `32`-step bins at >=0.1% | Interpretation |
| --- | ---: | ---: | --- |
| Live 2026-06-30 reference | `79` | `59` | Still broad for a small sprite; many near-neighbor cream/gold tones. |
| Developer-cleaned sheet | `19` | `59` | Better significant-color concentration, but still has many antialias/near-neighbor bins. |
| 2026-06-26 previous-best state reference | `51` | `56` | Appealing compact direction, but still palette-bloated. |
| 2026-06-23 liked Thalla reference | `68` | `45` | Good face/cap/robe appeal, not a runtime-ready palette. |

The developer-cleaned sheet is evidence that a palette-aware cleanup path can reduce the dominant visible colors, but it is not enough by itself. It keeps or amplifies semantic failures that the current gate rejects: glossy large eyes, hair/wig-like locks under the cap, ornament/status markings, and polished character-turnaround styling.

## Tool Research

The user called the cleanup path "Tetro Diffusion". Public docs and examples found during this pass align more clearly with Retro Diffusion-style tooling; verify the exact tool before automating.

Relevant tool classes:

- Retro Diffusion / RD Fast: palette-aware pixel-art generation and editing paths. Public API examples include image-edit variants, spritesheet workflows, color reducer, palette converter, color style transfer, and k-centroid downscale examples. See [Retro Diffusion API examples](https://github.com/Retro-Diffusion/api-examples) and [Replicate's RD Fast page](https://replicate.com/retro-diffusion/rd-fast).
- Aseprite CLI: useful for deterministic palette experiments, indexed color conversion, and reproducible asset export. See [Aseprite CLI docs](https://www.aseprite.org/docs/cli/) and [Aseprite color mode docs](https://www.aseprite.org/docs/color-mode/).
- pngquant / libimagequant: useful for lossy palette quantization and file-size optimization experiments. See [pngquant](https://pngquant.org/) and [libimagequant](https://pngquant.org/lib/).
- ImageMagick-style palette remapping: useful for diagnostics and controlled remap tests when a reference palette already exists.

Do not treat any of these as an approval shortcut. A cleanup tool can make a sheet more palette-like while leaving the character wrong for Home Field.

## Recommended Workflow Use

1. Keep the current reference gate. If the reference fails hair/cap biology, glossy eyes, ornament, or sprite occupancy, stop before grouped state generation.
2. Add or run a palette-audit helper before calling a reference "visually close". The helper should emit JSON plus a palette swatch PNG and should report:
   - source image path and hash;
   - magenta/background exclusion rule;
   - exact non-background color count;
   - colors above `0.1%` and `0.05%`;
   - coarse visible-color bins;
   - top dominant colors;
   - a pass/fail note for the `<20` visible design-color target.
3. Use palette cleanup only as a diagnostic or candidate-repair experiment unless it is followed by the same visual gate and runtime proof.
4. If using a Retro/Tetro-style cleanup path, constrain it with the Home Field reference palette and style rules, then reject outputs that introduce or preserve:
   - hair or wig reads under the mushroom cap;
   - glossy anime eyes or eyelashes;
   - jewelry, clasps, medallions, cap crests, repeated gold badges, or robe trim;
   - large character-turnaround proportions instead of tiny source-sprite occupancy;
   - hard pixel-art / flat vector overcorrection that loses the previous-best compact charm.
5. Do not post-split quantize, crush, or repaint a generated state sheet to make it pass style review. Palette remap is allowed as an experiment only until a dedicated helper, evidence format, and visual gate make it safe.

## Open Tooling Backlog

- Add `npm run game:home-field:palette-audit -- <png>` or equivalent.
- Make `candidate-evidence.manifest.json` include palette-audit artifacts when chibi proof reaches candidate generation.
- Consider a separate `palette-cleanup-experiment` helper that writes only under `.agent/home-field-workspace/experiments/`, never app-facing or candidate paths.
- If a Retro/Tetro Diffusion API path is adopted, document its credential/env requirements and require source/reference hashes in the cleanup manifest.
