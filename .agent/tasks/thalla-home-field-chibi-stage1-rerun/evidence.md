# Evidence

## Summary

Thalla Stage 1 was rerun as a candidate-only chibi proof. The final candidate comes from one generated grouped state sheet, split into 32 frames, with a deterministic 1px idle bob applied only to idle column `1` frames after split. No app-facing Home Field spritesheet was modified.

## Outputs

- Reference sheet: `.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png`
- Grouped state sheet: `.agent/home-field-workspace/raw/thalla_chibi.states.source.png`
- Candidate spritesheet: `.agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png`
- Contact sheet: `.agent/home-field-workspace/review/contact-sheet.png`
- Alpha/halo sheet: `.agent/home-field-workspace/review/alpha-halo-sheet.png`
- Mobile readability sheet: `.agent/home-field-workspace/review/mobile-readability-sheet.png`
- Mobile preview: `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png`
- Desktop preview: `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png`
- Evidence manifest: `.agent/home-field-workspace/review/candidate-evidence.manifest.json`

## Hashes

- Candidate spritesheet: `e32e7b45c239261c35c851c11b976580027bee44a9f917d32f572c6a1d78f813`
- Reference sheet: `35ad46691f2e0b3ddd179a413a41890e91c8f8605d207bca5c7bd01000e2a109`
- Grouped state sheet: `181fc3e11da4981c5c181574a04126229eebb90c8a000d70e4f5afc5f66b0fb8`
- Mobile preview: `4c61666d329bcd7e7272b49fd20719da2e54e9925cb8a2a561627d882e63ce4d`
- Desktop preview: `e934ae01e583cc8e07da72ab69beb5fec12cc3631012df7686eb595393630da7`
- Candidate evidence file: `2e656d4c87e086adf4ba13b12a2a947fb578237cf5972b85c2be8ecade7a4554`

## Verification

- AC1 PASS: `npm run game:home-field:preflight-chibi-proof` passed before cleanup.
- AC2 PASS: `npm run game:home-field:verify-chibi-proof-files -- --state-sheet` passed for `.agent/home-field-workspace/raw/thalla_chibi.states.source.png` at `1774x887`.
- AC3 PASS: `npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --chroma-tolerance=48 --resize` wrote all 32 frames, and `npm run game:home-field:verify-chibi-proof-files -- --frames` passed.
- AC4 PASS: `npm run game:home-field:produce-chibi-candidate -- thalla` wrote only `.agent/home-field-workspace/candidates/chibi-active-roster/latest/web/public/home-field/characters/thalla/spritesheet.png`.
- AC5 PASS: `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-alpha-halo --check-readability --check-chibi-animation --check-chibi-quality --check-review` passed.
- AC6 PASS: `npm run game:home-field:sheet`, `npm run game:home-field:alpha-sheet -- --ids=thalla`, `npm run game:home-field:mobile-readability-sheet -- --ids=thalla`, `npm run game:home-field:chibi-candidate-preview`, and `npm run game:home-field:candidate-evidence` all passed/refreshed outputs.
- AC7 PASS: `docs/home-field-asset-review.json` now marks `thalla` as `needs_review` with `accepted: false`.

## Animation Check

Final candidate idle column `1` is a small upright bob, not a crouch:

- `down`: idleUnique `2`, heightLoss `0`, centerShift `1.0`, topDrop `1`, walkUnique `6`
- `up`: idleUnique `2`, heightLoss `0`, centerShift `1.0`, topDrop `1`, walkUnique `6`
- `left`: idleUnique `2`, heightLoss `0`, centerShift `1.0`, topDrop `1`, walkUnique `6`
- `right`: idleUnique `2`, heightLoss `1`, centerShift `1.5`, topDrop `2`, walkUnique `6`

## Notes

Codex built-in image generation was used. The generated image payload was recovered from the current Codex rollout record, then saved into the documented repo paths. The local Pillow chroma-key helper could not run because Pillow is not installed for the active Python, so the repo split path was used with chroma tolerance plus a focused frame-level magenta-fringe cleanup through the existing PNG toolkit.
