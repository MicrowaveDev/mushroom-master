# Home Field Chibi Regression Ledger

Date: 2026-06-24

This is the causal history for the Thalla Home Field chibi proof regressions. Read it before changing the chibi flow, prompt, preflight, validators, or evidence manifest.

The goal is not to blame one run. The goal is to preserve the decisions that looked reasonable in the moment, the regressions they created, and the guardrails added afterward.

## Evidence Sources

This ledger was expanded from the current chat rollout:

```text
/Users/microwavedev/workspace/microwave-hub/agent-viewer/temp/codex-019e69b6-1972-7462-a5ee-da953cc7723b-rollout-2026-05-27T14-53-22-019e69b6-1972-7462-a5ee-da953cc7723b.jsonl
```

When adding new causal claims, keep at least one source pointer: rollout path, log line or task-complete event, affected artifact path, and the decision/failure observed. If the evidence comes from a meta-analysis rollout, record both the meta-rollout line and the original referenced rollout when available. Do not add new regression history from memory alone.

## Current Boundary

The active Stage 1 contract is:

- generate only `thalla`;
- candidate-only outputs under `.agent/home-field-workspace/candidates/chibi-active-roster/latest`;
- one non-production reference sheet, then one coherent grouped `8x4` state sheet;
- split into 32 character-only frames;
- separate shared `chibi_shadow`, no baked frame shadow;
- no deterministic/mechanical fallback art unless the user explicitly asks for diagnostics;
- no stale-file archive or generation unless `npm run game:home-field:preflight-chibi-proof` passes;
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
- `npm run game:home-field:preflight-chibi-proof` now fails unless built-in disk output is explicitly confirmed with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` from the same agent context that will run imagegen, local image inputs exist, or explicit CLI fallback is configured.

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
- do not assume a sub-agent can run or recover built-in imagegen output unless that exact agent context has confirmed discoverable PNG output;
- if the operator confirms a discoverable built-in output path, set `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` only for that run.

### 11. Stale Rejected Raw Files Masqueraded As Fresh Generation

**Symptom:** A run could appear ready or mechanically complete because old `thalla_chibi.frame_*.source.png` files and a stale candidate folder still existed under `.agent/home-field-workspace/`.

**Decision that led there:** The first hardening pass treated "required files exist" as close to "new generation is ready." It also relied on manual shell cleanup of stale local workspace files.

**Why it regressed:** `.agent` workspace state is local scratch, not proof of a fresh imagegen run. Rejected raws can satisfy producer input checks and make the agent skip the actual regeneration work.

**Evidence:** In the current chat rollout, task-complete line `92` says the agent reused existing Thalla raw frame files and let mechanical validity blur into acceptance. Task-complete line `263` then confirms the stale raw/candidate state had to be archived before the next run. The same rollout also shows manual archive commands around stale-file handling, including shell-specific friction.

**Guardrails added / remaining work:**

- prompts now say to archive stale rejected Thalla raw/candidate outputs only after preflight passes;
- producer success on existing raw files must not count as fresh generation work;
- a future helper should archive rejected chibi raws/candidates with shell-portable behavior and print a single PASS/FAIL readiness verdict.

### 12. Nearest-Neighbor Resize Preserved The Pixel-Sprite Failure

**Symptom:** The rejected tiny beige Thalla candidate had hard pixel stair-steps and a low-resolution sprite feel. Early helper output and tests still allowed or taught `--resize-nearest` for chibi candidate production.

**Decision that led there:** Nearest-neighbor resizing is useful for exact pixel art and deterministic fixtures, so it looked like a safe way to preserve sprite edges during compose.

**Why it regressed:** The target style is hand-drawn elevated 2.5D chibi, not pixel art. Nearest-neighbor scaling reinforced the rejected renderer instead of smoothing higher-resolution source frames into a finished field sprite.

**Evidence:** The current chat rollout's first pushed hardening explicitly changed the generated producer command from `--resize-nearest` to smooth `--resize` and locked that behavior with the Home Field pipeline test.

**Guardrails added:**

- chibi proof docs require smooth `--resize` for larger source frames;
- `--resize-nearest` is called out as a rejection signal for production chibi candidates;
- tests assert the generated chibi prompt/producer guidance keeps smooth resizing.

### 13. Runnable Helpers Drifted From The Chibi Contract

**Symptom:** After docs changed, runnable helper output still printed stale chibi instructions such as `Animation: none`, legacy per-frame generation guidance, or `Raw frame output slots: 12` after the contract had moved to a grouped `8x4` sheet and 32 split frames.

**Decision that led there:** The docs and prompts were patched incrementally, while helper scripts, generated prompt JSON, preflight/context output, verifier output, and tests were updated in later passes.

**Why it regressed:** Agents follow executable command output under pressure. If `RUN_CHIBI_PROOF_PROMPT.md` says one thing but `next-chibi-proof` or preflight prints another, the stale helper becomes the de facto instruction source for the next run.

**Evidence:** The current chat rollout shows a readiness check catching generated output that still referenced 12 slots and stale animation wording after earlier docs had been tightened. Later fixes updated preflight/context/verifier output and tests.

**Guardrails added / remaining work:**

- generated prompt output is part of the contract, not secondary prose;
- any chibi rule change must update `RUN_CHIBI_PROOF_PROMPT.md`, `home-field-prompts.json`, `next-chibi-proof`, preflight, verifier, context printer, split/composer expectations, and tests in the same pass;
- a future `game:home-field:chibi-proof-readiness` helper should check doc/helper drift before commit/push.

### 14. Preflight Overcorrected From CLI-Biased To Too Trusting

**Symptom:** After fixing the false impression that `OPENAI_API_KEY` was required, preflight allowed Codex Desktop built-in imagegen by default even when disk output was explicitly unconfirmed.

**Decision that led there:** The API-key blocker looked too strict, so the guardrail was relaxed to keep built-in chat imagegen usable without requiring CLI credentials.

**Why it regressed:** The chibi pipeline does not need "an image was visible in chat"; it needs a discoverable PNG file for hashing, splitting, validation, and provenance. Trusting built-in imagegen without proving disk output let a run proceed into fallback evidence.

**Evidence:** The current chat rollout includes the "why is it requiring OpenAI API?" turn, then the "adjust the preflight/docs" fix that relaxed built-in imagegen handling, then the later run where preflight passed without confirmed built-in disk save and no usable image file appeared.

**Guardrails added:**

- built-in imagegen is valid for this proof only after a discoverable file-output path is confirmed with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` from the same agent context that will run imagegen;
- local source image inputs and explicit CLI fallback remain separate allowed paths;
- final reports should say "blocked by file-output gate" when preflight stops before imagegen, not "imagegen failed."

