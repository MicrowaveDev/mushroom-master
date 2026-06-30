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
- if the operator confirms a discoverable built-in output path, set `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` for that run only; for current Thalla proof art, also require `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` only when the generation call can attach the checked-in PNGs as image inputs.

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

### 24. Preflight Ran After Expensive Setup

**Symptom:** A run correctly stopped when `preflight-chibi-proof` failed, but only after spawning multiple subagents, reading the full chibi/reference/runtime doc stack, viewing reference images, and printing the full prompt. No imagegen ran and no files changed, yet the clean block still took minutes.

**Decision that led there:** The run prompt listed subagent setup and full source-doc reads before the preflight gate. That ordering made sense when preflight was treated as a stale-file cleanup guard, but it was wasteful once preflight also became the output-capability gate.

**Why it regressed:** If the environment cannot produce a real PNG at a known path, no downstream producer, validator, visual critic, or handoff work can produce fresh evidence. Late preflight turns a cheap capability check into a full blocked run.

**Evidence:** In the 2026-06-24 pre-requirements rollout `codex-019efaae-8345-75e0-9f3f-e7d5387808f3`, the user explicitly said to stop if preflight fails at line `7`. The run spawned four subagents at lines `24`, `26`, `28`, and `30`, read the full doc stack at lines `54`-`60`, and viewed reference images at lines `80`-`81` before running preflight at line `93`. Task-complete line `111` then reported the intended blocker: no allowed PNG output path and no fresh candidate generated.

**Guardrails added:**

- `docs/home-field-imagegen-requirements.md` now says family preflight is the first expensive gate;
- `RUN_CHIBI_PROOF_PROMPT.md` runs `chibi-proof-context` and `preflight-chibi-proof` before spawning subagents or reading the full reference stack;
- `docs/home-field-agent-flow.md` treats a failed preflight as a clean stop, not work for generation/review sidecars.

### 25. Clean Preflight Block Had No Built-In Output Probe

**Symptom:** After moving preflight to the front, the next run stopped correctly but had no bounded way to answer the real operational question: whether Codex Desktop built-in imagegen could leave a discoverable PNG in that same agent context.

**Decision that led there:** The stricter workflow treated any failed preflight as a final clean stop. That protected stale candidates, but it also prevented the only cheap proof that could confirm `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` without starting Thalla candidate work.

**Why it regressed:** "Do not attempt imagegen before preflight" was too broad. Candidate/reference imagegen must wait, but a tiny diagnostic non-candidate built-in output probe is the least expensive way to prove or disprove the built-in output path. Without that exception, every built-in-only environment dead-ends until the operator manually supplies local PNGs or CLI credentials.

**Evidence:** In the 2026-06-26 rollout `codex-019f05aa-2eb3-7511-9515-7425f3540e7f`, the agent stated it would run only the proof context and preflight at line `19`, ran preflight at line `24`, got the unconfirmed-output failure at line `26`, and finaled at line `28` with no imagegen, no stale-file archive, and no mutation. That was correct by the prompt, but incomplete as an agent workflow.

**Guardrails added:**

- `docs/home-field-imagegen-requirements.md` allows exactly one same-context diagnostic built-in output probe when the only blocker is unconfirmed built-in disk output;
- the probe must be tiny, non-candidate, not Thalla/reference/state-sheet art, and must not mutate `.agent` candidate evidence;
- agents must immediately run `npm run game:home-field:find-imagegen-output -- --since-minutes=5`, count only files newer than the probe start, and use `--include-temp` only once;
- agents may rerun preflight with `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` after the bounded locator finds a file; for current Thalla proof art, preflight must still stop unless `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` is also truthfully confirmed.

### 26. Palette Bloat Kept The Sprite In Sticker Territory

**Symptom:** A mechanically valid 2026-06-26 Thalla candidate still did not feel production-ready. Developer feedback was blunt: "Palette is too large. It needs fewer than 20 colors."

**Decision that led there:** Prompts asked for restrained palette, simple silhouette, and BJD-inspired chibi appeal, but they did not give a hard color-count budget. Imagegen filled softness and identity with many near-neighbor cream, beige, blush, gold, and shadow tones.

