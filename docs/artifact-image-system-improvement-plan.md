# Artifact Image System Improvement Plan

**Status:** Draft plan.
**Created:** 2026-04-29.
**Scope:** Improve artifact images, classification, prompts, validation, and in-game presentation so the backpack/autobattler loop feels clearer and more rewarding.

## Source Of Truth

Original request:

- Review the current artifact images, requirements, classification, and prompt.
- Propose how the image system can improve the game experience.
- Research Backpack Battles-like game design and related guidance.
- Write the plan to markdown.

Authoritative local inputs:

- [Game requirements](game-requirements.md)
- [Artifact bitmap todo list](artifact-bitmap-todolist.md)
- [Artifact image style prompt](artifact-image-style-prompt.md)
- [Artifact visual classification](artifact-visual-classification.md)
- [Artifact art direction](artifact-art-direction.md)
- [Backpack-style UX rework plan](backpack-battles-ux-rework-plan.md)

Success conditions:

- Artifact images are readable at real Telegram/mobile sizes.
- Players can understand artifact role, quality, footprint, and tradeoffs before reading details.
- Shop, backpack, replay, and review surfaces reinforce the same visual language.
- Future bitmap regeneration is repeatable, reviewable, and traceable.
- Improvements preserve the current DOM/CSS-grid inventory direction and do not require canvas inventory rendering.

## Agent Implementation Contract

Implement this plan in small, reviewable slices. A future agent should treat each phase as a separate implementation unit unless the active user request explicitly combines phases.

Guardrails:

- Do not regenerate, replace, or delete production PNGs in Phases 1-3 unless the active user request explicitly owns artifact bitmap regeneration.
- Do not change combat balance, economy, artifact stats, or shop eligibility from this plan. If a later phase needs new battle-event semantics, update [game requirements](game-requirements.md) in the same change and call out the contract change.
- Render role glyphs in UI first. Do not bake new role glyphs into PNGs until the UI approach has been tested and approved.
- Keep the current DOM/CSS Grid inventory model. Do not move shop, backpack, or inventory rendering to canvas or WebGL.
- Preserve existing untracked artifact image work unless the task explicitly says to modify or clean it.
- Prefer deterministic scripts and committed metadata over ad hoc `.agent` contact sheets for sign-off evidence.
- Keep image-generation provenance separate from temporary generation scratch files.

Implementation rules:

- One phase per PR or commit is preferred.
- If a phase touches UI, generate fresh screenshots and include executable visual/layout assertions.
- If a phase touches classification, add or update unit tests before changing prompt consumers.
- If a phase touches prompts or provenance, do not regenerate image assets as a hidden side effect.
- If a phase touches replay feedback, verify reduced-motion behavior and keep HP/combat readability primary.

## Current Snapshot

As of this review, the local artifact set contains a complete `web/public/artifacts/*.png` set plus the official contact sheet.

Validation run:

```bash
npm run game:artifacts:sheet
npm run game:artifacts:validate -- --all
npm run game:artifacts:next
npx playwright test tests/game/artifact-bitmap-screenshots.spec.js --config=tests/game/playwright.config.js --reporter=line
```

Observed result:

- The deterministic contact sheet regenerated at `web/public/artifacts/contact-sheet.png`.
- All current artifact PNGs passed coverage and mask validation.
- `game:artifacts:next` reported that all production PNGs exist.
- The focused Playwright bitmap test passed for shop and placed-grid rendering.

Important caveat:

- The coverage validator checks alpha coverage, bounding-box fill, PNG divisibility, and irregular-bag mask transparency. It does not prove that a player can recognize the item at `32px`, understand its role without color, or connect the visual to a combat outcome.

## Research Notes