### 15. Synthetic Post-Split Motion Violated Grouped-Sheet Authorship

**Symptom:** A candidate could pass animation checks after deterministic post-split edits created a tiny idle bob or shifted frames, even though the grouped state sheet itself did not author that motion.

**Decision that led there:** After a mostly good grouped candidate, a tiny deterministic movement seemed like an acceptable repair because it made the validation metrics pass and kept the candidate moving.

**Why it regressed:** The grouped state sheet is the identity/style source of truth. Synthetic pose, squash, stretch, shift, or repaint edits after splitting can make the proof look more complete while hiding that imagegen did not produce coherent animation frames.

**Evidence:** The current chat rollout shows a candidate accepted for review with deterministic post-split idle motion, then a later hardening pass marking that candidate `needs_regen` because motion must come from the grouped source sheet itself.

**Guardrails added:**

- post-split processing may clean alpha/chroma fringe, crop, and resize only;
- no shifting, squashing, stretching, repainting, or pose/silhouette edits after split;
- validation and evidence now require the grouped source chain so reviewers can inspect where motion came from.

### 16. Reference Images Lacked Complete Provenance

**Symptom:** The liked Thalla image became a positive direction reference without the same source-path and line metadata as the first checked-in chibi style reference.

**Decision that led there:** The image was visually useful, so it was copied into `docs/reference/home-field/` and linked from prompt docs quickly.

**Why it regressed:** Reference images influence future imagegen prompts. Without provenance and intent notes, later agents cannot tell whether a bitmap is a canonical target, a user preference snapshot, a non-owned style calibration image, or a negative example.

**Evidence:** The current chat rollout includes the user request to save the liked image from the chat logs at line `1080`, and task-complete line `1334` records that it was checked in as `docs/reference/home-field/chibi-thalla-liked-2026-06-23.png`.

**Guardrails added / remaining work:**

- each checked-in chibi reference image should record source rollout path, source line or attachment path, user note, local file path, and whether it is positive direction, negative example, or non-owned style calibration;
- reference images are guidance for proportions, simplicity, outline, and appeal, not permission to copy exact characters, costumes, symbols, or compositions.

### 17. Cleanup Ran Before A Replacement Source Was Proven

**Symptom:** A rerun archived the previous `chibi-active-roster/latest` candidate before it had a replacement PNG from imagegen. When built-in imagegen did not leave a recoverable file, the run ended without a current latest candidate.

**Decision that led there:** After stale raws caused reuse, cleanup was moved near the start of the rerun flow. That looked sensible because old rejected frames were dangerous, but it made "remove stale state" happen before "prove this run can create a new source file."