**Why it regressed:** The chibi validator can catch weak contrast and alpha problems, but it does not know the difference between a compact sprite palette and a soft illustration palette. At `64px`, extra colors reduce shape clarity and make the character feel like a sticker pasted among chunkier Home Field props.

**Guardrails added:**

- `docs/home-field-chibi-candidate-contract.md` now requires `12-18` artist-visible colors and fewer than `20` total design colors, excluding transparency and chroma-key;
- `docs/home-field-chibi-style-reference.md` records the palette research and the 2026-06-26 palette-bloat rejection;
- the run prompt and generated Thalla prompt now tell imagegen to use shared cap/robe/skin/gold ramps instead of many near-duplicate tones.

### 27. Palette Overcorrection Lost The Previous Better Direction

**Symptom:** The stopped 2026-06-28 rerun was visibly worse than the previous 2026-06-26 run. The first new reference was rejected for palette bloat, but the second reference overcorrected into a large flat anime/fashion turnaround with earrings and less field-sprite charm. The first grouped state sheet then baked dark foot ovals into every frame.

**Decision that led there:** The agent correctly treated the `<20` visible-color rule as a hard gate, but improvised prompt language such as "flat limited-palette game sprite art", "hard-edged cel shading", and "exactly 16 visible swatches" without anchoring strongly enough to the previous better sheet.

**Why it regressed:** The prompt optimized the easiest measurable requirement, palette reduction, while weakening the more subjective requirement: preserve compact Thalla charm from the previous better state sheet. A limited palette should constrain color choices, not change the renderer into hard pixel art, vector/cel icon art, or a large standalone character-design turnaround.

**Guardrails added:**

- `docs/reference/home-field/chibi-thalla-previous-best-2026-06-26-state-sheet.png` now stores the previous better grouped sheet as a checked-in positive direction, with caveats;
- `docs/home-field-chibi-style-reference.md` names the 2026-06-28 overcorrection as a negative example and says to preserve the 2026-06-26 compact charm while fixing palette/ornament;
- the contract, run prompt, and generated Thalla prompt now reject hard pixel/vector/cel overcorrection, earrings/jewelry/fashion-turnaround drift, and baked foot ovals.

### 28. Regal Language Reintroduced Ornament Drift

**Symptom:** The 2026-06-28 reference-gate rerun after the previous-best prompt tightening stopped correctly at the reference gate, but the generated reference still failed. It restored some compact chibi charm and avoided hard pixel/cel overcorrection, yet "sovereign/regal" drifted into a crown-like forehead gem, chest medallion, ornate trim, painterly cap/body texture, and too many visible beige/gold tones.

**Decision that led there:** The reference prompt banned earrings, jewelry clusters, and ornate filigree, but still described Thalla as a sovereign with regal biostasis authority. That gave imagegen a loophole to express status with jewelry-like regalia instead of simple field-sprite silhouette.

**Why it regressed:** For a `64px` map chibi, status markers must be large silhouette and posture cues. Even a single central gem or medallion pulls the design toward a soft showcase turnaround and spends the tiny palette budget on extra gold/blush/brown ramps.

**Guardrails added:**

- `npm run game:home-field:next-chibi-proof` now prints a copyable reference prompt so agents do not hand-compose this fragile prompt;
- Thalla's prompt, contract, style reference, and run prompt now say to represent sovereignty through cap silhouette, robe blocks, posture, and `1-2` flat mycelium/spore marks only;
- crown jewels, forehead gems, brooches, chest medallions, pendants, jewelry-like cap crests, gold filigree, ornamental regalia, and decorative trim clusters are explicit rejection signals.

### 29. Exact Prompt Still Produced Showcase References

**Symptom:** The 2026-06-28 run from rollout `codex-019f1023-2a48-76f2-847d-bc0f96aaf5f0` followed the exact copyable reference prompt and stopped safely at the reference gate, but all three reference attempts still failed. They restored some compact chibi direction, yet remained large showcase turnarounds with painterly beige/gold palettes, cap/body texture, medallion/brooch-like details, robe trim, and repeated gold badges.

