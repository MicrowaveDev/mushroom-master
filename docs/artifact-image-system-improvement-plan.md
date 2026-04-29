# Artifact Image System Improvement Plan

**Status:** Draft plan.
**Created:** 2026-04-29.
**Scope:** Improve artifact images, classification, prompts, validation, and in-game presentation so the backpack/autobattler loop feels clearer and more rewarding.

> **Reading guide.** This is a forward-looking improvement plan, not the current system contract. The authoritative current state lives in [artifact-visual-classification.md](artifact-visual-classification.md), [artifact-image-style-prompt.md](artifact-image-style-prompt.md), and [shop-bag-inventory-architecture.md](shop-bag-inventory-architecture.md). When a phase ships, extract its contract into the relevant reference doc rather than leaving it embedded here — per the AGENTS.md "Reading-guide banner / contract extraction" pattern. Per-phase evidence and resume notes belong under `.agent/tasks/artifact-image-system/`.

## Source Of Truth

### Original request

- Review the current artifact images, requirements, classification, and prompt.
- Propose how the image system can improve the game experience.
- Research Backpack Battles-like game design and related guidance.
- Write the plan to markdown.

### User requirements (frozen)

- Improvements must preserve the current DOM/CSS-grid inventory direction; **no** canvas/WebGL inventory.
- Improvements must not change combat balance, economy, artifact stats, or shop eligibility.
- Production PNGs must not be regenerated, replaced, or deleted as a side effect of phases that don't explicitly own bitmap regeneration.

### Agent assumptions (subject to user correction)

- Visual quality at `32px / 48px / 64px` is the right thumbnail-size budget for Telegram/mobile.
- Role color must be paired with a non-color cue per W3C [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color); the cue is rendered in UI first, optionally baked into art later.
- The four-role taxonomy stays at `damage / armor / stun / bag` (no fifth "speed" family) until there are enough speed-first items to justify it; speed-first items are tracked via Phase 2's `secondaryStat` instead.

### Implementation choices left to phases

- Concrete glyph shapes per role (Phase 3).
- Replay-effect concrete style (canvas overlay vs DOM/SVG, Phase 5).

### Open ambiguity affecting execution

- **Should role glyphs be baked into PNG art, drawn by UI, or both?** Recommendation: UI first (Phase 3); revisit baked motifs only after the UI approach has shipped and held up.
- **Should individual artifact IDs land in battle events?** Recommendation: aggregate role feedback first (Phase 5 early); per-artifact IDs are a contract change that requires a new `[Req X-Y]` in [game-requirements.md](game-requirements.md) and a backwards-compat path for replays of historical battles. Do not start with per-artifact IDs.
- **Where does image provenance live long term?** Decision pinned in Phase 4 below: `app/shared/artifact-image-metadata.json` (committed, ships in the bundle so the running app can show provenance in dev tools).

### Authoritative local inputs

- [Game requirements](game-requirements.md) — the behavioral contract; any phase that touches battle events updates this.
- [Artifact bitmap todo list](artifact-bitmap-todolist.md)
- [Artifact image style prompt](artifact-image-style-prompt.md)
- [Artifact visual classification](artifact-visual-classification.md)
- [Artifact art direction](artifact-art-direction.md)
- [Backpack-style UX rework plan](backpack-battles-ux-rework-plan.md)
- [Shop / bag / inventory runtime architecture](shop-bag-inventory-architecture.md) — load-bearing for any change to shop cards, prep grid rendering, or placement affordances (Phases 1, 3, 6).

### Success conditions

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
   Every approved bitmap must be traceable to a prompt, artifact metadata snapshot, classification snapshot, validation output, review decision, and a PNG `sha256` checksum (see Phase 4 for the provenance contract).

## Proposed Work

### Phase 1: Thumbnail QA And Review Evidence

Goal: make visual review match real play conditions.

Changes:

- Add a deterministic thumbnail review sheet that renders every artifact:
  - on transparent background
  - on actual cream grid cells (the same `--cell` background the prep grid uses; sample from `web/src/styles.css`)
  - at `32px`, `48px`, and `64px`
  - in grayscale
  - with role/shine labels and warning markers
- Keep the current large contact sheet for set review, but do not use it as the only sign-off surface.
- Extend artifact review notes to call out "passes validator but weak at mobile size" cases.

