# Repository Instructions

Use the repo-local design workflow at [`/.agent/workflows/ui-design.md`](/Users/microwavedev/workspace/mushroom-master/.agent/workflows/ui-design.md) for renderer and future UI styling guidance. The workflow-governance rules in this file apply repo-wide. For lore work, the repo-specific lore-routing and lore-review rules in this file take precedence over generic workflow guidance. The UI design file is design-only guidance, not workflow governance.

Use [docs/character-image-prompt-template.md](/Users/microwavedev/workspace/mushroom-master/docs/character-image-prompt-template.md) as the base whenever the task is to produce a character image-generation prompt from repo canon. Read the target character's current canon first, then return one final copy-paste-ready prompt block rather than the raw worksheet.

Use [docs/design-requirements.md](/Users/microwavedev/workspace/mushroom-master/docs/design-requirements.md) as the authoritative canon-facing spec whenever the task touches character design, lore design descriptions, image prompts, portraits, dossier art, or other visual depictions of the Mycelium world and cast. If a visible-character depiction conflicts with that doc, treat it as a canon bug unless the requirement doc is updated in the same change.

## Planning, Delegation, and Validation Rules

### Source of Truth

- The user's original request is the primary specification.
- Treat the user's wording as potentially precise; do not silently simplify, broaden, or reinterpret it.
- If the user specifies sequencing, authorship, ownership, inputs, outputs, or validation steps, treat those as architectural constraints, not optional implementation details.
- For non-trivial or multi-stage work, freeze the source of truth before implementation:
  - original request
  - explicit acceptance criteria
  - explicit constraints
  - non-goals
  - open assumptions
- Keep these categories visibly separate:
  - user requirements
  - agent assumptions
  - implementation choices
- Agent assumptions and implementation choices must never silently override user requirements.

### Planning Rules

- When the user asks for a plan, begin with a short Source of truth section.
- That section must include:
  - the original request
  - a changelog-style list of stated criteria and constraints
  - success conditions
  - any open ambiguity that still affects execution
- Before coding from a plan, review the implementation steps and identify which are independent and safe to execute in parallel.
- Do not parallelize steps that:
  - depend on ordered results
  - touch overlapping files
  - modify shared state
  - rely on the output of an earlier unfinished step
- If reviewing a plan or implementation against a plan, evaluate alignment against the original user request first.
- Explicitly call out:
  - omissions
  - drift
  - unsupported additions
  - assumption creep
  - unresolved ambiguity
- After implementation, update the plan step-by-step with:
  - completed, partial, or blocked
  - what was done
  - which files/modules/repos were touched
- When a plan ships, its per-step "Deferred (now backlog)" bullets become **point-in-time snapshots**, not current state. Post-review hardening that lands *after* the plan ships will silently contradict those bullets, and any agent who greps a step section for `🚫` will be fed stale context and may propose fixes for problems that already shipped. Two defences:
  - **Reading-guide banner at the top.** Add a short "this is a historical ship record; §N is the authoritative current backlog; contracts live in `docs/<reference>.md`" note. One banner is cheaper and more reliable than patching every stale bullet individually.
  - **Contract extraction.** When a plan's production-readiness items ship, pull their contracts into a dedicated reference doc (the pattern used by `docs/infra-hardening.md`) rather than leaving them buried in the plan's step sections. Reference docs describe *what the system does now*; plan docs describe *how we got here*. Do not mix the two.
- Individual "Deferred" bullets that resolved after ship should be marked inline with a ✅ and a one-line status update pointing to the reference doc. Leaving them unmarked is worse than wrong — it's actively misleading.

### Delegated Agent Rules

- Use sub-agents only for clearly bounded work.
- For each delegated agent, define:
  - what it may read
  - what it may write
  - what it must not edit
  - the exact completion condition
- Prefer one responsible agent per stage when the workflow has distinct stages such as:
  - authorship
  - evidence collection
  - review
  - translation
  - validation
  - sign-off
- Do not let one agent opportunistically edit every artifact across stages.
- Keep write scopes disjoint whenever possible.
- If multiple agents are active, make ownership explicit by folder, file set, or artifact type.
- If a stage produces inputs for another stage, validate the first stage before handing it off.
- If an agent returns partial, scaffolded, or instruction-leaking output, the same responsible stage should fix it before handoff.
- **Verify subagent findings against the current file before acting on them.** When a subagent (`Agent` / Explore) reports "file X says Y", "line N contains Z", or "this bullet is stale", a direct `Read` or `Grep` confirms whether the finding still matches reality. Subagent outputs can lag behind recent edits, miscount lines, or hallucinate matches — especially for audits that span many files. The cost of one verification read is far smaller than the cost of a misdirected edit, and several times this session an audit flagged content that had already been fixed minutes earlier. Treat subagent reports as *leads*, not as authoritative snapshots.

