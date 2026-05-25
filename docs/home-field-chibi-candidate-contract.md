# Home Field Chibi Candidate Contract

Date: 2026-05-25

This contract is the stop-gate for active-roster Home Field chibi candidate generation. It exists because the original Home Field proof workflow only covered the generic `_placeholder` character, while production candidates must preserve the active game roster's character identities.

## Scope

Generate candidate-only spritesheets for the active game roster:

- `thalla`
- `lomie`
- `axilin`
- `kirt`
- `morga`
- `dalamar`

Do not generate non-roster characters in this batch. Do not overwrite app-facing PNGs, do not approve candidates, and do not set `accepted: true`.

## Spritesheet Contract

Each character uses the locked Home Field character sheet shape:

- Output canvas: `512x256`
- Frame size: `64x64`
- Grid: `8` columns x `4` rows
- Row order: `down`, `up`, `left`, `right`
- Columns per row: `0-1` idle frames, `2-7` walk frames
- Transparent background
- Character feet/base grounded near the bottom of each frame
- Compact blob shadow under the feet/base

Production character candidates require full per-character walk coverage. The placeholder-only 12-frame replicated-walk composition is not sufficient for this batch.

Raw frame naming for the full-frame candidate composer should be:

```text
.agent/home-field-workspace/raw/<id>_chibi.frame_down_00.source.png  ... frame_down_07.source.png
.agent/home-field-workspace/raw/<id>_chibi.frame_up_00.source.png    ... frame_up_07.source.png
.agent/home-field-workspace/raw/<id>_chibi.frame_left_00.source.png  ... frame_left_07.source.png
.agent/home-field-workspace/raw/<id>_chibi.frame_right_00.source.png ... frame_right_07.source.png
```

Frame numbers match sheet columns: `00` and `01` are idle; `02` through `07` are walk frames.

## Visual Contract

All six chibis must read at 64px on the green Home Field on mobile and desktop:

- mushroom-elf biology first, not humans wearing mushroom hats
- visible elf ears whenever ears are visible
- strong silhouette readable without labels
- simple readable costume, not portrait-level detail
- clear feet/base grounding
- warm dark outline and quiet Home Field palette fit
- no text, UI, frame borders, floor plane, or baked background

## Character Identity Notes

Use `docs/design-requirements.md` as the authoritative character-design source for Thalla, Lomie, Axilin, Kirt, and Dalamar. For Morga, use only the active game contract and existing roster art direction until a fuller design-requirements section exists: fast red-orange flash striker, First Bloom opening burst, Flash Cap speed/stun energy, afterimage/calyx/sunburst motifs, light armor, aggressive movement, and mushroom-elf biology.

## Candidate Workflow

1. Generate raw frame candidates under `.agent/home-field-workspace/raw/`.
2. Produce candidate sheets under `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`.
3. Validate only the scoped ids.
4. Build contact/readability sheets and mobile+desktop Home Field previews using candidate routing.
5. Update `docs/home-field-asset-review.json` for the six active ids only.

The active batch may end with `needs_review`, `needs_regen`, or `rejected`. Human approval is required before promotion to app-facing PNGs.
