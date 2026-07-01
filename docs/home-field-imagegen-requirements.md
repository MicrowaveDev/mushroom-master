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
- `docs/home-field-chibi-palette-cleanup-research.md` records palette-audit and cleanup-tool findings for Thalla chibi proof runs.
- `docs/home-field-chibi-regression-ledger.md` records the regressions these requirements are meant to prevent.
- `app/shared/home-field/home-field-generation-queue.json` plus `npm run game:home-field:generation-queue` define the fresh-agent queue output for queue-backed runs, including built-in imagegen defaults and method-gate status that should not be repeated in the pasted launcher.

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

Queue-backed runs must keep the pasted launcher short and put operational detail in the queue response. The queue command must print, by default, the run title, canonical run doc, agent instructions, reference inputs, output paths, required commands, method-gate status, stop gates, final-response fields, a **Built-in imagegen default path** section when allowed or **Built-in imagegen path (blocked by method gate)** section when blocked, and a **Method gate / allowed method change** section. For current Thalla chibi proof, the built-in section must include:

- the required built-in confirmation flags: `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` and `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`;
- the built-in preflight command using those flags;
- the instruction to load all three `referenceInputs` PNGs with `view_image` as the current imagegen skill's same-context input-staging step;
- the instruction to call built-in `image_gen` in that same context and explicitly name the visible `referenceInputs` images as references;
- the after-render rule to save each generated PNG directly to the documented output path or claim it with `npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference|state-sheet>`;
- the warning that passive viewing, path listing, or prompt-text path mentions are not enough unless the following same-context built-in `image_gen` call uses those visible images as references;
- a **Method gate / allowed method change** section that states whether the queued path is allowed, why it is allowed, and when to stop before archive/imagegen.

Do not rely on a human-pasted prompt to carry those built-in details. If a new queue item is marked built-in/imagegen-ready or built-in/imagegen-blocked, the queue JSON and printer must carry and validate its built-in imagegen path and method-gate status before the run starts. The method-gate status is authoritative. For current Thalla proof runs, the queue-backed built-in same-context reference-staging path is exhausted after rollout `codex-019f1eb1-1027-7752-95cf-d4f37cb0041c`: it loaded all three `referenceInputs` with `view_image`, immediately called built-in `image_gen` with those visible images explicitly named as references, saved/claimed the output file, and still failed with a `1448x1086` oversized turnaround, source-sprite blobs up to `249x332`, and `91` significant exact colors. Do not run that built-in path again unchanged. Continue only with a different reference-capable generation/editing method, supplied local proof source PNGs outside `docs/reference`, or explicit user-approved fallback; otherwise stop before archive/imagegen and report the method-gate blocker.

### IG-2. A Chat-Visible Render Is Not A Pipeline Source

The pipeline requires a real PNG at a known filesystem path. A generated image that is only visible in chat is not enough.

Allowed source paths are:

- confirmed built-in imagegen output that the same agent context can save or recover as a file, and for image-guided Thalla proof art can attach or stage the checked-in reference PNGs as actual same-context image inputs;
- supplied local proof-source PNG inputs named by the run, not checked-in style/reference PNGs;
- explicit paid API fallback only when built-in/imagegen skill output is unavailable for the run and `OPENAI_IMAGEGEN_API_KEY` plus `HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1` are configured.

Plain `OPENAI_API_KEY` must not be used as an image-generation trigger for Home Field. The dedicated fallback key is `OPENAI_IMAGEGEN_API_KEY`, so general OpenAI credentials are not silently spent on imagegen.

Do not report a generated asset as complete until the PNG exists at the documented repo path and the stage-specific verifier has passed. A filesystem path to a PNG under `docs/reference/home-field/` is reference material only. It is not a source-input method, not a proof source PNG, and not a substitute for actual reference-image binding in the generation call. For the built-in imagegen path only, loading each local reference PNG with `view_image` is allowed as the current imagegen skill's same-context input-staging step when the next built-in `image_gen` call explicitly uses those visible images as references. Passive viewing, path listing, or a later text-only prompt still does not count.

