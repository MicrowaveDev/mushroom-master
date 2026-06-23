# Thalla Home Field Chibi Stage 1 Rerun

## Source Of Truth

Original request: rerun Thalla Home Field chibi Stage 1 only in candidate mode. Use one coherent `8x4` grouped state sheet, split it into frames, keep the liked simple BJD-inspired chibi style, prop-level crispness/contrast, a separate shadow tile, and four meaningful walk poses across six walk slots. Idle column `0` is normal standing; idle column `1` is only a little `1-3px` bob/squish while staying upright, not a crouch/deep squat. No app-facing overwrite. Run preflight, split, candidate validation, sheets, and previews.

## Acceptance Criteria

- AC1: Preflight passes before stale Thalla Stage 1 cleanup/regeneration.
- AC2: Final Thalla source is one coherent grouped state sheet at `.agent/home-field-workspace/raw/thalla_chibi.states.source.png`.
- AC3: The grouped sheet is split into all 32 canonical `64x64` raw frame files.
- AC4: Candidate spritesheet is written only under `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`, with no app-facing overwrite.
- AC5: Scoped candidate validation for `thalla` passes files, alpha halo, readability, chibi animation, chibi quality, and review metadata.
- AC6: Contact, alpha/halo, mobile readability, evidence, and mobile/desktop preview outputs are refreshed for the candidate.
- AC7: Review metadata remains candidate-only: `accepted: false`, no approval or production promotion.

## Non-Goals

- Do not modify app-facing Home Field character spritesheets.
- Do not expand to Stage 2 roster characters.
- Do not approve the candidate for production.