### Parallel Work Rules

- Treat multi-agent parallel work as normal, but keep scope narrow and explicit.
- Prefer parallelization only for independent tasks with disjoint write scopes.
- Prefer one aggregated search or one parallel batch over repeated serial probing.
- Before more than two exploratory commands for the same question, stop and collapse the work into:
  - one aggregated search, or
  - one parallel read-only batch
- Do not run broad formatting, repo-wide rewrites, mass refreshes, or metadata churn when another agent may be active in the same area.
- Prefer finishing one folder, one module cluster, or one document cluster at a time instead of mixing unrelated work in a single batch.

### Validation Rules

- Validate after each meaningful stage, not only at the end.
- Do not translate, publish, merge, or sign off from an unvalidated intermediate artifact when a cheap validation step exists.
- Prefer executable validation over advisory wording.
- If validation fails, make the smallest targeted fix and rerun validation.
- Do not rewrite unrelated content when a narrow repair is enough.
- Do not report completion unless:
  - required artifacts exist
  - validation passed
  - the claimed completion state matches the actual files on disk
- **Before implementing or changing any game-play behavior**, read [docs/game-requirements.md](docs/game-requirements.md). It is the authoritative behavioral spec — every rule there is testable, and violating one is a bug. If a change conflicts with a requirement, update the requirement doc in the same commit (with user approval) so the spec and code stay in sync. Do not treat balance.md, plan docs, or inline code comments as the source of truth for game rules — those describe rationale and history, not the current contract.
- **Before implementing or changing any character/lore/image-facing design behavior**, read [docs/design-requirements.md](docs/design-requirements.md). It is the authoritative visual-and-lore design spec for canon-facing depictions of the world and heroines. If a change conflicts with a requirement, update the requirement doc in the same commit (with user approval) so the spec and output stay in sync.
- **Visible ears rule:** when a mushroom heroine's ears are visible in an image, portrait, prompt target, dossier render, or other depiction, they must be **elf ears**.

### Requirement Traceability Rules

- Every requirement in [docs/game-requirements.md](docs/game-requirements.md) is labeled with a section-letter ID (e.g. `1-A`, `4-G`, `8-B`). Use these IDs to trace requirements through tests and UI screens.
- **Test descriptions must reference the requirement IDs they verify** using the `[Req X-Y]` prefix format. Example: `test('[Req 4-G] shop refresh costs 1 coin for first 3 refreshes', ...)`.
- When adding a new test for game behavior, identify which requirement(s) the test checks and include the `[Req ...]` prefix. If no requirement exists for the behavior, either it is infrastructure (no tag needed) or the requirement doc needs updating first.
- When adding or changing a game requirement, check that at least one test covers it by grepping for the requirement ID. Uncovered requirements are gaps — flag them.
- **Screenshot and E2E tests must verify that all UI elements implied by requirements are present on screen.** For any requirement that describes user-visible state (coins, lives, shop items, grid cells, round number, replay controls, ready button), the screenshot or E2E test covering that screen must assert the element exists, is visible, and shows the expected value.
- When reviewing screenshot test coverage, cross-reference the requirement IDs: every requirement that implies a visible UI element should have a corresponding assertion in at least one Playwright spec. Missing coverage is a gap to flag, not silently skip.

### UI Verification Rules

- For any user-visible UI change, functional tests alone are insufficient.
- Every changed UI surface must have:
  - at least one fresh screenshot generated from the current code
  - at least one executable visual or layout assertion
  - proof that key controls remain visible, reachable, and not overlapped
  - proof that intended grid, board, inventory, or container dimensions match the spec