### IG-3. Preflight Must Be The First Expensive Gate

When a family-specific preflight exists, run it immediately after the launcher/context command and before expensive setup. Do not spawn generation/review sub-agents, read the full reference stack, archive stale files, replace candidate folders, or start a regeneration flow until preflight says a real source PNG path is available.

For chibi:

```bash
npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>
```

Fresh Codex sessions do not inherit shell environment variables or capability confirmations from prior chats. Prefer the built-in/imagegen skill path when it can both save discoverable PNGs and attach or stage the checked-in reference PNGs as actual same-context image inputs. If the current imagegen skill says local images become usable inputs after `view_image`, load all required reference PNGs in the same context before the built-in `image_gen` call and explicitly name them as input images in that call. If the launcher/user explicitly confirms that Codex Desktop built-in imagegen can do both from the same agent context, run the chibi proof helper commands with:

```bash
HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1 HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1 <command>
```

Use the paid API fallback only when the built-in/imagegen skill output path is unavailable for this run. Its explicit env file must contain both:

```bash
OPENAI_IMAGEGEN_API_KEY=<imagegen-only-key>
HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1
```

Do not search neighboring repos for credentials, guess `mushroom-master/.env`, or treat ambient `OPENAI_API_KEY` as usable for image generation. Plain `OPENAI_API_KEY` is intentionally ignored by the Home Field chibi preflight and API helper.

If preflight fails, stop and report the image-output blocker. Do not archive stale evidence, delete files, create deterministic fallback art, or pretend that existing `.agent` files prove a fresh run. This is an intentional clean block, not a failed imagegen attempt.

If the intended path is built-in imagegen and preflight fails only because built-in disk output is unconfirmed while reference-image input binding is already confirmed, one narrow diagnostic exception is allowed before the clean stop: run exactly one tiny non-candidate built-in `image_gen` probe in the same agent context that would run imagegen. The probe must not depict Thalla, a Home Field asset, a reference sheet, or a state sheet, and it must not archive or mutate candidate files. Do not run this probe when reference-image input binding is unavailable; it proves file capture only and cannot unblock current Thalla proof art by itself.

After that diagnostic render, run:

```bash
npm run game:home-field:find-imagegen-output -- --since-minutes=5
```

