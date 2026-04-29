# Artifact image system improvement

## Source of truth

**Original request (verbatim):**

> "Review the current artifact images, requirements, classification, and prompt. Propose how the image system can improve the game experience. Research Backpack Battles-like game design and related guidance. Write the plan to markdown."

**What "shipped" means here**: the plan in [`docs/artifact-image-system-improvement-plan.md`](../../../docs/artifact-image-system-improvement-plan.md) is implemented in phases. Each phase is a separate implementation unit. This task folder is the durable proof loop — phases drop their evidence here so a future agent can resume from any point.

The plan is the source of truth for scope, ACs, and verification. This file mirrors only the per-phase ACs so a resuming agent can grep for status without re-reading the plan.

## Phase status

- **Phase 1 — Thumbnail QA:** not started.
- **Phase 2 — Richer visual taxonomy:** not started.
- **Phase 3 — Non-color role glyphs in UI:** not started.
- **Phase 4 — Prompt and provenance pipeline:** not started.
- **Phase 5 Stage A — Aggregate role replay feedback:** not started.
- **Phase 5 Stage B — Per-artifact battle-event attribution:** not started (gated on Stage A + new `[Req X-Y]`).
- **Phase 6A — UI-only QoL:** not started.
- **Phase 6B — Mechanic-dependent QoL:** not started (gated on game-requirements update).

When a phase ships, update its bullet to `complete (<short note + commit ref>)` and drop evidence under `<phase>/`.

## Acceptance criteria (mirrored from the plan)

### Phase 1

- **AC1.1:** A reviewer can spot low-readability items without opening individual PNGs.
- **AC1.2:** The sheet includes at least one color-blind/monochrome-friendly check (the grayscale column).
- **AC1.3:** The review sheet is deterministic — two consecutive runs produce byte-identical output.
- **AC1.4:** The phase does not modify production artifact PNGs.

### Phase 2

- **AC2.1:** Every artifact in `app/server/game-data.js` projects to a deterministic `secondaryStat`, `tradeoff`, `owner`, and `footprintType` value, asserted by a per-artifact-id table test.
- **AC2.2:** Classification snapshot tests prove the projection stays stable across no-op refactors.
- **AC2.3:** Existing `role` and `shine` consumers keep working — no behavior change for current `cssClasses` or `prompt` strings.
- **AC2.4:** The projection is the only place that inspects `bonus` — Phase 3 / 4 / 5 consumers never re-parse stats.

### Phase 3

- **AC3.1:** Damage/armor/stun/bag remain distinguishable in grayscale screenshots.
- **AC3.2:** Shop cards expose role through a non-color cue and an `aria-label` (or visible role text), verified by Playwright.
- **AC3.3:** No layout shift in narrow mobile shop cards.
- **AC3.4:** Role glyph rendering is UI-driven; no PNG changes.

### Phase 4

- **AC4.1:** Provenance entry per approved PNG resolves to prompt, classification, validator output, reviewer decision.
- **AC4.2:** Prompt drift is reviewable in git via the provenance file diff.
- **AC4.3:** `npm run game:artifacts:provenance:check` recomputes PNG `sha256` for every approved entry and fails on mismatch.
- **AC4.4:** Provenance distinguishes `approved` / `candidate` / `rejected`; only `approved` drives shop/grid rendering.

### Phase 5

- **AC5.1:** Replay visually answers "what part of my build helped?" via Stage A's aggregate role feedback (Stage B optional).
- **AC5.2:** Reduced-motion mode still conveys the same info through static states.
- **AC5.3:** Artifact effects do not obscure HP/combat readability.
- **AC5.4:** Stage B (if shipped) lands a new `[Req X-Y]` in `docs/game-requirements.md` in the same commit, plus a `[Req X-Y]`-tagged test proving a pre-Stage-B battle row replays correctly without the new field.

### Phase 6

- **AC6.1:** Placement feels more like a tactile backpack puzzle.
- **AC6.2:** QoL helpers do not bypass server validation.
- **AC6.3:** Existing click-first test paths remain supported.
- **AC6.4:** Any new placement affordance has both functional tests and visual/layout assertions.
- **AC6.5:** No 6B candidate ships without a matching `[Req X-Y]` in `docs/game-requirements.md` in the same change.

## Constraints (frozen)

- DOM/CSS-grid inventory only — no canvas/WebGL.
- No combat/economy/balance changes.
- Production PNGs are not regenerated, replaced, or deleted unless the active task explicitly owns bitmap regeneration.
- Render role glyphs in UI first; do not bake into PNGs until UI approach is approved.
- New battle-event fields require a new `[Req X-Y]` in `docs/game-requirements.md` in the same commit (per the [Requirement Traceability Rules](../../../AGENTS.md)).

## Non-goals

- No canvas/WebGL inventory board.
- No broad combat rebalance.
- No full trait/faction synergy system.
- No replacement of the current PNG footprint workflow.
- No reliance on generated collages as final evidence; deterministic repo scripts only.

## Evidence layout

Per phase, drop evidence under `<phase>/`:

- `evidence.md` — narrative summary keyed by AC ID.
- `evidence.json` — per-AC `PASS` / `FAIL` / `UNKNOWN`.
- `raw/` — command output, screenshots, timestamp captures, the regenerated review sheet PNG.
- `problems.md` if any AC is not `PASS` after fresh verification.

## Resume checklist (for a future agent)

1. Read this `spec.md` and find the highest phase whose status is `not started` or partially complete.
2. Read the corresponding phase block in [`docs/artifact-image-system-improvement-plan.md`](../../../docs/artifact-image-system-improvement-plan.md).
3. Verify nothing in the phase has already shipped: `git log --oneline -- <likely-files>` and direct `Read`/`grep` of the listed files. Treat ACs as hypotheses until verified.
4. Implement, leave evidence, update the phase status above.