**Why it regressed:** Moving or deleting local candidate evidence is a state-changing operation. If the generation path then blocks, the workflow has made the workspace less useful while still producing no new art.

**Evidence:** In the current chat rollout, task-complete line `451` diagnoses a run that produced no usable PNG and archived the existing Thalla candidate before replacement. Task-complete line `573` then adds the chibi output preflight so future runs stop before archiving stale files when no file-output path is proven.

**Guardrails added:**

- preflight must pass before stale raw/candidate archive;
- stale-file handling should archive, not delete, rejected evidence;
- readiness checks must verify both "no live stale inputs" and "this run has an allowed output path."

### 18. Exact-Size Split Assumptions Broke Larger State Sheets

**Symptom:** A grouped state-sheet run produced a larger proportional image (`1774x887`, normalized to `1776x888`) instead of an exact `512x256` sheet. The documented split command did not include `--resize`, and the first splitter logic resized too late, after slicing assumptions had already been applied.

**Decision that led there:** The contract described the runtime sheet shape (`8x4`, `512x256`, `64x64` frames) so strongly that helper behavior initially assumed imagegen would provide exact grid dimensions.

**Why it regressed:** Imagegen commonly returns larger or slightly odd proportional outputs. Exact-dimension assumptions turn a visually promising source sheet into a tooling blocker and encourage ad hoc image normalization outside the documented pipeline.

**Evidence:** In the current chat rollout, task-complete line `1457` records the `1774x887` grouped-sheet case and the fix. The follow-up commit `b2fc97a` updated `split-home-field-chibi-state-sheet.js`, docs, prompts, and tests so `--resize` normalizes proportional sheets before slicing.

**Guardrails added:**

- the split command is `npm run game:home-field:split-chibi-state-sheet -- --chroma-key=#ff00ff --resize`;
- the splitter normalizes larger proportional sheets before slicing;
- docs allow exact `512x256` or larger proportional `8x4` sources, but no ad hoc resizing outside the helper.

### 19. Six Walk Slots Became Pose-Count Pressure

**Symptom:** A grouped sheet could provide six technically unique walk frames per direction while still feeling overcomplicated, soft, or drift-prone at `64px`.

**Decision that led there:** The runtime sheet has six walk columns per direction, and that was initially read as "generate six important walk poses" instead of "fill a six-slot lane with a simple readable cycle."

**Why it regressed:** Every extra imagegen pose is another chance for the face, cap, robe, silhouette, or detail budget to drift. Mechanical uniqueness proves "not static," but it does not prove the motion is useful at map scale.

**Evidence:** In the current chat rollout, task-complete line `1589` notes that six walk columns were probably too much pressure for the proof, and task-complete line `1720` records the follow-up change: target four meaningful poses across the six slots, with optional holds/in-betweens.

**Guardrails added:**

- six slots remain the runtime lane, not a demand for six major poses;
- the target is about `4` meaningful walk poses, with optional holds or in-betweens;
- validators still require enough frame diversity, but visual review decides whether the motion reads well.

### 20. Standalone Sheet Quality Did Not Equal Runtime Readiness

**Symptom:** Chibi sources and sheets could look acceptable in isolation, while the composed mobile field still showed Thalla as too small, too soft, or less finished than nearby approved props. A reference sheet could also look stronger than the final downscaled sheet.

**Decision that led there:** Reviews leaned on contact sheets, source PNGs, and mechanical validators. Larger source images were treated as a quality upgrade, even when the extra pixels invited details that disappeared after downscale.

**Why it regressed:** The player sees a small anchored runtime object on grass, not a standalone illustration. Visible footprint, alpha padding, bottom anchor, shadow compatibility, and composed-scene scale can fail even when dimensions, transparency, and contrast checks pass.

**Evidence:** In the current chat rollout, task-complete line `1597` flags that chibi quality was weaker than other items; line `2332` reframes Home Field assets as runtime objects; line `2606` records the new runtime-readiness validator; and line `2715` still cautions that an improved candidate reads slightly small/soft in the composed field.

**Guardrails added:**

- `docs/home-field-imagegen-requirements.md` defines the shared imagegen contract, and `docs/home-field-runtime-asset-contract-plan.md` defines the runtime asset contract;
- generated prompts include final footprint, anchor, alpha/background, shadow policy, and composed-scene requirements;
- `--check-runtime-readiness` catches objective alpha edge and anchor/footing failures;
- composed mobile/desktop clean previews remain the decisive review surface.

### 21. Candidate Approval Leaked Into Production-Looking State

