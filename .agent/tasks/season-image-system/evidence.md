# Evidence — Season Image System pipeline scaffolding

Phase: scaffolding (pre-asset generation). Verified 2026-05-02.

## Summary

Pipeline scaffolding for season rank emblems and run-achievement badges
is shipped. The asset-agnostic primitives previously inlined into the
artifact image scripts now live in
[`app/scripts/lib/bitmap-image-toolkit.js`](../../../app/scripts/lib/bitmap-image-toolkit.js)
and the four artifact scripts consume them. A parallel season pipeline
mirrors the artifact convention: style guide + todolist + 5 scripts +
npm aliases + workspace path. Runtime components fall back to the
existing inline SVG (ranks) or emoji glyph (achievements) until
production PNGs land.

The actual 25 PNGs are an outstanding manual imagegen step (see
[`spec.md` § Outstanding](spec.md)). Once they land and
`game:season:provenance:check` reports 25/25, the SVG/glyph fallbacks
become dead code (see [`spec.md` § Backlog](spec.md)).

## Verification per acceptance criterion

| AC | Status | Verification |
| --- | --- | --- |
| AC1 — toolkit extracted, artifact scripts consume it | PASS | `grep -l 'lib/bitmap-image-toolkit' app/scripts/*.js` returns the four artifact scripts plus the season scripts. |
| AC2 — artifact pipeline still functional | PASS | `npm run game:artifacts:provenance:check` → "OK artifact image provenance: 41 approved artifacts". `npm run game:artifacts:validate -- --all` → all 41 pass. `node app/scripts/generate-artifact-contact-sheet.js --validate-only` → "contact sheet validation OK". |
| AC3 — season npm aliases present | PASS | `npm run game:season:next --limit=2` prints prompts for 2 missing entries. `npm run game:season:validate -- --all` fails cleanly with "missing PNG" for all 25 entries (expected pre-asset state). |
| AC4 — production paths + workspace gitignored | PASS | `.gitignore` contains the three `.agent/season-image-workspace/{raw,processed,review}/` lines. Output paths declared in [`season-sheet-helpers.js`](../../../app/scripts/season-sheet-helpers.js). |
| AC5 — style guide + todolist | PASS | [`docs/season-image-style-prompt.md`](../../../docs/season-image-style-prompt.md) and [`docs/season-image-todolist.md`](../../../docs/season-image-todolist.md) exist; todolist parser in `next-season-image-prompts.js` reads it. |
| AC6 — runtime fallback works | PASS | `npm run game:build` → bundle builds clean. Components updated in `HomeScreen.js`, `RunCompleteScreen.js`, `ProfileScreen.js`. With no PNGs in `web/public/season-ranks/` or `web/public/achievements/`, the runtime renders the SVG/glyph fallback. |
| AC7 — backend tests still pass | PASS | `npm run game:test` → "tests 371 / pass 371 / fail 0". |

## Verification commands run

```bash
npm run game:test                                                # 371/371
npm run game:build                                               # clean
npm run game:artifacts:provenance:check                          # 41/41
npm run game:artifacts:validate -- --all                         # 41/41
node app/scripts/generate-artifact-contact-sheet.js --validate-only  # OK
node app/scripts/next-season-image-prompts.js --limit=2          # prints 2 prompts
node app/scripts/validate-season-image-coverage.js --all         # 25 expected fails
```

## Files changed (commit `7e4297a`)

```
app/scripts/lib/bitmap-image-toolkit.js                  (new)
app/scripts/season-sheet-helpers.js                      (new)
app/scripts/next-season-image-prompts.js                 (new)
app/scripts/validate-season-image-coverage.js            (new)
app/scripts/generate-season-contact-sheet.js             (new)
app/scripts/generate-season-image-metadata.js            (new)
app/scripts/check-season-image-provenance.js             (new)
app/scripts/artifact-sheet-helpers.js                    (refactored)
app/scripts/check-artifact-image-provenance.js           (refactored)
app/scripts/generate-artifact-contact-sheet.js           (refactored)
app/scripts/generate-artifact-image-metadata.js          (refactored)
app/scripts/validate-artifact-image-coverage.js          (refactored)
docs/season-image-style-prompt.md                        (new)
docs/season-image-todolist.md                            (new)
web/src/components/SeasonRankEmblem.js                   (PNG + SVG fallback)
web/src/components/AchievementBadge.js                   (new)
web/src/pages/HomeScreen.js                              (use AchievementBadge)
web/src/pages/RunCompleteScreen.js                       (use AchievementBadge)
web/src/pages/ProfileScreen.js                           (use AchievementBadge)
web/src/styles.css                                       (badge --medium, img variants)
package.json                                             (5 game:season:* aliases)
.gitignore                                               (season workspace paths)
.agent/tasks/season-image-system/spec.md                 (this task)
```

## Open assumptions

- The chroma-key/raw-to-bitmap conversion helper used for artifacts will work for the 192x192 season canvas without modification. **Will be re-verified when the first season raw is processed**; if it needs domain-specific tuning (e.g. medallion-shaped masking), capture that in a follow-up commit.
- The "Character Achievements" section ordering (`thalla, lomie, axilin, kirt, morga, dalamar`) matches the existing roster ordering in `app/server/game-data.js` and `app/shared/run-achievements.json`. If a new character is added, `season-sheet-helpers.js#characterOrder` must be extended.