- Saved screenshots without assertions are evidence artifacts, not verification.
- If a layout, composition, or dimension changed, all prior screenshot proof for that screen is stale until regenerated.
- If the user reports that a screen looks broken, inspect the current rendered screen or a freshly generated screenshot before claiming coverage.
- Keep functional proof and visual proof separate in evidence. A passing interaction flow does not imply correct layout.
- **Cross-check screenshots against game requirements and user flows.** When a screen is captured, verify that every requirement-driven element is present: e.g. the prep screen must show shop items (`4-D`), coin HUD (`4-A`), inventory grid cells (`2-A`), and the ready/start button; the replay screen must show battle status and replay log (`13-A`); the round result must show outcome, rewards (`9-A`), and rating changes (`10-A`). If an element implied by a requirement is missing from the screenshot, that is a bug to flag.
- **Before writing or reviewing E2E tests**, read [docs/user-flows.md](docs/user-flows.md). It is the authoritative screen-flow spec — every step lists the screen, visible elements, user actions, and expected assertions. E2E tests must follow these flows and assert the elements listed at each step. If a flow is missing or wrong, update it in the same commit.

### Layout Assertion Rules

- When a UI includes grids, boards, inventories, previews, overlays, or floating controls, verify geometry with executable checks.
- Prefer assertions for:
  - cell counts
  - bounding boxes
  - non-overlap between controls and visual surfaces
  - intended horizontal vs vertical orientation
  - consistent cell size across related surfaces
- For battle-prep, builder, and similar composition-heavy screens, include at least one assertion that the primary call-to-action is outside the visual surface and remains clickable.

### E2E / Integration Test Design Rules

- Write e2e tests as **integration flows that mirror real user journeys**, not as isolated unit-like assertions.
- A single test should cover a full flow: e.g. buy artifact → undo purchase → place in inventory → refresh page to verify persistence → save loadout → start battle → watch replay.
- Only split into a separate test when an interaction **conflicts** with the happy path (e.g. budget exhaustion is a separate test from the main flow because it requires different preconditions).
- **Seed deterministic state via server APIs** (e.g. `POST /api/game-run/start`, `POST /api/game-run/:id/buy`), not via `localStorage` injection. Tests should prove server-side persistence works, not just client-side state. The legacy `PUT /api/shop-state` and `PUT /api/artifact-loadout` endpoints were deleted 2026-04-13 and are no longer available.
- **Always verify state survives a page refresh** when testing features that persist data. Navigate away and back, then re-assert.
- For shop/container/inventory interactions, use **click-based actions** as the primary test path (matching the primary UI interaction). Playwright's `page.dragTo()` is unreliable for HTML5 drag handlers in headless Chromium — see [docs/flaky-tests.md](docs/flaky-tests.md) — so prefer click-based UX or hit the underlying API directly when the behavior under test is server-side state.
- Prefer `@click.stop` assertions (e.g. sell button) over drag-to-shop for undo/refund flows.
- Name tests by the user journey they cover, not by the technical mechanism: "full shop flow: buy, undo, place, persist on refresh, save, battle" — not "drag-and-drop API fires correctly".
- **Dual-viewport screenshots are required for screens whose layout is touched in the current PR.** Mobile: `page.setViewportSize({ width: 375, height: 667 })`. Desktop: `page.setViewportSize({ width: 1280, height: 800 })`. Use the `saveShotDual()` helper in `tests/game/solo-run.spec.js` / `screenshots.spec.js`. Cross-check against the "Above the fold (mobile)" and "Desktop note" blocks in [docs/user-flows.md](docs/user-flows.md) — if a critical action or info element listed there is not visible in the screenshot, it's a layout bug to flag. Pre-existing single-viewport baselines for screens not touched in the current PR may stay until the next time that screen is edited. New baselines must always be dual.
- Use `await page.screenshot({ path: 'screenshots/<flow>-<step>-mobile.png' })` and `screenshots/<flow>-<step>-desktop.png`. These screenshots are evidence artifacts that reviewers and agents can inspect without running the suite.

### Backend Scenario vs Unit Test Rules

These rules govern `tests/game/*.test.js` (Node.js `node:test` runner) — the backend/service-level test suite, distinct from the Playwright e2e rules above.