Deliverable contract (pin before implementation so two agents don't pick differently):

- **Output format:** single PNG composite at `web/public/artifacts/thumbnail-review.png`. PNG, not HTML or SVG, for the same reason `contact-sheet.png` is a PNG: deterministic, diff-friendly, embed-friendly in PRs and `.agent` evidence.
- **Commit policy:** committed (same as `contact-sheet.png`), so reviewers can inspect the file at HEAD without running a script. Regeneration is a tracked action, not a per-review side effect.
- **Sheet layout:** four columns × N rows per artifact section. Columns = the four conditions (transparent, cream cell, grayscale, label strip). Each row band shows the same artifact at the three sizes side-by-side. Cell-size budget: each `64px` thumbnail must remain inspectable at typical PR-diff zoom (≥ 4× pixel doubling for the smallest size).
- **Reuse vs new:** new script `app/scripts/generate-artifact-thumbnail-review.js`. Share section ordering and metadata loading with `generate-artifact-contact-sheet.js` via a small extracted helper; do not duplicate the section list.
- **npm script:** `npm run game:artifacts:thumbnail-review` (added in this phase; the verification block below already lists it). Update `package.json` in the same change.

Likely files:

- `app/scripts/generate-artifact-contact-sheet.js` (extract shared helpers; no behavior change)
- New script `app/scripts/generate-artifact-thumbnail-review.js`
- `package.json` (new npm script)
- `docs/artifact-bitmap-todolist.md`

Phase acceptance criteria:

- **AC1.1:** A reviewer can spot low-readability items without opening individual PNGs.
- **AC1.2:** The sheet includes at least one color-blind/monochrome-friendly check (the grayscale column).
- **AC1.3:** The review sheet is deterministic and can be regenerated with one npm script. Two consecutive runs produce byte-identical output.
- **AC1.4:** The phase does not modify production artifact PNGs unless the active task explicitly says to regenerate them.

Phase verification:

```bash
npm run game:artifacts:validate -- --all
npm run game:artifacts:sheet
npm run game:artifacts:thumbnail-review     # NEW in this phase
md5 web/public/artifacts/thumbnail-review.png && \
  npm run game:artifacts:thumbnail-review && \
  md5 web/public/artifacts/thumbnail-review.png   # determinism check
```

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

**Derivation contract (chosen direction): every new field is *derived* deterministically from existing artifact data — no parallel authored metadata file.** Tests pin the projection rules, not authored values per artifact. Rationale: avoids duplicate sources of truth (the `bonus`, `family`, `width`/`height`, `shape`, `characterItem` fields already encode what we need); changing an artifact's stats automatically updates its classification; keeps Phase 4's provenance file focused on prompts, not on re-encoding game data.

Field projection rules:

- `role`: from `artifact.family` — `damage / armor / stun / bag`. Unchanged from today.
- `shine`: from existing `artifactShineTier()` projection in [`app/shared/artifact-visual-classification.js`](../app/shared/artifact-visual-classification.js). Unchanged from today.
- `secondaryStat`: derived from `bonus`. Possible values cover the real shapes in the catalog: `none`, `speed`, `armor`, `damage`, `stun`, `mixed` (more than one non-primary stat). Determined by inspecting which `bonus.*` keys are present besides the role's primary stat. Phase 2 must enumerate the projection rule for every artifact in [`game-data.js`](../app/server/game-data.js) and back it with a unit test that asserts the expected value per artifact id.
- `tradeoff`: derived from `bonus`. Values: `negativeDamage / negativeArmor / negativeSpeed / none`. A tradeoff is any negative value in `bonus`. (No artifact currently carries one — the field is reserved for future items and tested as `none` for every existing entry.)
- `owner`: **projected from** `artifact.characterItem.mushroomId` when present, else `null`. Not a new field — a derived view of the existing `characterItem` shape, so character ownership has a single source of truth.
- `footprintType`: derived from `artifact.width`, `artifact.height`, and (for bags) `artifact.shape`. Values: `single` (1×1), `wide` (`width > height`, no shape mask), `tall` (`height > width`, no shape mask), `block` (`width === height` and >1, no shape mask), `mask` (bag with non-rectangular `shape` array, e.g. T/L/J/S/Z/I tetrominoes). **Bag-only for `mask`.** **Tracks the canonical orientation**, not the player's current rotation — rotation is presentation, not identity, so consumers (Phase 5 replay highlights) can use the canonical type and apply orientation styling separately.

Use this metadata in:

- prompts (Phase 4)
- contact sheets and the thumbnail review (Phases 1, 4)
- shop cards (Phase 3)
- artifact tooltips/details (Phase 3 onward)
- replay highlights (Phase 5)

Likely files:

- `app/shared/artifact-visual-classification.js`
- `docs/artifact-visual-classification.md`
- tests for classification output

Phase acceptance criteria:

- **AC2.1:** Every artifact in [`game-data.js`](../app/server/game-data.js) projects to a deterministic `secondaryStat`, `tradeoff`, `owner`, and `footprintType` value, asserted by a per-artifact-id table test.
- **AC2.2:** Classification tests prove the projection stays stable across a no-op refactor (snapshot test of the projected output for the full catalog).
- **AC2.3:** Existing `role` and `shine` consumers keep working — no behavior change for the current `cssClasses` or `prompt` strings.
- **AC2.4:** Prompt and UI consumers (Phases 3 / 4 / 5) can read new metadata without duplicating `bonus`-parsing logic; the projection is the only place that inspects `bonus`.

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
- Every glyph element must carry an `aria-label` containing the role name (`damage` / `armor` / `stun` / `bag`), or wrap visible text with the same role name. Verified by AC3.2's executable assertion below.

Likely files:

- `web/src/components/prep/ShopZone.js`
- `web/src/components/ArtifactFigure.js`
- `web/src/artifacts/render.js`
- `web/src/styles.css`

Phase acceptance criteria:

- **AC3.1:** Damage/armor/stun/bag remain distinguishable in grayscale screenshots (a desaturated screenshot of the shop must still let a reader name the role of each card).
- **AC3.2:** Shop cards expose role through both a visible non-color cue *and* accessible text. Verified by an executable Playwright assertion: the role glyph element carries an `aria-label` (or wraps text with the role name) for each role; e.g. `await expect(card.getByLabel(/damage|armor|stun|bag/i)).toBeVisible()`.
- **AC3.3:** No layout shift occurs in narrow mobile shop cards (regenerated dual-viewport screenshots match the prior layout outside of the new glyph region).
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

- Generate and save a per-artifact prompt/provenance record (one entry per approved production image, keyed by artifact id):
  - artifact id
  - artifact metadata snapshot
  - visual classification snapshot (the Phase 2 projection)
  - generated prompt (full string used)
  - output path
  - **checksum: `sha256` of the PNG file's raw bytes** (not of prompt + metadata; see rationale below)
  - validation output (coverage validator status, mask check)
  - reviewer note
  - approval status (`approved` / `candidate` / `rejected`)
- Split prompt guidance into reusable blocks:
  - global style
  - role palette
  - footprint rule
  - secondary stat/tradeoff cue
  - per-artifact description
- Add explicit thumbnail instruction to prompts:
  - "must read at 32px"
  - "role is recognizable without color"
  - "secondary stat uses one small accent, not extra particles"
- **Characters out of scope for artifact prompts.** Artifacts are objects, not portraits. Even for character items (e.g. `kirt_venom_fang`, `morga_flash_seed`), the prompt template must instruct the generator to render the *object* and explicitly forbid rendering the character likeness. This sidesteps the [visible-ears rule](../AGENTS.md) and the design-requirements canon contract — neither applies when the image is purely an object. Add a one-line "no character likenesses; render the object only" directive to the per-artifact block.
- **Wrap, don't replace, the existing bitmap pipeline.** [`app/scripts/generate-artifact-bitmaps.js`](../app/scripts/generate-artifact-bitmaps.js) is the regeneration entry point today. Phase 4 wraps it: prompts and provenance records are produced alongside (or feed into) the existing script — do not write a parallel generation pipeline.

**Provenance file location (pinned).** `app/shared/artifact-image-metadata.json` — committed, ships in the bundle so the running app can surface provenance in dev-only tooling. Rationale over the doc-only alternative: a single shared file keeps the Phase 2 classification snapshot, the prompt, and the runtime artifact registry colocated, and means a future "show prompt for this artifact" dev affordance has data already loaded.

**Why `sha256` of PNG bytes (not prompt + metadata).** A prompt-hash answers "did the prompt change?", which the prompt string itself already answers via git diff. A PNG-byte hash answers "did the image actually change?" — that's the more useful drift signal because LLM image regenerations can be near-identical visually but produce different bytes; conversely, a bit-stable PNG with a tweaked prompt is fine. Pin the bytes; let the prompt diff stand alone.

Likely files:

- `app/scripts/next-artifact-image-prompts.js` (extend; this is the existing prompt entry point)
- `app/scripts/generate-artifact-bitmaps.js` (wrap with provenance write, no behavior change)
- `docs/artifact-image-style-prompt.md`
- `app/shared/artifact-image-metadata.json` (new)

Phase acceptance criteria:

- **AC4.1:** Future regeneration can answer "why does this image look this way?" — the provenance entry for any approved PNG resolves to its prompt, classification, validator output, and reviewer decision.
- **AC4.2:** Prompt drift can be reviewed in git via the provenance file diff.
- **AC4.3:** Generated images can be revalidated and compared against the prompt that produced them. A `npm run game:artifacts:provenance:check` script (added in this phase) recomputes the PNG `sha256` for every approved entry and fails when a checksum mismatches the on-disk file.
- **AC4.4:** Provenance records distinguish approved production images (`status: 'approved'`) from temporary generated candidates (`status: 'candidate'`); only `approved` entries are eligible to drive shop/grid rendering.

Phase verification:

```bash
npm run game:artifacts:next
npm run game:artifacts:validate -- --all
npm run game:artifacts:provenance:check     # NEW in this phase
node --test tests/game/artifact-visual-classification.test.js
```

### Phase 5: Gameplay Feedback Integration

Goal: let players feel that their artifact choices mattered.

This phase has **two stages**: Stage A is UI-only and ships first; Stage B is a contract change and only ships after Stage A is stable and a new requirement ID is added.

#### Stage A: Aggregate role feedback (UI-only, no schema change)

Changes:

- Add replay highlights derived from existing battle event fields (role, side, hp delta, stun applied):
  - damage pulse for damage contribution
  - shield flash for armor mitigation
  - spark/spore crackle for stun roll or stun success
  - bag glow only when space/placement is being edited, not during combat
- Reuse the same role color and glyph language from shop and backpack.
- No new battle-event fields; no server change.

#### Stage B: Per-artifact attribution (contract change, gated)

Changes (only after Stage A holds up in play):

- Include artifact IDs in battle events when a specific artifact contributes meaningfully.
- **New requirement** in [game-requirements.md](game-requirements.md) — assign a section-letter ID per the [Requirement Traceability Rules](../AGENTS.md). Example wording: *"`[Req X-Y]` battle events SHOULD carry the contributing artifact id when one exists; the replay client MUST render correctly when the field is absent."* The exact ID is chosen during Stage B planning (currently the next available letter in the relevant section).
- **Backwards-compatibility (mandatory).** Historical battles in the `battles` table do not carry the new field. The replay client must:
  - degrade to Stage A's aggregate role highlights when the artifact id field is absent
  - never throw or render an empty highlight when the field is missing
  - be covered by an explicit test that loads a pre-Stage-B battle row and renders a clean replay

Likely files (Stage A):

- replay components and styles
- replay screenshot/E2E coverage that asserts each role's highlight effect

Likely files (Stage B, additional):

- battle event shaping in `app/server/services/` (resolver + replay event payload)
- `docs/game-requirements.md` (same commit as the schema change)
- replay client tests asserting graceful absence of the new field on historical battle rows

Phase acceptance criteria:

- **AC5.1:** Replay visually answers "what part of my build helped?" — at minimum via Stage A's aggregate role feedback.
- **AC5.2:** Reduced-motion mode still conveys the same information through static states.
- **AC5.3:** Artifact effects do not become noisy or obscure HP/combat readability.
- **AC5.4:** Stage B (if shipped) lands a new `[Req X-Y]` in [game-requirements.md](game-requirements.md) **in the same commit** as the schema change, and a `[Req X-Y]`-tagged test proves a pre-Stage-B battle row replays correctly without the new field.

Phase verification:

```bash
node --test tests/web/artifact-render.test.js   # Stage A
npm run game:test:screens                        # Stage A + B
node --test tests/game/replay-backcompat.test.js # Stage B (new test in this phase)
```

Add replay-specific screenshot or E2E assertions when replay UI changes. If only Stage A ships, the verification block does not need the Stage B line.

### Phase 6: Backpack-Like Planning Quality Of Life

Goal: improve the experience around item images and placement, without changing core combat rules.

#### 6A — UI-only QoL (no game-rules change)

Each candidate here is implementable today against the existing [game-requirements.md](game-requirements.md) contract:

- Restore-last-position button for items returned to the backpack/container.
- Ghost footprint preview before placing a selected item.
- Valid/invalid cell highlighting that uses role-aware outline plus pattern (must reuse the [`footprintInOneContainer`](../web/src/composables/useShop.js) classification — do not invent a parallel classifier; see [shop-bag-inventory-architecture.md](shop-bag-inventory-architecture.md)).
- Clearer bag-space item treatment: bags should always read as space expansion, not ordinary loot.

#### 6B — Mechanic-dependent (requires game-requirements.md update first)

These cannot ship as UI scaffolding without an underlying mechanic. Each one needs a new `[Req X-Y]` in [game-requirements.md](game-requirements.md), reviewer approval, and balance review *before* any UI work begins:

- Shop reroll preview — affects shop determinism and the refresh-cost ladder ([Req 4-G](game-requirements.md)).
- Adjacency or bag-affinity hints — currently no adjacency mechanic exists. UI must not imply effects the engine doesn't compute.

Phase acceptance criteria:

- **AC6.1:** Placement feels more like solving a tactile backpack puzzle and less like dragging small web cards.
- **AC6.2:** Quality-of-life helpers do not bypass server validation.
- **AC6.3:** Existing click-first test paths remain supported.
- **AC6.4:** Any new placement affordance has both functional tests and visual/layout assertions.
- **AC6.5:** No 6B candidate ships without a matching `[Req X-Y]` landing in [game-requirements.md](game-requirements.md) in the same change.

Phase verification:

```bash
node --test tests/web/use-shop.test.js          # 6A: placement composables
node --test tests/web/loadout-projection.test.js # 6A: projection behavior
npm run game:test:screens                        # 6A + 6B: visual proof
```

## Execution Order

This is the single source of truth for phase sequencing. Each phase depends on the previous one's contract being stable; do not parallelize unless the dependency is genuinely absent.

1. **Phase 1 — Thumbnail QA.** Deterministic review sheet. No production PNG changes. Ships standalone.
2. **Phase 2 — Richer visual taxonomy.** Derived metadata projection and tests. Strict API compatibility for existing `role` / `shine` consumers. Ships standalone after Phase 1 (or in parallel with Phase 1; the two don't share files).
3. **Phase 3 — Non-color role glyphs in UI.** **Depends on Phase 2** — consumes the new metadata projection. Do not start before Phase 2 lands.
4. **Phase 4 — Prompt and provenance pipeline.** Depends on Phase 2 (classification snapshot) being stable. Wraps the existing bitmap generation script; does not regenerate images.
5. **Phase 5 Stage A — Aggregate role replay feedback.** UI-only; no schema change. Depends on Phase 3's role-glyph language for visual consistency.
6. **Phase 5 Stage B — Per-artifact battle-event attribution.** Contract change. Gated on Stage A holding up *and* a new `[Req X-Y]` landing in [game-requirements.md](game-requirements.md). May be deferred indefinitely.
7. **Phase 6A — UI-only QoL.** Independent of Phase 5; can ship any time after Phase 3.
8. **Phase 6B — Mechanic-dependent QoL.** Gated on a new `[Req X-Y]` landing in [game-requirements.md](game-requirements.md) per AC6.5. Treat as backlog until then.

Do not parallel-edit these areas in one agent pass:

- production PNG files and classification metadata
- replay battle-event contracts and UI-only role glyphs
- prompt/provenance scripts and bitmap regeneration
- bag-placement behavior and image review tooling

If a future task starts in the middle of the plan, the agent must first verify whether earlier phase contracts already exist (read the listed files; check `package.json` for new scripts; check [`.agent/tasks/artifact-image-system/spec.md`](../.agent/tasks/artifact-image-system/spec.md) for the phase status tracker). Do not reimplement a completed phase just because this plan lists it.

## Verification Plan

Minimum verification by change type:

- **Docs only:** read back the changed doc and confirm links/commands are plausible.
- **Artifact PNG changes:** `npm run game:artifacts:validate -- --all`, `npm run game:artifacts:sheet`, and a focused screenshot or review sheet inspection.
- **Classification changes:** `node --test tests/game/artifact-visual-classification.test.js` and any affected prompt/render tests.
- **Prompt/provenance changes:** `npm run game:artifacts:next` plus `npm run game:artifacts:provenance:check` (added in Phase 4).
- **Shop/grid UI changes:** `node --test tests/web/artifact-render.test.js` and `npm run game:test:screens`.
- **Replay changes:** targeted backend test (`node --test tests/game/replay-backcompat.test.js` once Phase 5 Stage B lands; otherwise the relevant per-feature backend test) plus `npm run game:test:screens`. Avoid the full `npm run game:test` glob unless the change spans server services and replay together.

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

> Resolved questions live in the Source Of Truth block above (see [Open ambiguity affecting execution](#open-ambiguity-affecting-execution)). New questions discovered during implementation should be added here as they arise; once a phase resolves a question, move the answer to the relevant phase body or to [artifact-visual-classification.md](artifact-visual-classification.md) and remove the entry from this list.

- _(none currently — all open ambiguity is captured in the SoT block at the top of this plan.)_