Count only a file whose timestamp is newer than the probe start, and record its path, timestamp, and hash. Use `--include-temp` for only one bounded retry. If a file is found, rerun preflight with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` plus `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`. Current Thalla reference generation requires that binding: set `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` only when the actual imagegen call can attach or use the checked-in PNGs as same-context image inputs. A `view_image` call counts only as the built-in tool's input-staging step when the following built-in `image_gen` call explicitly uses those visible images as references. Passive viewing, mentioning the PNGs in the text prompt, or listing repository paths to them is not reference-image binding. If no file is found, or if reference-image binding is unavailable, stop and ask for fresh proof source PNG inputs or explicit reference-capable paid API fallback; do not run broad filesystem searches, create fallback art, run a disk-output probe, or move stale evidence.

For actual proof art after preflight passes, do not repeat the manual finder/copy/hash/verifier loop. If built-in imagegen writes a discoverable file outside the repo, claim it into the documented proof path:

```bash
npm run game:home-field:claim-imagegen-output -- --since=<render-start-iso> --dest=<documented-path> --verify=<reference|state-sheet>
```

For the Thalla reference sheet through paid API fallback, do not hand-roll credential discovery, Python SDK setup, prompt extraction, resize normalization, verifier, palette audit, and blocker-note writing. Use:

```bash
npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof
npm run game:home-field:preflight-chibi-proof -- --env-file=<explicit-env-file>
npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>
npm run game:home-field:chibi-reference-api-proof -- --env-file=<explicit-env-file>
```

Load fallback credentials through the explicit env file instead of searching neighboring repos, assuming inherited shell state, or guessing `mushroom-master/.env`. The structured queue item records `doNotInferEnvFile: true`; rollout `codex-019f1dbd-e6dd-70e0-a7fe-53977b1cc831` correctly blocked because the guessed `.env` did not provide the required imagegen fallback environment. Future paid API fallback files must contain `OPENAI_IMAGEGEN_API_KEY` and `HOME_FIELD_IMAGEGEN_SKILL_UNAVAILABLE=1`; plain `OPENAI_API_KEY` does not count. The helper keeps the prompt source in `next-chibi-proof`, passes the checked-in reference PNGs as actual `--image` inputs, preserves an API-size source PNG, normalizes it to the current `512x384` sprite-box reference when needed, then runs `verify-chibi-proof-files -- --reference` and `palette-audit --fail-on-bloat` serially. A normalized reference still fails if palette bloat, status ornament, hair/wig reads, or other visual gate issues remain.

This helper is reference-only. It does not produce production-ready sprites by itself. After the reference gate passes, the grouped `8x4` state sheet must be generated through a reference-capable image path with the approved reference PNG attached as an actual image input. If only prompt-text state-sheet generation is available, stop and report the production-readiness blocker rather than burning another unguided attempt.

The claim helper considers only files newer than `--since`, copies the newest bounded result, records source/destination hashes, and runs the matching chibi file verifier. Keep `game:home-field:find-imagegen-output` for the one diagnostic preflight probe only.

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

For Thalla chibi proof reruns, use `npm run game:home-field:archive-stale-chibi-proof -- thalla --env-file=<explicit-env-file>` instead of ad hoc `rg`, `find`, or shell moves. The helper reruns preflight with the same explicit environment and moves only the documented live reference, raw, and candidate paths after preflight passes.

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

Active-roster chibi candidates must follow `docs/home-field-chibi-candidate-contract.md`. The current proof is `thalla` only, candidate-only, with one non-production reference sheet followed by one coherent grouped `8x4` state sheet split into 32 character-only frames. The grouped sheet must author idle bob and walk motion; post-split processing may not synthesize animation. Generate chibis with a deliberately small sprite palette: prefer `12-18` artist-visible colors and stay under `20`, excluding transparency and chroma-key.

Run the palette audit helper on each chibi proof stage before treating palette discipline as reviewed:

```bash
npm run game:home-field:palette-audit -- <png> --out=<review-json> --swatch=<review-swatch.png> --fail-on-bloat
```

For current Thalla proof runs, the required evidence filenames are `thalla-reference-palette-audit.json`, `thalla-state-sheet-palette-audit.json`, and `thalla-candidate-palette-audit.json`, each with the matching `*-palette-swatch.png` under `.agent/home-field-workspace/review/`. `candidate-evidence.manifest.json` requires these artifacts for chibi candidates and checks their `source.sha256` values against the current reference, grouped state sheet, and candidate PNG so stale palette reports cannot satisfy the gate.

For the Thalla sprite-box reference, `npm run game:home-field:verify-chibi-proof-files -- --reference` also checks source-sprite occupancy: after excluding transparency and hot-magenta background pixels, each major visible character blob must fit within the verifier's `128x128px` tolerance for the `96x96` source-sprite box contract. A large canvas with high empty-magenta coverage still fails if the characters are enlarged showcase-turnaround figures.

If palette cleanup or external palette-aware tools are used, treat them as diagnostic or candidate-repair experiments only. Follow `docs/home-field-chibi-palette-cleanup-research.md`: palette improvement does not approve a chibi that still fails cap biology, eye scale, ornament, source-sprite occupancy, or composed field-sprite style.

## Update Rule

When an imagegen requirement changes, update every surface agents will actually read:

- this document;
- the family-specific contract;
- run launcher prompt;
- generated prompt JSON/output helpers;
- validators or evidence helpers if behavior changed;
- tests that pin the helper output.

Do not rely on a prose-only change when a runnable helper still prints the old rule.