- Keep both **unit tests** (one invariant per test, direct function calls, fake I/O) and **scenario tests** (one long flow, multi-phase, real DB). They complement each other; do not replace one with the other.
- **Unit tests** are for invariants that are expressible as a single input/output contract: pure functions, validators, middleware, registries, helpers, token buckets, deterministic generators. Write them against fake `req`/`res` objects or direct function calls — do not spin up real I/O for these.
- **Scenario tests** are for emergent bugs that only appear when multiple invariants interact: copy-forward after a sell, concurrency on top of a fresh shop offer, refund ledger consistency across round boundaries, cross-phase state drift. Write them as one long `test()` block with explicit phase comments and checkpoint assertions between phases.
- A new scenario test is warranted when the interaction it covers is not reachable from any single unit test. If the bug you want to catch is expressible as "X invariant holds," write a unit test. If it is expressible as "X invariant holds *after Y happens on top of Z state*," write a scenario phase.
- Scenario tests should have **checkpoint assertions between phases**, not a single assertion at the end. When a scenario test fails, the failure message must point at the specific phase — otherwise debugging cost outweighs the value.
- **Do not delete unit tests** when adding a scenario test that covers the same invariant. The scenario test catches emergent issues; the unit test pinpoints root cause. Losing either makes the other less useful.
- When a scenario test fails, the first response is to read the failing phase, not to rerun the whole suite. If the phase assertion is flaky, fix the flake at the phase — do not add broad retries around the entire scenario.
- Keep **one scenario test per user journey**, not one per invariant. Typical journeys in this repo: full solo run, challenge-mode isolation, legacy single-battle flow, reload/resume. Granular invariants stay as unit tests.
- Scenario tests use real DB via `freshDb()` and real service calls. Middleware, pure functions, and helpers should never reach the DB — keep those at the unit level.
- Name scenario tests by the journey, not the mechanism: `'solo run scenario: start → buy → reload → resolve → sell → ghost → history'` — not `'run-lifecycle integration test'`.
- When adding or moving assertions, ask which side of the split they belong on. If the answer is "both," prefer a unit test for the invariant *and* a scenario phase that exercises the invariant under realistic preconditions.
- A scenario test should complete in under ~5 seconds. If it grows slower than that, split along journey boundaries (e.g. one scenario for rounds 1-3, one for rounds 4-9), not along invariant boundaries.
- **Keep at least one scenario per journey running on production defaults.** Helper overrides like `seedRunLoadout` that delete auto-seeded state and replace it with a deterministic minimal loadout are useful for controlling budget and pinning invariants, but they **bypass the seeding → consumer pipeline entirely**. If every scenario uses the override, a bug in the pipeline between "run starts" and "first consumer reads loadout" (e.g. auto-seeded starter preset interacting with the coin-budget validator in `getActiveSnapshot`) is invisible to the suite. Production defaults must be exercised end-to-end by something. The cost is one extra scenario; the payoff is that seeding regressions no longer ship unnoticed.
- When a new piece of state is **auto-seeded on run start** (starter preset, opening shop offer, initial bag, opening mod, any implicit write), the same PR that introduces it must add or update at least one scenario test that (a) does not override the seeding and (b) drives the run far enough to reach every downstream consumer of the seeded state — buy flow, validator, resolve, snapshot, ghost path. "Assert the row exists" after `startGameRun` is not enough; the bug will live in whichever consumer the assertion doesn't touch.
- When you write a regression test for a specific error message, drive the setup all the way to the **actual failure state**, not a simpler variant. A test that buys 1 item reproduces a different cost total than a test that buys 5 items — and a narrower fix can pass the first while the second still trips. Read the error message carefully, compute the specific numeric state that produced it, and reproduce that exact state in the test setup.

### UI Test Efficiency Rules

- Prefer the repo helper command over ad hoc port debugging for screenshot verification:
  - `npm run game:test:screens`
  - `npm run game:test:screens:debug`
- Those commands are the preferred path because they choose isolated Playwright ports automatically and avoid repeated manual `pgrep`, `lsof`, and `curl` probing.
- If a visual test appears stuck, rerun with `npm run game:test:screens:debug` before doing manual process inspection.
- Keep explicit stage logs inside screenshot-heavy Playwright specs so the current screen or wait point is visible in command output.
- When a screenshot suite stalls, first identify the last printed stage log and fix the specific wait or interaction around that screen instead of adding broad timeouts.

### Character Portrait And Bubble Rules

- When a screen overlays speech bubbles, labels, or callouts onto character portraits, prefer per-character configuration over one global visual offset.
- Keep portrait framing and bubble anchoring in the same config object when they are visually coupled.
- For the autobattler frontend, keep that config in [web/src/replay-portrait-config.js](/Users/microwavedev/workspace/mushroom-master/web/src/replay-portrait-config.js) and treat that file as the source of truth for portrait framing and replay-bubble placement.
- Treat these config fields as part of the UI contract:
  - portrait object-position or equivalent image crop controls
  - bubble top/side offsets
  - bubble tail anchor
- For `object-position: '<x>% <y>%'` portrait tuning in this repo:
  - increasing the second percent moves the visible framing upward
  - decreasing the second percent moves the visible framing downward
  - do not rely on intuition here; verify each change against a freshly regenerated screenshot
