# Home Field Chibi Regression Ledger

Date: 2026-06-24

This is the causal history for the Thalla Home Field chibi proof regressions. Read it before changing the chibi flow, prompt, preflight, validators, or evidence manifest.

The goal is not to blame one run. The goal is to preserve the decisions that looked reasonable in the moment, the regressions they created, and the guardrails added afterward.

## Current Boundary

The active Stage 1 contract is:

- generate only `thalla`;
- candidate-only outputs under `.agent/home-field-workspace/candidates/chibi-active-roster/latest`;
- one non-production reference sheet, then one coherent grouped `8x4` state sheet;
- split into 32 character-only frames;
- separate shared `chibi_shadow`, no baked frame shadow;
- no deterministic/mechanical fallback art unless the user explicitly asks for diagnostics;
- no cleanup or generation unless `npm run game:home-field:preflight-chibi-proof` passes;
- a chat-visible imagegen render is not enough; the pipeline needs real PNG files on disk.

## Regression Timeline

### 1. Style Drift From The Reference Target

**Symptom:** Early Thalla chibi attempts did not match the desired reference style. They drifted into ornate fantasy sprites, tiny beige sprites, portrait stickers, or generic mushroom-hat elves instead of a simple BJD-inspired elevated field sprite.

**Decision that led there:** Prompts described Thalla's canon and fantasy regalia more strongly than they described the runtime style target. The workflow also treated "looks detailed" and "has Thalla symbols" as stronger signals than mobile scene readability.

**Why it regressed:** The generator optimized for character illustration richness, not for a `64px` top-down field token. Validators only checked dimensions/alpha/readability, not style fit.

**Guardrails added:**

- `docs/home-field-chibi-style-reference.md`
- `docs/design-requirements.md` section 11
- stronger prompt language around BJD-inspired chibi doll simplicity, fewer marks, tiny face/body, and elevated 2.5D map read
- composed mobile/desktop preview as the visual authority, not spritesheet-only review

### 2. Per-State Generation Caused Identity Drift

**Symptom:** Idle/walk states for the same character changed face, cap, robe, proportions, or detail level across frames.

**Decision that led there:** It seemed natural to ask imagegen for separate state tiles or repair cells independently.

**Why it regressed:** Separate imagegen calls do not preserve small character details reliably. Even subtle prompt differences created different renderer/identity reads.

**Guardrails added:**

- one grouped `8x4` state sheet is the required source for all Thalla idle/walk states;
- split raw frames are derived from that grouped sheet;
- single-cell repair is allowed only as a targeted, explicitly justified exception;
- `candidate-evidence.manifest.json` must bind the grouped sheet and all 32 split frames.

### 3. Baked Shadow Mixed Character And Runtime Layers

**Symptom:** Some chibi attempts included a shadow blob or ground context inside the character frames.

**Decision that led there:** Prompting "grounded" characters encouraged the model to include a cast shadow. A baked shadow made isolated frames look more complete in contact sheets.

**Why it regressed:** The runtime needs character-only alpha frames so the renderer can place a shared shadow layer consistently under idle/walk frames.

**Guardrails added:**

- separate `chibi_shadow` asset under `_shared`;
- docs require no baked frame shadow;
- evidence manifest now records `separateShadowTile`.

### 4. Idle Squat Became Too Deep

**Symptom:** The cute two-frame idle idea became a crouch/deep squat rather than a small bob.

**Decision that led there:** "Squat" was used casually to describe a cute idle beat. The generator and later validators tolerated too much silhouette height loss.

**Why it regressed:** At `64px`, a deep squat changes character identity and reads as a different pose/state rather than a gentle idle loop.

**Guardrails added:**

- contract now defines idle frame 1 as only a `1-3px` bob/squish;
- `--check-chibi-animation` rejects excessive height loss, center shift, or top drop.

### 5. Chibi Was Structurally Valid But Too Tiny

**Symptom:** A later proof produced a valid `512x256` sheet with 32 frames, clean alpha, and a shadow tile, but the chibi was tiny and visually weaker than nearby props.

**Decision that led there:** The validator accepted crispness/contrast and frame uniqueness as enough objective quality. The visual critique correctly marked the result `needs_regen`, but the mechanical pass still made the evidence look stronger than it was.

**Why it regressed:** A tiny sprite can pass alpha, dimensions, contrast, and simple unique-hash checks while still failing scene-scale readability and art quality.

**Guardrails added:**

- `--check-chibi-quality` now rejects too-small visible footprint;
- direction rows must be meaningfully different;
- animation uniqueness now uses meaningful pixel deltas, not just exact hashes/color noise.