**Decision that led there:** After the previous run, the prompt added stronger bans and made agents use the exact helper-printed prompt. That fixed prompt paraphrase drift, but the helper prompt still used loaded words such as "sovereign", "sacred", "regal", and "turnaround sheet" without forcing a miniature source-sprite scale.

**Why it regressed:** Imagegen obeyed the broad concept more than the negative list. Royal/regalia words and large turnaround composition cues pulled the image toward character-design showcase art; once the figure is large, the model fills it with painterly texture and ornament even while nominally avoiding some named jewelry items.

**Guardrails added:**

- the copyable reference prompt now asks for a tiny sprite-scale reference sheet, generous empty magenta space, and `64px` readability first;
- imagegen-facing wording uses "field-sprite leader" / "calm biostasis stillness" instead of repeating royal/regalia triggers;
- status markers are expanded to reject royal regalia, robe borders, clasps, collar jewels, and repeated gold badges;
- after two exact-prompt reference attempts fail the same palette/style/status gate, the run must stop and report instead of burning more blind retries.

### 30. Miniature Prompt Still Drew Anime Reference Art

**Symptom:** The 2026-06-28 run from rollout `codex-019f1042-1bb8-7831-8a2b-0e5b4c746c02` followed the tightened exact prompt, used the new two-attempt stop rule, and did not create final frames or app-facing output. Both reference attempts improved over the previous showcase sheets, but still failed the reference gate: glossy anime/chibi eyes, visible hair or wig under a mushroom cap, quadrant-filling character art, soft cream/gold palette bloat, scalloped collar/robe trim, sleeve/cuff trim, and repeated gold status marks.

**Decision that led there:** The previous fix removed royal/regalia wording and asked for miniature sprite-reference views, but the prompt still let the model draw polished character-turnaround art inside a high-resolution canvas. "BJD-inspired chibi" and "turnaround sheet" still invited anime face polish and costume detailing unless the face, biology, scale, and costume-detail budgets are spelled out.

**Why it regressed:** Text-only imagegen tends to spend unused canvas/detail budget on attractive character-sheet features. Negative lists reduced the worst regalia, but did not explicitly say that each view should behave like a tiny `96x96` source-sprite box, that the cap is biology rather than a hair-covered hat, or that eyes must be small seed/dot features rather than glossy anime eyes.

**Guardrails added:**

- the copyable reference prompt now asks for tiny source-sprite views with most of the sheet left as empty `#ff00ff`, not quadrant-filling character art;
- face budget now says small dark seed/dot eyes with only a tiny gold life glint, no glossy anime eyes or eyelashes;
- biology language now rejects hair/wig under a mushroom cap and says the cap is part of the character, not a removable hat;
- costume/detail budget now rejects scalloped collars, sleeve cuff trim, and repeated status marks in addition to earlier regalia bans.

### 31. Tightened Text-Only Prompt Still Failed

**Symptom:** The 2026-06-28 run from rollout `codex-019f105b-b55a-7ad0-9f8d-38903fdf7999` followed the fully tightened exact prompt, stated the palette/style/scale-face-biology/status plans, made two exact-prompt attempts, and stopped correctly at the reference gate. Both attempts still failed: figures were roughly `250-296px` wide by `337-358px` tall inside a `1536x1024` sheet, read as oversized character-turnaround art, used soft cream/gold palette bloat, had anime/portrait eyes, hair or wig under the cap, repeated cap/robe gold marks, and robe/collar/cuff trim.

**Decision that led there:** We kept trying to solve a visual-generation mode problem with more text-only negative prompting. The prompt now named the right constraints, but the model still spent the available high-resolution reference canvas on polished chibi illustration defaults.

**Why it regressed:** A standalone text-only turnaround sheet is a bad affordance for this target. The model treats it as a character design sheet even when told "source sprite", while the desired output is a small runtime sprite anchored by already checked-in positive images. The checked-in 2026-06-26 previous-best sheet carries the useful proportions better than prose does.

**Guardrails added:**