- When portrait or bubble positioning is wrong for a specific character, adjust [web/src/replay-portrait-config.js](/Users/microwavedev/workspace/mushroom-master/web/src/replay-portrait-config.js) first before changing shared CSS or component structure.
- For cast-wide portrait or bubble changes, generate a fresh all-characters review screenshot from the current code and inspect it before sign-off.
- If one or more characters are still framed incorrectly after the first pass, adjust the config and regenerate the review screenshot instead of patching unrelated global CSS.
- For this kind of surface, tests should prove:
  - all expected character cards render
  - all expected bubbles render
  - the cast-wide review screenshot was regenerated from the current config
  - the screenshot for agent review was regenerated in the same pass

### Inventory Review Rules

- When changing inventory rendering, artifact placement rules, bot loadout generation, or any fighter card that embeds an inventory, verify against a cast-wide random inventory review surface in addition to the main screen that triggered the change.
- For the autobattler frontend, use the dev review screen at `?screen=inventory-review` as the visual audit surface for generated inventories.
- That review surface must be powered by the real backend bot-loadout generator, not handcrafted frontend-only sample data.
- Inventory review tests should prove:
  - the expected number of seeded random review cards rendered
  - each card contains the full `3×2` inventory cell count
  - every rendered artifact piece stays fully inside its inventory bounds
  - a fresh screenshot of the review surface was regenerated in the same pass
- If an inventory looks wrong in a replay, results card, or home summary, first verify whether the data itself is invalid on the inventory-review screen before tuning card layout CSS.

### Repo-Local Proof Loop

For non-trivial, multi-stage, or resume-likely work, keep durable proof inside the repository under:

- `.agent/tasks/<task-id>/`

Recommended task artifact set:

- `spec.md`
- `evidence.md`
- `evidence.json`
- `verdict.json`
- `problems.md` when verification is not fully passing
- `raw/` for command outputs, screenshots, timestamp captures, and other proof artifacts

Use this workflow when:

- the task spans multiple stages or sessions
- the task has meaningful acceptance criteria
- the task includes renderer, lore, generation, screenshot, or validation-heavy work
- another agent may need to resume or audit the work later

It may be skipped for:

- tiny one-file fixes
- trivial wording changes
- short tasks where the proof is obvious from the changed file and one direct validation step

Task-id guidance:

- use short, stable, descriptive IDs
- prefer hyphenated IDs such as `renderer-page-break-fix` or `wiki-auth-flow`
- reuse the existing task folder when continuing the same task instead of creating near-duplicates

### Spec Artifact Rules

For tasks using `.agent/tasks/<task-id>/spec.md`:

- freeze the task before implementation
- preserve the original task statement
- include explicit acceptance criteria labeled `AC1`, `AC2`, `AC3`, and so on
- include constraints
- include non-goals
- include open assumptions only when they remain unresolved
- include a concise verification plan when practical

Acceptance criteria rules:

- each criterion should be independently verifiable
- criteria IDs must remain stable across later updates to the same task
- implementation reports and verification reports should map back to the criterion IDs rather than using vague summary claims

### Evidence Rules

For tasks using the proof loop, the implementation stage should leave a durable evidence bundle after coding and before final sign-off.

Evidence expectations:

- `evidence.md` should summarize what was implemented and how each acceptance criterion was checked
- `evidence.json` should record criterion-level status using:
  - `PASS`
  - `FAIL`
  - `UNKNOWN`
- every claimed `PASS` must cite concrete proof from the current repository state
- `FAIL` and `UNKNOWN` must explain the missing proof or contradiction
- raw proof belongs in files under `.agent/tasks/<task-id>/raw/`, not only in prose
- every claimed visual `PASS` must cite the current screenshot file path and the command that regenerated it

Recommended raw artifacts:

- targeted test command output
- regeneration logs
- lint output
- screenshot captures
- timestamp checks for regenerated outputs
- command transcripts needed for a fresh verifier to reproduce the result

For renderer, lore, and generation-heavy work:

- prefer saved HTML, PDF, page-image, screenshot, and timestamp proof over narrative-only claims
- if freshness matters, capture the regeneration start time and the resulting file modification times in the raw artifacts

### Fresh Verification Rules

For tasks using the proof loop, perform a fresh verification pass after implementation.

Fresh verifier rules:

