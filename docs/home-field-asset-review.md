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