- current Thalla reference generation must be image-guided from checked-in PNG references, not another text-only attempt;
- the helper now tells agents to attach `chibi-thalla-previous-best-2026-06-26-state-sheet.png`, `chibi-thalla-liked-2026-06-23.png`, and `chibi-style-agent-log-reference.png` as actual image inputs before imagegen;
- if the active imagegen path cannot attach those PNGs to the generation call, the run must stop and report that image-guided generation is required;
- repeated same-gate failures after image-guided attempts still stop after two tries.

### 32. Image-Guided Prompt Still Produced Oversized Turnaround Art

**Symptom:** The 2026-06-29 run from rollout `codex-019f140b-07a4-7e10-85e1-f64c9d8a0bdb` followed the image-guided workflow: it loaded the checked-in previous-best, liked Thalla, and style-reference PNGs; made two exact-prompt built-in imagegen attempts; claimed the generated PNGs; mechanically verified the saved reference; and stopped correctly at the reference gate. Both generated references still failed: the figures were large polished turnaround characters instead of tiny `96x96` source-sprite views, the palette stayed bloated with many cream/beige/gold/blush tones, cap and robe shading stayed painterly, side shapes still risked hair/wig reads, and repeated gold cap/robe marks returned.

**Decision that led there:** We treated "visible reference images loaded before imagegen" plus the tightened exact prompt as enough to change the model's output mode. The prompt still called the result a turnaround sheet and left enough canvas/detail ambiguity for the model to create attractive high-resolution character-sheet art.

**Why it regressed:** The active built-in imagegen path may have seen the references, but the output still optimized for a polished character turnaround rather than a sprite extraction guide. This proves that even viewed references are not a durable control unless the actual generation call binds the inputs and the prompt also pins figure occupancy and sheet layout to small sprite boxes.

**Evidence:** Rollout `/Users/microwavedev/workspace/microwave-hub/agent-viewer/temp/codex-019f140b-07a4-7e10-85e1-f64c9d8a0bdb-rollout-2026-06-29T16-41-35-019f140b-07a4-7e10-85e1-f64c9d8a0bdb.jsonl` loaded the three reference images at lines `83`-`85`, generated the first and second references at lines `115` and `131`, claimed the second reference at line `135`, and received a visual-critic failure at line `170`. The saved reference was `.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png`, `1774x887`, sha256 `0c1d8d4993b270040a2802b737ac211b7e67b9d3eca37bb51d46a90b7204a9b6`.

**Guardrails added:**

- the copyable reference prompt now calls the output a sprite-box reference sheet rather than a conventional turnaround sheet;
- layout now requires four tiny invisible `96x96` source-sprite boxes, each character staying inside its box, with at least `70%` empty `#ff00ff` sheet space;
- the 2026-06-29 image-guided attempts are a negative example for large painterly turnaround figures;
- another run should not repeat the old image-guided turnaround prompt unchanged; if the sprite-box prompt still fails twice, stop and change generation method or ask for explicit user direction instead of continuing blind retries.

### 33. Viewed Reference Images Were Not Bound Imagegen Inputs

**Symptom:** The later 2026-06-29 run from rollout `codex-019f1482-8954-7b52-9f75-b377cf957645` used the new sprite-box wording and again followed the stop rule. The output improved its empty magenta space, but both reference attempts still failed the same gate: figures were about `149-166px` wide by `207-222px` tall in a `1254x1254` sheet, not tiny `96x96` source-sprite boxes; the background was not clean flat `#ff00ff`; palette/style remained soft and over-toned; hair/wig reads and cap/robe status ornament remained.

**Decision that led there:** The workflow treated `view_image` calls plus prompt text saying "use the visible checked-in reference images" as image-guided generation. The imagegen call itself did not prove that the PNGs were attached as actual image inputs.

**Why it regressed:** "Visible to the agent" and "bound to the imagegen request" are different capabilities. The active built-in path had confirmed file output, but not confirmed reference-image input binding. More prompt wording could not reliably fix a tool-capability gap.

**Evidence:** Rollout `/Users/microwavedev/workspace/microwave-hub/agent-viewer/temp/codex-019f1482-8954-7b52-9f75-b377cf957645-rollout-2026-06-29T18-52-07-019f1482-8954-7b52-9f75-b377cf957645.jsonl` generated attempt 1 at line `116` and attempt 2 at line `171`. The Visual Critic at line `211` failed the live reference for sprite-box occupancy, palette/style, hair/cap biology, and status ornament. The live reference path was `.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png`, `1254x1254`, sha256 `f848fe4d01ff7d43bd7c4caa8e7c2a8ebc90206bbcbed1b596e41e50dc0d1c06`.