- the verifier pass must evaluate the current repository state, not the builder's narrative
- rerun the relevant checks wherever practical
- do not edit production code during the verifier pass
- do not patch evidence files just to make the task appear complete
- only mark a criterion `PASS` if it is proven now from the current files and command results

Role separation guidance:

- the same agent may build and collect evidence when needed
- the final verification pass should be done from a fresh review perspective
- if verification fails, switch back into narrow repair mode before re-verifying

### Problems Artifact Rules

When fresh verification is not fully passing, write `.agent/tasks/<task-id>/problems.md`.

For each non-`PASS` criterion, include:

- criterion ID and criterion text
- status
- why it is not proven
- minimal reproduction steps
- expected vs actual behavior
- affected files
- the smallest safe fix
- a short corrective hint

Problems-file rules:

- prefer one clearly scoped problem entry per failing criterion
- describe the smallest repair that would unblock verification
- do not mix unrelated fixes into the same problem entry
- after a fix, regenerate the evidence bundle before running fresh verification again

### Review and Reporting Rules

- Before summarizing implementation, inspect the current contents of the affected files or docs.
- Do not infer final behavior from issue titles, filenames, commit messages, or diff size alone.
- For reviews, plans, and decision docs, lead with:
  - capabilities
  - workflows
  - modules
  - routes
  - commands
  - tests
  - architecture decisions
- Do not lead with "top changed files" unless the files themselves are the real implementation surface.
- Before handoff, do a final alignment pass against the original request and explicitly call out:
  - remaining drift
  - unsupported additions
  - open assumptions
  - partial completion

### Authored vs Generated Content

- Distinguish clearly between generated evidence and authored outputs.
- Generated evidence may be refreshed.
- Authored outputs must be preserved unless the user asked to rewrite them.
- If an authored file still contains stale generated scaffolding, replace the scaffolding rather than editing around it.
- Final authored artifacts must read like finished human-grade deliverables, not like templates or agent scratchpads.
- Do not leave TODO markers, instruction text, or template guidance in final output.

### Design and Workflow Precision

- If the request describes how a design or workflow should be produced, preserve that process in the implementation.
- When a request contains words like first, after, from, using, based on, through, or instead of, treat them as possible sequencing constraints.
- For workflow-heavy work, make key states and transitions explicit.
- For UI or workflow changes, define the important screens, states, and user-visible transitions before calling the work complete.
- When practical, capture proof of those states with tests, screenshots, or structured verification artifacts.

### General Agent Effectiveness Rules

- Prefer current workspace inspection over historical reconstruction.
- Prefer helper scripts and existing project commands over rebuilding workflows manually.
- Prefer one good search over many narrow probes.
- Keep edits local, intentional, and easy to review.
- Avoid hidden assumptions; state them briefly when they matter.
- Separate evidence gathering, implementation, validation, and reporting mentally even if one agent performs multiple stages.
- After planned implementation, always perform a self-review before reporting completion.

## Source Review Workflow

When reviewing or improving lore in this repository:

- Do the review as an agent task, not as an OpenAI API prompt.
- Read `data/<channel>/messages/*.md` first only when source understanding is still missing for the current review cycle.
- If the source markdown files were already analyzed earlier in the same review cycle, do not re-read all of them again before reviewing the generated lore and page images.
- In that case, reuse the prior source understanding and review the current result against:
  - `data/<channel>/generated/mushroom-lore.md`
  - `data/<channel>/characters/*/manifest.json`
  - `data/<channel>/generated/page-images/`
- After reviewing the generated result, explicitly decide whether the issue is best fixed by:
  - source hashtag routing
  - deterministic markdown normalization / contextual routing
  - deterministic post-generation preservation of required names/details
  - renderer/layout logic
  - lore generation prompt changes
- Prefer adjusting deterministic rules when the output drops or misplaces source-grounded named entities, weaknesses, artifacts, locations, or short title-card facts that are already present in the archived markdown.

## Hashtag Routing Rules

Agent-assigned hashtags are the authoritative routing source for lore inclusion and character grouping.

Use these hashtags in source Telegram messages and archived markdown:

- `#general_lore`
  - include this message in compact general world context
- `#character_<key>`
  - include this message in the dossier for that character
  - example: `#character_thalla`
- `#exclude_lore`
  - exclude this message from lore generation entirely

Rules:

- If explicit hashtags are present, prefer them over heuristic mention matching.
- If a source message is still untagged, treat it as pending separation and keep it available as broad fallback context until it is tagged.
- Hashtags belong in the source Telegram message text/caption and must also appear under `## Hashtags` in the archived markdown.
- Lore text itself should not keep the hashtags; they are routing metadata, not narrative content.