**Symptom:** The minimal-v1 flow briefly treated the current Thalla chibi as approved or production-ready, even though composed screenshot review showed a tiny beige/pixel-art doll sprite that did not match the agreed style.

**Decision that led there:** The minimal scene promotion bundled many asset classes together. Because terrain/props/exits were moving toward production, the chibi candidate's mechanical pass and scene presence were allowed to look like approval.

**Why it regressed:** Candidate evidence, app-facing assets, review verdicts, and production validation are separate states. When they blur together, an unapproved chibi can appear in production-looking previews and future agents may inherit that as accepted art.

**Evidence:** In the current chat rollout, task-complete line `92` notes that Thalla was briefly promoted as approved before rollback in commit `2461d76`. `docs/home-field-generation-retrospective.md` also records the minimal-v1 chibi rollback as a regression case.

**Guardrails added:**

- Stage 1 chibi work is candidate-only;
- do not overwrite `web/public/home-field/characters/*/spritesheet.png`;
- do not set `accepted: true` or `approved` without explicit human approval;
- unapproved chibis stay out of production-looking clean previews and active-scene production validation.

### 22. Static Walk Replication Passed As Animation

**Symptom:** The sheet shape had walk columns `2-7`, but the producer could replicate one walk pose across those columns. The candidate could satisfy the expected layout while visually staying static.

**Decision that led there:** Earlier character placeholder handling used one walk frame per direction and repeated it across the row. That was acceptable for a technical placeholder, but the same mental model leaked into a production-candidate chibi proof.

**Why it regressed:** Sheet dimensions and frame slots are not animation. A static replicated row can pass file and mapping checks while failing the user-facing requirement that the Home Field chibi has simple real walk motion.

**Evidence:** In the current chat rollout, the user raised the shadow/walk gap at line `709`. Task-complete line `747` identifies the replicated walk-pose problem, and task-complete line `1076` records the fix: explicit 32 raw frame slots plus `--check-chibi-animation`.

**Guardrails added:**

- Thalla Stage 1 requires explicit `frame_walk_<direction>_0..5` source files;
- validators reject static replicated walk rows;
- placeholder replication remains placeholder-only and must not be treated as production chibi animation.

### 23. Recovered Validation Failures Disappeared From Handoff Context

**Symptom:** A run could recover from a real validator failure, then the final passing logs made the earlier failure easy to miss. In one run a subagent reported thousands of magenta fringe pixels, but the final state passed after cleanup.

**Decision that led there:** Handoffs focused on final pass/fail status and evidence links. That is usually concise, but it hid whether the candidate had required repair, which repair was applied, and whether the final evidence corresponded to the recovered state.

**Why it regressed:** Recovered failures are part of provenance. Without them, future reviewers cannot tell whether a candidate was clean from the source image, fixed by allowed alpha/chroma cleanup, or quietly repaired in a way that should influence visual review.

**Evidence:** In the current chat rollout, task-complete line `2715` notes a recovered alpha story: a subagent reported `5144` magenta fringe pixels before final logs passed. Task-complete line `2913` records the follow-up change requiring recovered validation failures in handoff reports and evidence.

**Guardrails added:**

- final responses must list recovered validator failures, recovery actions, and final passing command/log;
- `candidate-evidence.manifest.json` includes recovered failure notes;
- validators passing at the end does not erase the need to document a repaired intermediate failure.

## Decision Rules Going Forward

1. Do not weaken preflight just to see an image in chat. The chibi proof is a file pipeline.
2. Do not run broad filesystem searches for imagegen output. Use `npm run game:home-field:find-imagegen-output`.
3. Do not create deterministic fallback chibi art unless the user explicitly asks for diagnostics.
4. Do not treat validator pass as art approval. The composed field preview remains decisive.
5. Do not expand to the roster until Thalla passes as a scene-scale candidate.
6. If a new rule blocks a run, record whether it is an intentional gate or an unintended regression before changing it.
7. Do not call a chibi workflow ready until runnable helper output, generated prompt text, validators, and docs agree.
8. Do not let stale `.agent` files prove generation freshness.
9. Do not use post-split deterministic edits to create animation that imagegen did not author.
10. Do not move old candidate evidence until preflight proves a real output path for the new run.
11. Do not hand-normalize grouped state sheets; use the checked-in splitter with `--resize`.
12. Do not treat runtime walk slots as a demand for six major poses.
13. Do not approve from standalone sheets; judge the composed runtime scene.
14. Do not let candidate-only chibi proof state mutate app-facing or approved production state.
15. Do not treat replicated placeholder walk frames as real animation.
16. Do not omit recovered validation failures from handoff or evidence manifests.