**Guardrails added:**

- preflight now treats built-in imagegen as ready only when both disk output and reference-image input binding are explicitly confirmed;
- `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` proves file capture only, not image guidance;
- `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` may be set only when the actual imagegen call can attach the checked-in PNGs as image inputs from the same agent context;
- docs and generated helper output now say `view_image` plus text prompt references is not image-guided generation;
- future runs should stop at preflight unless they have a real reference-capable imagegen path, supplied local source PNG inputs, or explicit reference-capable CLI fallback.

### 34. Disk-Output Probe Ran Without Reference Binding

**Symptom:** The 2026-06-30 run from rollout `codex-019f161e-558d-73c3-ac5f-20f094622363` followed the early preflight gate and correctly produced no Thalla candidate, but it still ran one built-in diagnostic blue-square imagegen probe after preflight reported both built-in disk output and built-in reference-input binding were unconfirmed.

**Decision that led there:** The executable preflight failure text still said "If built-in imagegen is the intended path, run one tiny diagnostic" even when the missing blocker was reference-image input binding. The agent reasonably followed that helper output and spent one imagegen call proving disk capture.

**Why it regressed:** The disk probe proves only `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1`. It cannot prove `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1` and cannot make current Thalla proof art legal by itself. After regression 33, reference binding is the higher-priority gate.

**Evidence:** Rollout `/Users/microwavedev/workspace/microwave-hub/agent-viewer/temp/codex-019f161e-558d-73c3-ac5f-20f094622363-rollout-2026-06-30T02-21-54-019f161e-558d-73c3-ac5f-20f094622363.jsonl` failed preflight at line `29` with both built-in confirmations missing, generated the diagnostic blue square at lines `35`-`36`, located it at line `39`, and stopped cleanly at line `45`.

**Guardrails added:**

- the built-in output probe is now allowed only when reference-image input binding is already confirmed and disk output is the remaining blocker;
- preflight now says not to run the diagnostic when reference binding is unavailable because it proves file capture only;
- context/helper output and docs now repeat that a missing reference-capable path is a clean stop before any imagegen call.

### 35. Reference-Bound Built-In Imagegen Still Failed The Style Gate

**Symptom:** The 2026-06-30 run from rollout `codex-019f1a06-dd6d-78d3-9d13-212a7f67232a` passed preflight with both `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` and `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`, made two reference attempts, claimed both PNG outputs, then correctly stopped at the reference gate. The live reference preserved some compact charm and magenta spacing, but still failed for hair/wig-like locks under the mushroom cap, glossy anime eyes, ornamental/status detail, and polished character-turnaround styling. Developer palette feedback compared Aseprite palette captures from the earlier better direction and this run, plus a cleanup made with a Tetro/Retro-style diffusion tool.

**Decision that led there:** After fixing the file-output and reference-binding gates, the workflow tried the same exact sprite-box prompt again through built-in imagegen. The prompt now had the right negative constraints, but the generator still interpreted the concept as a polished chibi character sheet.

**Why it regressed:** Actual reference binding fixed the provenance/tooling problem, not the art-mode problem. Palette cleanup can reduce dominant colors, but it cannot by itself fix semantic failures such as hair under a biological cap, glossy eyes, status jewelry, or large turnaround proportions. The workflow also had no palette-audit helper, so palette discussion depended on visual screenshots rather than a repeatable report.

**Evidence:** The live reference was `.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png`, `1536x1024`, sha256 `d10b313024a1f43eff547126fbb34374bd0f11d3eb5dea4bc6332ce52a678194`. Claim manifest: `.agent/home-field-workspace/manifests/imagegen-claim-2026-06-30T19-47-01-589Z.json`. The developer palette/cleanup attachments are now stored as `docs/reference/home-field/chibi-thalla-palette-before-2026-06-30.png`, `docs/reference/home-field/chibi-thalla-palette-after-2026-06-30.png`, and `docs/reference/home-field/chibi-thalla-retro-cleaned-2026-06-30.png`.