## Tagging Workflow

After analysis, apply routing by calling the local tagging script instead of only describing the desired tags in prose.

Use:

- `npm run set-message-hashtags -- --id <messageId> --hashtags "#general_lore #character_thalla"`

Expected behavior:

- updates the live Telegram source message
- refreshes the corresponding archived markdown file
- stores the tags under `## Hashtags`

When tagging:

- prefer concise stable character keys such as `thalla`, `lomie`, `kirt`
- use `#general_lore` only when the message materially contributes to world context
- use `#exclude_lore` for noise, maintenance content, generated artifacts, or source content that should not feed lore generation

## PDF Review Workflow

When reviewing the generated lore result visually:

- Treat `data/<channel>/generated/page-images/` as the primary visual review input.
- Read `data/<channel>/generated/page-images/manifest.json` to get page order.
- Use `data/<channel>/generated/mushroom-lore.md` only as a supporting normalized output when a visual issue needs root-cause analysis.
- Treat `data/<channel>/characters/*/manifest.json` as the canonical source for which image belongs to which character.
- For render-only or authored-lore workflows, treat `data/<channel>/generated/mushroom-lore.md` as canonical authored input rather than something to be heuristically re-parsed into sections.
- Prefer freshly regenerated `page-images/` and timestamped HTML/PDF outputs over a previously opened local PDF viewer, which may still show an older cached file.

## Review Priorities

When inspecting the generated lore and page images, prioritize:

1. Whether source-tagged content appears in the correct general-lore or character section.
2. Whether each character intro keeps the correct image with the correct overview text relative to the source markdown and character manifests.
3. Section hierarchy and page flow.
4. Whitespace balance and oversized empty regions.
5. Awkward page breaks, orphaned headings, detached subsections, and image sizing/background issues.

## Fix Strategy

When proposing or applying fixes:

1. Prefer deterministic hashtag routing and markdown normalization before prompt changes.
2. Prefer deterministic post-generation preservation rules before prompt changes when the generated markdown drops required names or compresses away short source-grounded entities.
3. Prefer deterministic renderer/layout fixes before prompt changes for visual issues.
4. Prefer source markdown and OCR text over manifest/image-description fields when resolving character content.
5. Do not add a new OpenAI API review step for page-image inspection; keep that as an agent review workflow.
6. When a deterministic preservation rule is added or adjusted, review the regenerated result for overreach:
   - accidental insertion of low-value quoted fragments
   - duplicated names
   - names restored into the wrong subsection
   - stylistic bloat that should instead be handled by narrower matching rules
7. If a deterministic rule restores too much, narrow the matching logic or add explicit allow/deny behavior before weakening the prompt.
8. If you change canonical character image manifests or other generated-only lore inputs without changing source Telegram content, regenerate with `npm run regenerate -- --force` so HTML/PDF/page-images bypass the source-hash cache.
9. After any forced regeneration, verify freshness before reviewing visuals: confirm `generated/mushroom-lore.html`, `generated/mushroom-lore.pdf`, and the relevant files under `generated/page-images/` have modification times newer than the regeneration start time, then inspect those freshly written files rather than relying on a previously opened viewer snapshot.
10. If you only need to re-check renderer/layout/style/prompt effects against already archived local inputs, use `npm run regenerate -- --force --skip-download` to skip the Telegram download phase while rebuilding from stored markdown/manifests. That mode should still upload the resulting PDF through the bot/channel delivery path.
11. When debugging a visual artifact, first classify it as one of:
   - content flow or markdown structure
   - ornament asset placement
   - background pattern or page texture
   - viewer freshness/cache mismatch
12. If the issue is ornament overlap, prefer adjusting CSS positioning, size, opacity, or print-only visibility before replacing or deleting the ornament asset itself.
13. After a renderer-side visual fix that should be reviewed outside the workspace, send the freshly generated timestamped PDF through the Telegram delivery path so the reviewer is not comparing against an older cached export.

## Renderer Design Rules

When changing the HTML/PDF renderer or reviewing visual output, treat this repository as having one primary UI surface: a printable lore dossier that is also inspected through `generated/page-images/`.

Adapt design decisions to this repo, not to app-style dashboards from other projects:

- prefer document layout, reading flow, and print stability over interactive-app patterns
- do not introduce admin-panel, cabinet-tab, settings-strip, or segmented-control UI metaphors unless the repo later adds an actual app surface that needs them
- optimize first for A4 PDF output and page-image review, then verify the browser/mobile fallback remains readable