Backpack Battles positions the whole game loop around buying shaped items, arranging them in the backpack, and becoming stronger through smarter placement. It also emphasizes item shape, price, rarity, and combining as fast build-reading signals. Source: [Backpack Battles on Steam](https://store.steampowered.com/app/2427700/_Backpack_Battles/).

Backpack Hero makes the same core point from a roguelike angle: the inventory is not just storage; placement, rotation, and neighboring items change item value. Source: [Backpack Hero on Steam](https://store.steampowered.com/app/1970580), [Destructoid review](https://www.destructoid.com/reviews/review-backpack-hero/).

Community feedback for Backpack Battles repeatedly points to clarity and quality-of-life issues that matter here too: clearer activator symbols, less awkward rearrangement, stronger planning signals, and better handling of space items. Source: [Backpack Battles design comments](https://www.reddit.com/r/BackpackBattles/comments/17mi5oe/some_design_comments/).

Accessibility guidance is directly relevant because the current artifact system leans on role color. W3C guidance says color should not be the only way information is conveyed; pair color with shape, text, iconography, or another visual cue. Source: [W3C Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color).

Design implication:

- For this game, artifact art should teach the build at a glance: class, footprint, cost/quality, tradeoff, and whether the item is active in the current battle story.

## Diagnosis

### What Works

- The current image direction is correctly small-icon-first: chunky silhouettes, thick outlines, low texture, and strict footprint shape.
- `role + shine` classification is a good foundation because it separates combat role from item specialness.
- The UI already applies role/shine CSS classes to shop cards and artifact figures.
- The official contact sheet groups by gameplay section and shows visual metadata.
- The rendering model is correct for Backpack Battles-style pieces: one continuous bitmap over the full footprint.

### What Needs Improvement

- **Role is still too color-dependent.** A dot, border, and hue are not enough when items are small, color-blind users are considered, or screenshots are compressed.
- **Secondary stats are visually invisible.** Speed-only, hybrid, and negative-tradeoff items can read as the wrong family. Example: `haste_wisp` is damage-classed but speed-only; `morga_flash_seed` is stun-classed but reads like a hot damage projectile.
- **The validator is geometric, not perceptual.** It accepts low-recognition edge cases as long as alpha coverage passes.
- **Prompts are not provenance.** The prompt generator emits useful text, but approved images do not currently carry a durable source prompt, classification snapshot, checksum, and review note.
- **Replay payoff is underconnected.** The prep images are attractive, but battle presentation does not yet strongly show which artifact class or item caused a meaningful outcome.
- **Shop comprehension can improve.** Backpack-like games thrive when players quickly compare shape, class, cost, quality, and tradeoff without opening a detail panel.

## Design Principles

1. **Shape Before Detail**
   The outer silhouette must remain recognizable in grayscale at `32px`, `48px`, and `64px`.

2. **Color Plus Glyph**
   Role color must be paired with a stable non-color cue:
   - Damage: fang/blade notch
   - Armor: shield/plate mark
   - Stun: spark/spore crack
   - Bag: pouch/slot mark

3. **One Artifact, One Footprint**
   Multi-cell items must remain one object, not repeated icons, and every occupied cell must contain meaningful object mass.

4. **Gameplay Truth Over Lore Flavor**
   The visual family should match what the item does. Lore motifs are secondary to role readability on the shop and grid.

5. **Prep Sets Up Replay**
   If a player buys a stun item, the later stun moment should visually echo that same item language.

6. **Generated Art Must Be Auditable**
   Every approved bitmap should be traceable to a prompt, artifact metadata, validation output, and review decision.

## Proposed Work

### Phase 1: Thumbnail QA And Review Evidence

Goal: make visual review match real play conditions.

Changes:

- Add a deterministic thumbnail review sheet that renders every artifact:
  - on transparent background
  - on actual cream grid cells
  - at `32px`, `48px`, and `64px`
  - in grayscale
  - with role/shine labels and warning markers
- Keep the current large contact sheet for set review, but do not use it as the only sign-off surface.
- Extend artifact review notes to call out “passes validator but weak at mobile size” cases.

Likely files:

- `app/scripts/generate-artifact-contact-sheet.js`
- New script such as `app/scripts/generate-artifact-thumbnail-review.js`
- `docs/artifact-bitmap-todolist.md`

Phase acceptance criteria:

- **AC1.1:** A reviewer can spot low-readability items without opening individual PNGs.
- **AC1.2:** The sheet includes at least one color-blind/monochrome-friendly check.
- **AC1.3:** The review sheet is deterministic and can be regenerated with one npm script.
- **AC1.4:** The phase does not modify production artifact PNGs unless the active task explicitly says to regenerate them.

Phase verification:

```bash
npm run game:artifacts:validate -- --all
npm run game:artifacts:sheet
npm run game:artifacts:thumbnail-review
```

During Phase 1, add this package script or update this plan and `package.json` with the real command in the same change.

### Phase 2: Richer Artifact Visual Taxonomy

Goal: make classification describe what players actually need to know.

Current model:

```text
role + shine
```

Recommended model:

```text
role + shine + secondaryStat + tradeoff + owner + footprintType
```

New fields should be mostly derived from existing artifact data:

- `role`: damage, armor, stun, bag
- `shine`: plain, bright, radiant, signature
- `secondaryStat`: speed, mixed, none
- `tradeoff`: negativeDamage, negativeArmor, negativeSpeed, none
- `owner`: mushroom id for character items and starter items when known
- `footprintType`: single, wide, tall, block, mask

Use this metadata in:

- prompts
- contact sheets
- shop cards
- artifact tooltips/details
- replay highlights

Likely files:

- `app/shared/artifact-visual-classification.js`
- `docs/artifact-visual-classification.md`
- tests for classification output

Phase acceptance criteria:

- **AC2.1:** `haste_wisp`, hybrid items, character items, and tradeoff items receive explicit metadata.
- **AC2.2:** Classification tests prove the metadata stays stable.
- **AC2.3:** Existing `role` and `shine` consumers keep working.
- **AC2.4:** Prompt and UI consumers can read new metadata without duplicating artifact-stat parsing logic.

Phase verification:

```bash
node --test tests/game/artifact-visual-classification.test.js
node --test tests/web/artifact-render.test.js
```

### Phase 3: Non-Color Role Glyphs In UI

Goal: make artifact role readable even without hue.

Changes:

- Add a compact role glyph next to or inside the existing role dot on shop cards.
- Add the same glyph as an optional corner badge on artifact figure cells or shop visuals.
- Keep text labels where space allows, but do not rely on text alone in dense board surfaces.
- Ensure glyphs are semantic in `aria-label` / title text where appropriate.

Likely files:

- `web/src/components/prep/ShopZone.js`
- `web/src/components/ArtifactFigure.js`
- `web/src/artifacts/render.js`
- `web/src/styles.css`

Phase acceptance criteria:

- **AC3.1:** Damage/armor/stun/bag remain distinguishable in grayscale screenshots.
- **AC3.2:** Shop cards expose role through both visible non-color cue and accessible text.
- **AC3.3:** No layout shift occurs in narrow mobile shop cards.
- **AC3.4:** Role glyph rendering is UI-driven and does not require changing artifact PNGs.

Phase verification:

```bash
node --test tests/web/artifact-render.test.js
npm run game:test:screens
```

Add or update Playwright assertions for at least one shop card from each role if the existing screenshot suite does not cover that state.

### Phase 4: Prompt And Provenance Pipeline

Goal: make image regeneration repeatable instead of artisanal.

Changes:

- Generate and save a per-artifact prompt/provenance record:
  - artifact id
  - artifact metadata snapshot
  - visual classification snapshot
  - generated prompt
  - output path
  - checksum
  - validation output
  - reviewer note
  - approval status
- Split prompt guidance into reusable blocks:
  - global style
  - role palette
  - footprint rule
  - secondary stat/tradeoff cue
  - per-artifact description
- Add explicit thumbnail instruction to prompts:
  - “must read at 32px”
  - “role is recognizable without color”
  - “secondary stat uses one small accent, not extra particles”

Likely files:

- `app/scripts/next-artifact-image-prompts.js`
- `docs/artifact-image-style-prompt.md`
- New metadata file such as `app/shared/artifact-image-metadata.json` or `docs/artifact-image-manifest.json`

Phase acceptance criteria:

- **AC4.1:** Future regeneration can answer “why does this image look this way?”
- **AC4.2:** Prompt drift can be reviewed in git.
- **AC4.3:** Generated images can be revalidated and compared against the prompt that produced them.
- **AC4.4:** Provenance records distinguish approved production images from temporary generated candidates.

Phase verification:

```bash
npm run game:artifacts:next
npm run game:artifacts:validate -- --all
node --test tests/game/artifact-visual-classification.test.js
```

If a new manifest validator is added, include it in `package.json` and replace the ad hoc command list with that script.

### Phase 5: Gameplay Feedback Integration

Goal: let players feel that their artifact choices mattered.

Changes:

- Add replay highlights for artifact-derived outcomes:
  - damage pulse for damage contribution
  - shield flash for armor mitigation
  - spark/spore crackle for stun roll or stun success
  - bag glow only when space/placement is being edited, not during combat
- Reuse the same role color and glyph language from shop and backpack.
- Start with aggregate role feedback if battle logs do not yet identify individual artifact triggers.
- Later, include artifact IDs in battle events when a specific artifact contributes meaningfully.

Likely files:

- battle event shaping in server services
- replay components and styles
- `docs/game-requirements.md` if new battle-event semantics become contractual

Phase acceptance criteria:

- **AC5.1:** Replay visually answers “what part of my build helped?”
- **AC5.2:** Reduced-motion mode still conveys the same information through static states.
- **AC5.3:** Artifact effects do not become noisy or obscure HP/combat readability.
- **AC5.4:** New battle-event fields, if any, are documented in [game requirements](game-requirements.md) and covered by tests.

Phase verification:

```bash
npm run game:test
npm run game:test:screens
```

Add replay-specific screenshot or E2E assertions when replay UI changes. If only aggregate role feedback is implemented, prove the UI does not require per-artifact event IDs.

### Phase 6: Backpack-Like Planning Quality Of Life

Goal: improve the experience around item images and placement, without changing core combat rules.

Backlog candidates:

- Restore-last-position button for items returned to the backpack/container.
- Ghost footprint preview before placing a selected item.
- Valid/invalid cell highlighting that uses role-aware outline plus pattern.
- Shop reroll preview only if balance and server determinism allow it.
- Clearer bag-space item treatment: bags should always read as space expansion, not ordinary loot.
- Later: adjacency or bag-affinity hints if those mechanics become first-class.

Phase acceptance criteria:

- **AC6.1:** Placement feels more like solving a tactile backpack puzzle and less like dragging small web cards.
- **AC6.2:** Quality-of-life helpers do not bypass server validation.
- **AC6.3:** Existing click-first test paths remain supported.
- **AC6.4:** Any new placement affordance has both functional tests and visual/layout assertions.

Phase verification:

```bash
npm run game:test
npm run game:test:screens
```

## Suggested Priority

1. **Do first:** thumbnail QA sheet and non-color role glyphs.
2. **Do next:** richer classification metadata and prompt/provenance records.
3. **Then:** replay feedback that reuses the same role language.
4. **Backlog:** deeper Backpack Battles-like planning features such as restore position, reroll preview, and adjacency hints.

This order keeps risk low: first improve review and comprehension, then improve generation repeatability, then make battle payoff richer.

## Agent Implementation Order

Recommended execution sequence:

1. **Phase 1 first:** add deterministic thumbnail QA without changing production PNGs.
2. **Phase 2 second:** extend metadata and tests while keeping existing `role` and `shine` API compatibility.
3. **Phase 3 third:** render non-color role glyphs in shop/grid UI using the Phase 2 metadata.
4. **Phase 4 fourth:** add prompt/provenance records after metadata is stable.
5. **Phase 5 fifth:** add replay feedback after UI role language is stable.
6. **Phase 6 last:** treat planning quality-of-life work as backlog unless explicitly requested.

Do not parallel-edit these areas in one agent pass:

- production PNG files and classification metadata
- replay battle-event contracts and UI-only role glyphs
- prompt/provenance scripts and bitmap regeneration
- bag-placement behavior and image review tooling

If a future task starts in the middle of the plan, the agent should first verify whether earlier phase contracts already exist. Do not reimplement a completed phase just because this plan lists it.

## Verification Plan

Minimum verification by change type:

- **Docs only:** read back the changed doc and confirm links/commands are plausible.
- **Artifact PNG changes:** `npm run game:artifacts:validate -- --all`, `npm run game:artifacts:sheet`, and a focused screenshot or review sheet inspection.
- **Classification changes:** `node --test tests/game/artifact-visual-classification.test.js` and any affected prompt/render tests.
- **Prompt/provenance changes:** `npm run game:artifacts:next` plus a manifest/provenance validator if added.
- **Shop/grid UI changes:** `node --test tests/web/artifact-render.test.js` and `npm run game:test:screens`.
- **Replay changes:** `npm run game:test` and `npm run game:test:screens`, with fresh replay screenshots.

Add or update Playwright coverage when UI surfaces change:

- mobile shop card with at least one artifact from each role
- placed grid item with role glyph visible
- grayscale or computed-style assertion proving role is not color-only
- replay screen if artifact feedback is touched

Before handoff, report which phase acceptance criteria were completed, which were deferred, and which commands were run.

## Non-Goals

- No canvas/WebGL inventory board.
- No broad combat rebalance.
- No full trait/faction synergy system in this plan.
- No replacement of the current PNG footprint workflow.
- No reliance on generated collages as final evidence; use deterministic repo scripts.

## Open Questions

- Should role glyphs be baked into PNG art, drawn by UI, or both? Recommendation: UI first, optional subtle art motif second.
- Should speed-only items become a fourth role or remain secondary metadata? Recommendation: keep speed as `secondaryStat` until there are enough speed-first items to justify a new family.
- Should individual artifact IDs be included in battle events? Recommendation: yes eventually, but start with aggregate role feedback to avoid changing combat semantics too early.
- Where should image provenance live long term: public manifest, shared app metadata, or `.agent` task evidence? Recommendation: committed shared metadata for approved production images, `.agent` only for temporary generation evidence.