**Guardrails added:**

- `docs/home-field-chibi-palette-cleanup-research.md` now records palette measurements, cleanup-tool findings, and the checked-in palette-audit helper workflow;
- docs now say palette cleanup is diagnostic even when the dedicated palette-audit evidence exists;
- cleanup or quantization must not override the biology/style gate;
- `npm run game:home-field:palette-audit -- <png>` reports exact significant colors, coarse visible bins, top colors, and a swatch PNG before treating a chibi as palette-reviewed; chibi candidate evidence now requires the reference, state-sheet, and candidate palette audit artifacts and rejects stale audit source hashes.

### 36. Fresh Launcher Lost Built-In Imagegen Capability Confirmation

**Symptom:** The 2026-06-30 run from rollout `codex-019f1a45-38fe-7552-997d-d63073e2127f` produced no production-ready image because it never reached imagegen. It followed the short launcher prompt, ran `chibi-proof-context` and `preflight-chibi-proof`, then stopped with built-in disk save unconfirmed, built-in reference-image input binding unconfirmed, `OPENAI_API_KEY` missing, and no local image inputs supplied.

**Decision that led there:** The launcher prompt stayed minimal and pointed to `RUN_CHIBI_PROOF_PROMPT.md`, while the capability proof lived only in shell environment variables (`HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` and `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`) or prior chat context. A fresh Codex session did not inherit those confirmations.

**Why it regressed:** The stricter preflight gate was correct, but the launcher did not carry the operator's current built-in-imagegen capability assertion into the new session. The result was a clean but unproductive one-minute run: safe for files, wrong for the user's goal of another production-ready attempt.

**Evidence:** Rollout `/Users/microwavedev/workspace/microwave-hub/agent-viewer/temp/codex-019f1a45-38fe-7552-997d-d63073e2127f-rollout-2026-06-30T21-42-52-019f1a45-38fe-7552-997d-d63073e2127f.jsonl` used the old short launcher at line `6`, failed preflight at line `27` with both built-in confirmations missing, and finaled at line `33` with no reference generation, no state sheet, no candidate, no palette audit, and no app-facing overwrite.

**Guardrails added:**

- the `RUN_CHIBI_PROOF_PROMPT.md` launcher now includes the built-in imagegen capability assertion and tells the agent to set both `HOME_FIELD_BUILTIN_IMAGEGEN_*` flags for proof helper commands;
- `docs/home-field-imagegen-requirements.md` records that fresh Codex sessions do not inherit shell env or prior chat confirmations;
- `chibi-proof-context` prints the built-in env prefix as a first-class run note;
- the generated chibi next-prompt helper prints the same preflight env prefix when built-in imagegen is the intended path;
- preflight failure text now says to rerun with both flags when the launcher/user explicitly confirmed built-in save plus reference-image input support for the same session.

### 37. Sprite-Box Prompt Still Produced Enlarged Showcase Reference

**Symptom:** The 2026-06-30 run from rollout `codex-019f1a52-783f-7501-aa16-5cc88709aacf` used the fixed launcher, passed preflight with both built-in imagegen confirmations, attached the three checked-in reference PNGs, and made two exact-prompt built-in reference attempts. Both attempts saved and passed the old reference file verifier, but both failed the reference gate. The live second attempt was a `1536x1024` sheet with four enlarged chibi turnaround figures, hair/wig-like side locks, glossy eyes, repeated gold cap marks, robe/cap ornament, and a bloated cream/gold palette (`82` significant exact colors, `51,319` exact RGBs).

**Decision that led there:** The reference verifier only proved the PNG existed and was readable. The prompt said "96x96 source-sprite boxes", but nothing mechanical rejected a high-resolution showcase sheet whose empty-magenta percentage looked acceptable while the visible sprite blobs were far larger than the source-sprite contract.

**Why it regressed:** Reference binding solved the provenance/tooling problem, not the composition problem. Empty magenta coverage alone is a weak proxy: a huge canvas with four oversized figures can still have high magenta coverage. The run correctly stopped after two same-gate failures, but it spent two generation attempts before the same scale problem was caught visually.

