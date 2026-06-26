# Home Field Imagegen Requirements

Date: 2026-06-24

This is the current requirements document for Home Field image generation. It defines how generated images must be requested, saved, processed, reviewed, and handed off before they can be treated as usable game assets.

This document is the shared imagegen contract. Family-specific contracts can add stricter rules, but they must not weaken these requirements.

## Related Contracts

- `docs/design-requirements.md` is the canon-facing visual source for the world and characters.
- `docs/home-field-runtime-asset-contract-plan.md` defines runtime-readiness requirements for generated Home Field assets.
- `docs/home-field-agent-flow.md` defines the multi-agent generation, validation, review, and handoff workflow.
- `docs/home-field-scale-contract.md` defines scale and screen-composition constraints.
- `docs/home-field-tileset-contract.md` defines terrain/tile-family constraints.
- `docs/home-field-chibi-candidate-contract.md` defines active-roster chibi-specific constraints.
- `docs/home-field-chibi-style-reference.md` defines the current chibi visual target.
- `docs/home-field-chibi-regression-ledger.md` records the regressions these requirements are meant to prevent.

## Core Requirements

### IG-1. Freeze The Run Scope Before Imagegen

Every imagegen run must start with a stated scope:

- asset family;
- exact asset IDs;
- candidate vs approved/app-facing output mode;
- required source docs;
- required validation/evidence commands;
- explicit non-goals.

Do not broaden a scoped run because a prompt, helper, or generated output suggests more assets. For the current chibi proof, the scope is `thalla` only.

### IG-2. A Chat-Visible Render Is Not A Pipeline Source

The pipeline requires a real PNG at a known filesystem path. A generated image that is only visible in chat is not enough.

Allowed source paths are:

- confirmed built-in imagegen output that the same agent context can save or recover as a file;
- supplied local PNG inputs named by the run;
- explicit CLI imagegen fallback when the user requested it and credentials are configured.

Do not report a generated asset as complete until the PNG exists at the documented repo path and the stage-specific verifier has passed.

### IG-3. Preflight Must Be The First Expensive Gate

When a family-specific preflight exists, run it immediately after the launcher/context command and before expensive setup. Do not spawn generation/review sub-agents, read the full reference stack, archive stale files, replace candidate folders, or start a regeneration flow until preflight says a real source PNG path is available.

For chibi:

```bash
npm run game:home-field:preflight-chibi-proof
```

If preflight fails, stop and report the image-output blocker. Do not archive stale evidence, delete files, create deterministic fallback art, or pretend that existing `.agent` files prove a fresh run. This is an intentional clean block, not a failed imagegen attempt.

If the intended path is built-in imagegen and preflight fails only because built-in disk output is unconfirmed, one narrow diagnostic exception is allowed before the clean stop: run exactly one tiny non-candidate built-in `image_gen` probe in the same agent context that would run imagegen. The probe must not depict Thalla, a Home Field asset, a reference sheet, or a state sheet, and it must not archive or mutate candidate files.

After that diagnostic render, run:

```bash
npm run game:home-field:find-imagegen-output -- --since-minutes=5
```

