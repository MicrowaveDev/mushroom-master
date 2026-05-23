# Home Field Asset Review

Date: 2026-05-23

This is the checked-in visual gate for Home Field art. The current PNG set is not production-approved. It may be used for pipeline, connector, and layout proof only.

Machine-readable verdicts live in [home-field-asset-review.json](home-field-asset-review.json). `accepted: true` is reserved for explicit human approval after contact sheet and clean preview review.

## Current Verdict

| Asset group | Verdict | Reason | Next action |
| --- | --- | --- | --- |
| Terrain grass/path/edge tiles | needs regeneration | Connector metadata exists, but repeated tiles still read procedural, mixed, or wallpaper-like. | Regenerate one terrain family at a time; review isolated tile, 3x3 repeat, adjacency sheet, and clean preview. |
| Props and exits | needs regeneration | Props are readable but not cohesive with terrain; several need alpha/halo and scale review. | Regenerate after terrain is approved; validate alpha on light and dark backgrounds. |
| Effects | placeholder | Current strips exist only to satisfy file and animation gates. | Replace with authored/generated production animation frames. |
| Chibi | placeholder | `_placeholder` is a technical spritesheet, not a character asset. | Replace with production chibi spritesheet before launch. |

## Next Generation Run

Start with terrain only. Do not generate props, exits, effects, or chibi until the green field reads as a cohesive production scene in the clean preview.

```bash
npm run game:home-field:next-tiles
```

That command is the gated first-pass queue. If any existing candidate is still `needs_review`, it blocks until the review manifest is resolved. For the next intentional grass-family rerun, use the field-context queue:

```bash
npm run game:home-field:rerun-grass-field
```

The field-context rerun command emits the current grass-family candidates whose review verdict is `needs_review` or `needs_regen`:

- `grass_base_01`
- `grass_base_02`
- `grass_flowers_01`

Stop after those three tiles. Do not generate path or edge tiles until the grass family passes review. For each generated tile, use the producer command printed in its prompt block, then run:

```bash
npm run game:home-field:validate -- --check-files --check-connectors --check-review
npm run game:home-field:sheet
npm run game:home-field:adjacency
npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line
```

Use `npm run game:home-field:next-tiles-all` only after the grass-family stop gate is accepted.

## Approval Rules

- `missing`: no app-facing PNG exists yet.
- `generated`: a candidate exists but has not been reviewed.
- `needs_review`: a candidate exists and must be judged from the contact sheet and clean preview screenshots.
- `rejected`: candidate must not be used as production art.
- `placeholder`: technical scaffold only; never production-approved.
- `approved`: production candidate accepted by a human reviewer.

An asset can be marked `approved` only when the JSON review row has `"verdict": "approved"` and `"accepted": true`.

Production Home Field validation is:

```bash
npm run game:home-field:validate -- --production
```

That gate intentionally fails while any asset is not approved or is still a placeholder.

Each machine-readable review row also carries `repeatCheck`, `connectorCheck`, `cleanPreviewCheck`, `sceneFitCheck`, `styleCohesionCheck`, `alphaCheck`, and `scaleCheck`. An `approved` verdict requires those fields to be `pass` or `not_applicable`; prose alone is not enough.