**Evidence:** Rollout line `7` used the fixed launcher with both `HOME_FIELD_BUILTIN_IMAGEGEN_*` flags. Lines `37`-`38` passed preflight. Lines `126`-`131` generated and claimed attempt 1 (`a64817139ceb4dd22c4d5265e26c58222bab85bbae26123a8c16e140e2e74364`), then line `134` failed palette audit with `71` significant exact colors. Lines `152`-`160` generated, claimed, and palette-audited attempt 2 (`b704667200f10bc47a544934ab290ba2f4283d56540b29ab2a5cea56d11d5cd4`) with `82` significant exact colors and `51,319` exact RGBs. Lines `194` and `199` show independent Visual Critic and Validator stop-gate agreement; final line `213` reports no grouped state sheet, split frames, candidate, evidence, preview, verdict, or app-facing overwrite.

**Guardrails added:**

- the copyable sprite-box reference prompt now asks for a compact source sheet around `512x384` or smaller, explicitly rejects a `1536x1024` showcase canvas, and says the visible character blob should stay roughly `64-96px` tall;
- `verify-chibi-proof-files -- --reference` now decodes the PNG, excludes transparent/hot-magenta background, finds major non-magenta connected blobs, and rejects blobs larger than the `128x128px` tolerance for the `96x96` sprite-box contract;
- the chibi contract, agent flow, and run prompt now state that high magenta coverage does not compensate for oversized sprite occupancy.

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
17. Do not spend generation/review setup before the image-output preflight proves a real PNG path is available.
18. Do not confuse the one-shot built-in output probe with candidate generation; it proves file capture only.
19. Do not accept a chibi that looks like it uses more than `20` visible design colors; palette bloat is a style failure even if mechanical validators pass.
20. Do not fix palette bloat by changing the renderer into hard pixel art, flat vector/cel/anime art, or a large fashion turnaround. Preserve the previous-best compact field-sprite charm while reducing palette and detail.
21. Do not let "sovereign", "regal", or "gold-white" become jewelry/regalia. For Thalla chibis, sovereignty must read through silhouette, posture, robe blocks, and `1-2` flat mycelium/spore marks only.
22. Do not keep retrying the exact same reference prompt after repeated same-cause reference-gate failures. Fix the persisted prompt/helper or stop for review.
23. Do not let "miniature reference" be interpreted as a polished anime character sheet. Thalla reference attempts must keep tiny source-sprite occupancy, small seed/dot eyes, cap-as-biology, and a plain robe block before any final state-sheet generation.
24. Do not run more text-only Thalla reference attempts after rollout `codex-019f105b-b55a-7ad0-9f8d-38903fdf7999`. Use the checked-in reference PNGs as actual image inputs to imagegen, or stop and ask for a reference-capable generation path.
25. Do not repeat the pre-2026-06-29 image-guided turnaround prompt unchanged. The reference prompt must behave like a sprite-box extraction guide with tiny `96x96` occupancy and mostly empty magenta space; if that still fails twice, change the generation method or ask for explicit user direction.
26. Do not call a Thalla run image-guided unless the actual imagegen request can attach the checked-in PNGs as image inputs. `view_image` and prompt text are not enough.
27. Do not run the built-in disk-output diagnostic probe when reference-image input binding is unavailable. The probe proves file capture only and cannot unblock current Thalla proof art.
28. Do not treat palette cleanup, quantization, or a Retro/Tetro-style diffusion pass as approval. It must pass the same cap biology, eye scale, ornament, source-sprite occupancy, and composed field-style gates, and palette compliance needs a repeatable audit rather than only screenshots.
29. Do not rely on env vars or capability confirmations from a previous Codex thread. If built-in imagegen is the intended path, the fresh launcher must carry the confirmation and helper commands must run with both `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_SAVE=1` and `HOME_FIELD_BUILTIN_IMAGEGEN_CAN_USE_REFERENCES=1`.
30. Do not accept a sprite-box reference because it has high empty-magenta coverage alone. The visible non-magenta character blobs must stay near source-sprite scale; oversized `1536x1024` showcase sheets fail before any final grouped state-sheet generation.