### Core Principle: Readable Print Density

- Keep content dense enough for a dossier, but never cramped.
- Preserve generous whitespace around section starts, character intros, and images so page flow stays legible in screenshots.
- Avoid decorative wrappers that consume space without improving structure.
- Use visual emphasis to clarify hierarchy, not to simulate an app UI.

### Layout Hierarchy

Prefer this document hierarchy:

1. Title and short opening context.
2. Major section headings such as general lore and characters.
3. Character dossier blocks with intro image plus overview text.
4. Supporting subsections and body prose.

Rules:

- keep the hierarchy shallow and obvious in both markdown and rendered HTML
- do not nest multiple framed containers inside each other
- reserve the strongest visual treatment for the page body, major headings, and character intro blocks
- use separators, spacing, and heading scale to show structure before adding new boxes, fills, or ornaments

### Character Intro and Image Rules

- Treat the character intro block as the key layout unit for character sections.
- Keep the canonical manifest image attached to the correct character overview text.
- Prefer stable side-by-side portrait handling and stacked fallback for wider images or narrow viewports.
- Avoid image treatments that overpower the text or create large dead zones on the page.
- If image sizing or placement breaks page flow, prefer renderer/layout fixes before prompt changes.

### Spacing and Density

- Prefer consistent vertical rhythm over local one-off tweaks.
- Heading spacing should make section boundaries obvious without wasting half a page.
- Images, `hr` separators, and intro blocks should have enough margin to prevent collisions with nearby headings and paragraphs.
- Avoid oversized empty regions, especially after headings, around images, and near page bottoms.

### Color, Typography, and Ornamentation

- Preserve the established warm parchment/mushroom visual language in [`src/lib/render.js`](/Users/microwavedev/workspace/mushroom-master/src/lib/render.js).
- For future mushroom UI work in this repository, prefer a light pastel palette direction: soft creams, moss-tinted off-whites, muted sage, pale amber, dusty peach, and other gentle natural tones.
- Avoid dark-theme defaults for new UI direction unless a specific screen or review task explicitly requires them.
- Reuse the existing renderer CSS variables when adjusting palette values instead of scattering unrelated hardcoded colors.
- Typography should feel like a dossier or field guide: readable, calm, and print-friendly.
- Decorative ornaments and patterns should remain secondary. If an ornament competes with text, reduce or remove it.
- Distinguish between repeating background textures and discrete page ornaments before making a fix; do not remove a decorative mushroom ornament when the real problem comes from the page background pattern.
- For PDF cleanup, prefer disabling or simplifying a background texture before weakening the main page ornaments if the ornaments are part of the intended visual language.
- Use stronger accent treatment on headings and key dividers, not across large body-text regions.

### Print and Page-Break Rules

- Treat print CSS as first-class behavior, not a final polish pass.
- Avoid orphaned headings, detached subsection labels, and image/text splits that break a character intro across pages awkwardly.
- Prefer `break-inside`, `break-before`, `break-after`, widow, and orphan controls over brittle content hacks.
- When a page-flow problem is visible in screenshots, confirm it in the generated HTML/PDF pair and fix the renderer deterministically where possible.

### Responsive and Review Expectations

- Even though PDF output is primary, keep the HTML readable at narrow widths so local browser inspection remains useful.
- Preserve the existing mobile fallback behavior for character intro blocks unless there is a clear improvement.
- After renderer changes, review the regenerated `page-images/` output for:
  - section hierarchy and page flow
  - whitespace balance
  - image sizing and placement
  - heading attachment to the correct content
  - visual regressions caused by print-only CSS

### What Not To Import From Other Repos

- Do not copy app-specific SCSS conventions, design tokens, or component assumptions from another repository without checking that this repo actually uses them.
- Do not reference missing files such as another repo's shared variablesheets or layout systems in new instructions.
- If reusing outside guidance, translate it into repo-native terms: markdown structure, renderer CSS, Puppeteer print behavior, generated HTML/PDF artifacts, and page-image review.

## Review Outputs

If asked to review the generated result, produce:

- findings ordered by severity
- likely root cause for each issue
- whether the issue contradicts the source markdown/tags or only the generated/normalized output
- whether the fix belongs in hashtag routing, deterministic markdown normalization, renderer CSS, or lore generation
- whether the fix should instead go into deterministic post-generation preservation / must-keep entity handling
- concise next-step recommendations