Count only a file whose timestamp is newer than the probe start, and record its path, timestamp, and hash. Use `--include-temp` for only one bounded retry. If a file is found, rerun preflight with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` and continue only if preflight passes. If no file is found, stop and ask for local PNG inputs or explicit CLI fallback; do not run broad filesystem searches, create fallback art, or move stale evidence.

### IG-4. Candidate Work Stays Out Of App-Facing Paths

Generated candidates belong under `.agent/home-field-workspace/` until explicit human approval promotes them.

Do not write candidate imagegen output directly to:

```text
web/public/home-field/
```

Do not set `approved`, `accepted: true`, or any production-looking review state unless the user explicitly approves the asset.

### IG-5. Preserve Source Provenance

Every run must preserve enough evidence to explain where the asset came from:

- raw imagegen source path;
- processed candidate path;
- hashes recorded by the relevant evidence manifest;
- reference images used and their role;
- validation commands and outputs;
- preview/contact-sheet paths;
- recovered validation failures and recovery actions.

Rejected source images and candidates are negative examples. Archive them under `.agent/home-field-workspace/rejected/` when the workflow says to clear the live workspace; do not delete them as a way to make the evidence simpler.

### IG-6. Prompt For Runtime Assets, Not Pretty Standalone Pictures

Imagegen prompts must describe the final runtime role, not only the subject.

Every Home Field prompt must include, directly or by a referenced contract:

- final in-game footprint and scale;
- camera/view angle;
- alpha/background rule;
- anchor or footing expectation;
- shadow policy;
- allowed post-processing;
- scene-composition context;
- required style/canon references;
- explicit negative examples when previous runs failed.

If the player will see the asset at `52px` or `64px`, design for that size. Extra source pixels are for cleaner processing, not extra tiny detail.

### IG-7. Use Cohesive Source Groups For Related Tiles Or States

When assets must match as a set, prefer one coherent source image that can be split or cropped over independent imagegen calls.

Examples:

- terrain families should come from one shared meadow/path source when the tiles must tile or blend together;
- same-character state tiles must come from one coherent grouped state sheet;
- reference sheets are allowed for consistency, but must not be sliced into production frames unless the family contract explicitly allows it.

Independent per-tile generation is allowed only when the family contract permits it or the user explicitly asks for diagnostics.

### IG-8. Deterministic Processing May Clean, Not Author

Allowed deterministic processing is limited to the asset family contract. By default it may:

- crop or fit to the target canvas;
- remove chroma-key or alpha fringe;
- normalize transparent padding;
- resize with the required scaling mode;
- assemble split/cropped pieces into the candidate format.

It must not create new art, change identity, synthesize pose/motion, repaint style, add shadows, add missing body parts, or turn a failed imagegen source into a fake fresh candidate.

### IG-9. Runtime Readiness Is A Gate

A generated source is not ready because it looks good in isolation. A Home Field candidate must prove:

- complete, unclipped raw source;
- clean alpha or compatible terrain edges;
- stable anchor/footing;
- correct shadow policy;
- readable mobile footprint;
- composed mobile and desktop scene fit;
- candidate evidence manifest with the relevant hashes and source chain.

Mechanical validation is necessary but not sufficient. The composed field preview is the primary visual review surface.

### IG-10. Separate Roles For Generation And Approval

The role that generates an image must not be the same role that approves it.

When sub-agents are available:

- contract/prompt reviewer checks requirements before imagegen;
- imagegen worker generates only inside a context with confirmed file-output capture;
- producer/validator builds candidate files and evidence;
- visual critic reviews from composed scene evidence;
- handoff/orchestrator reports verdict, evidence, and remaining blockers.

Sub-agents are useful for review and validation, but do not assume a sub-agent can run built-in imagegen or recover its output unless that exact agent context has proven discoverable PNG output.

### IG-11. Handoff Must Report Reality, Not Just The Final Pass

Final handoff must include:

- generated asset IDs and verdicts;
- exact validation commands and pass/fail;
- candidate folder and evidence manifest paths;
- contact/readability/alpha/composed preview paths as applicable;
- any recovered validator failure with failed command, recovery action, and final passing command/log;
- whether app-facing files were untouched or explicitly promoted.

If the run is blocked by image-output capture, say that. Do not describe it as an imagegen style failure.

## Family-Specific Notes

### Terrain

Terrain source images must be quiet, repeatable, and authored for tile assembly. Shared-source crops are preferred for families that must blend together. Do not bake props, paths, UI, text, horizon lines, or focal objects into base grass tiles.

### Props And Entrances

Object-layer assets need transparent backgrounds, broad silhouettes, safe visible padding, bottom-center anchors, and no baked shadows unless the family contract explicitly requires one.

### Chibi

Active-roster chibi candidates must follow `docs/home-field-chibi-candidate-contract.md`. The current proof is `thalla` only, candidate-only, with one non-production reference sheet followed by one coherent grouped `8x4` state sheet split into 32 character-only frames. The grouped sheet must author idle bob and walk motion; post-split processing may not synthesize animation.

## Update Rule

When an imagegen requirement changes, update every surface agents will actually read:

- this document;
- the family-specific contract;
- run launcher prompt;
- generated prompt JSON/output helpers;
- validators or evidence helpers if behavior changed;
- tests that pin the helper output.

Do not rely on a prose-only change when a runnable helper still prints the old rule.