### 6. Evidence Manifest Did Not Bind The Full Source Chain

**Symptom:** `candidate-evidence.manifest.json` could have `rawSource: null` or only bind the composed candidate PNG, leaving reviewers unable to verify the grouped sheet/reference/split-frame provenance.

**Decision that led there:** Evidence collection was originally written for static terrain/prop candidates where one raw source or one output hash was enough.

**Why it regressed:** Chibi candidates have a multi-stage source chain: reference sheet, grouped state sheet, split frames, candidate sheet, shadow tile, previews, and recovered failure notes.

**Guardrails added:**

- chibi evidence now includes `chibiSources.reference`;
- grouped `8x4` state sheet is recorded as `rawSource`;
- all 32 split frames and `frameSetSha256` are recorded;
- manifest includes previews, separate shadow tile, and recovered failure notes.

### 7. OpenAI API / CLI Fallback Confusion

**Symptom:** Agents thought the chibi proof required `OPENAI_API_KEY`, even when Codex Desktop built-in imagegen was supposed to be the normal path.

**Decision that led there:** The imagegen skill has both built-in and CLI modes. Preflight originally mixed "imagegen path exists" with "CLI fallback configured", so missing `OPENAI_API_KEY` looked more fatal than it should have.

**Why it regressed:** The docs did not clearly separate built-in chat imagegen from the CLI file-output path.

**Guardrails added:**

- skill/docs state CLI fallback is explicit-only;
- preflight reports CLI readiness separately from built-in file-output readiness.

### 8. Built-In Imagegen Rendered In Chat But Did Not Produce A Discoverable File

**Symptom:** Built-in imagegen produced good-looking images in the chat UI, but agents could not find a saved PNG to copy into `.agent/home-field-workspace/`.

**Decision that led there:** The workflow assumed built-in imagegen would save generated images under a predictable `$CODEX_HOME` path. That was true or mostly true in earlier contexts, but not reliable in the observed Desktop run.

**Why it regressed:** The repo pipeline requires file hashes, splitting, chroma cleanup, candidate production, and evidence manifests. A chat-visible image cannot satisfy those steps.

**Guardrails added:**

- `npm run game:home-field:find-imagegen-output` searches bounded Codex/app/temp locations;
- `npm run game:home-field:preflight-chibi-proof` now fails unless built-in disk output is explicitly confirmed with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1`, local image inputs exist, or explicit CLI fallback is configured.

### 9. Mechanical Fallback Proof Looked Like Progress

**Symptom:** When built-in imagegen output could not be captured, an agent generated deterministic/local fallback PNGs. The files passed much of the structural pipeline, but the art was not a valid fresh imagegen candidate.

**Decision that led there:** Continuing with local generated fixtures seemed useful for validating the evidence path and avoiding a dead stop.

**Why it regressed:** It blurred two different states: "diagnostic pipeline scaffold" and "fresh art candidate." Even with `needs_regen`, committing fallback evidence created noise and could mislead future agents.

**Guardrails added:**

- deterministic/mechanical chibi art is forbidden unless the user explicitly requests diagnostics;
- proof prompt says to stop if no imagegen file is found;
- validators now reject the tiny repeated fallback sheet objectively.

### 10. Stricter Preflight Looked Like An Imagegen Regression

**Symptom:** The next run stopped before any imagegen call. It looked like built-in imagegen was broken or blocked by sub-agents.

**Decision that led there:** We hardened preflight after the chat-visible/no-file failure. The user prompt also explicitly said: "First run preflight. Do not clean or generate unless it passes."

**Why it regressed:** The run had zero imagegen calls. It stopped because the new gate intentionally required confirmed file output. That is a workflow boundary change, not evidence that sub-agent imagegen failed.

**Guardrails added / remaining work:**

- this ledger documents the distinction;
- future prompts should say whether the goal is to test built-in imagegen UI generation separately from the chibi pipeline;
- if the operator confirms a discoverable built-in output path, set `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` only for that run.

## Decision Rules Going Forward

1. Do not weaken preflight just to see an image in chat. The chibi proof is a file pipeline.
2. Do not run broad filesystem searches for imagegen output. Use `npm run game:home-field:find-imagegen-output`.
3. Do not create deterministic fallback chibi art unless the user explicitly asks for diagnostics.
4. Do not treat validator pass as art approval. The composed field preview remains decisive.
5. Do not expand to the roster until Thalla passes as a scene-scale candidate.
6. If a new rule blocks a run, record whether it is an intentional gate or an unintended regression before changing it.

