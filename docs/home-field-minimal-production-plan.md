# Home Field Minimal Production Plan

Date: 2026-05-26

This plan is the fastest path to a production-acceptable Home Field v1. The goal is not to finish every terrain family or every character animation. The goal is one coherent composed field that looks good enough on mobile and desktop, with simple natural grass, correctly scaled chibis, entrances, and a few props in the same style.

## Target Result

Deliver a candidate scene that can become the final Home Field baseline after human approval:

- simple green field with natural-looking repeat pattern;
- no obvious square tile pattern in mobile or desktop clean preview;
- `thalla` chibi present at correct top-down field scale, with one optional second chibi only after Thalla passes scene review;
- Arena and Journey entrances present;
- a small set of bushes, mushrooms, and foliage props present;
- all visible assets share camera, palette, outline weight, detail budget, and scale;
- app-facing `web/public/home-field` is untouched until explicit approval.

The primary proof is the composed field screenshot, not isolated asset beauty.

## Current Completion State

As of 2026-05-27, the minimal grass-first scene has been promoted as Home Field v1 after operator approval to continue the plan, with the character layer rolled back from approval:

- grass uses the `flat-minimal` fallback as a stable simple field baseline;
- scoped props/exits were produced under `.agent/home-field-workspace/candidates/object-layer/latest`, polished by `npm run game:home-field:polish-minimal-candidate`, and copied to `web/public/home-field`;
- `thalla` Stage 1 was produced under `.agent/home-field-workspace/candidates/chibi-active-roster/latest`, but the current tiny beige/pixel-sprite result is rejected by composed screenshot review because it does not match the agreed hand-drawn 2.5D chibi reference;
- the runtime map now uses only approved grass/props/exits and removes path, edge, signpost, lantern, tall-mushroom, effect, and unapproved chibi references from the v1 composed scene;
- path remains deferred as `needs_regen` because prior path-family candidates looked pasted onto grass;
- `npm run game:home-field:validate -- --production` is now the active-scene production gate for the promoted minimal non-character scene.

Thalla remains required for the final character-complete Home Field, but it is no longer approved for the current promoted active-scene scope. Do not use the current `web/public/home-field/characters/thalla/spritesheet.png` as a style reference except as a negative example.

Full-registry `npm run game:home-field:validate-full-registry-production` is still expected to fail until Thalla, the remaining roster, and the deferred path/edge/effect/funny-foliage assets are generated and explicitly approved.

## Minimal Asset Scope

Use this scope for the first production-looking candidate. Do not expand it during the run.

Terrain:

- `grass_base_01`
- `grass_base_02`
- `grass_flowers_01`
- `path_h_end_w`
- `path_dirt_straight`
- `path_spore_glow`
- `path_h_end_e`
- `path_destination_row`

Props and exits:

- `bush_cluster_dark_01`
- `bush_cluster_light_01`
- `leaf_sprout_01`
- `mushroom_cluster_small_amber`
- `mushroom_cluster_small_violet`
- `mushroom_cap_red_spotted`
- `fallen_branch_mycelium`
- `arena_mushroom_arch`
- `journey_gate_under_construction`

Character:

- `thalla` required
- optional second chibi: `lomie`, only after Thalla passes scene review and the run still has budget

Chibi style reference:

- Before regenerating Thalla, read [`docs/home-field-chibi-style-reference.md`](home-field-chibi-style-reference.md).
- The style reference now includes the extracted agent-log bitmap at [`docs/reference/home-field/chibi-style-agent-log-reference.png`](reference/home-field/chibi-style-agent-log-reference.png).
- Target the same kind of squat, bold, map-readable field-sprite proportions as the agent-log reference screenshot, but do not copy its characters or symbols.
- Avoid huge white portrait eyes; Thalla's face should be expressive but smaller-eyed, with canon black/fire-gold eye identity and stronger mushroom-elf sovereign silhouette.

Optional defer rule: if a scoped asset fails twice and is not required for scene readability, defer it instead of extending the run.

## Success Criteria

The run succeeds only if mobile and desktop clean screenshots look like one game scene.

Required visual bar:

- grass reads as quiet walkable ground, not wallpaper;
- chibi feet and shadow are readable over grass;
- entrances look like they belong to the same world as props and terrain;
- props read at mobile scale without 256px contact-sheet detail;
- path, if present, blends into grass without visible tile blocks;
- no asset looks like a separate renderer, camera angle, or zoom level.

If validators pass but the clean preview looks patched together, the candidate fails.

## Short Implementation Steps

Use this as the operator checklist. The orchestrator owns sequencing and may run the read-only review prompts in parallel with generation work, but promotion stays blocked until human approval.

1. Preflight.
   - Confirm `main`, clean tracked state, and `npm run game:home-field:validate`.
   - Start Prompt/Contract Reviewer before imagegen.
2. Generate the terrain baseline.
   - Grass/Path Worker generates grass first with `npm run game:home-field:rerun-grass-family`.
   - Produce the grass candidate with `npm run game:home-field:produce-grass-family-candidate`.
   - If `tight-center`, `lower-band`, and `upper-band` still show visible tile columns, use `npm run game:home-field:produce-grass-family-candidate -- --plan=unified-base`.
   - If the shared source itself still creates broad bands or edge columns, use `npm run game:home-field:produce-grass-family-candidate -- --plan=flat-minimal` for a simpler production-safe field baseline before regenerating the raw source.
   - Run a clean candidate preview. If grass shows square cells, fix grass before starting props/chibi.
3. Decide whether path helps.
   - Generate path only after grass is usable.
   - If path looks pasted after two attempts, defer path and continue with grass plus destination/entrance placement.
   - If path is deferred, keep `path_destination_row` only when it reads as a subtle grass-compatible landing; otherwise mark all path-family IDs deferred/`needs_regen`.
   - For grass-first preview evidence after deferring path, run composed screenshots with `HOME_FIELD_DEFER_PATH=1`; this hides path only in local candidate preview routing.
4. Run parallel asset workers.
   - Props/Entrances Worker generates only the scoped object-layer assets.
   - Chibi Worker generates only Thalla Stage 1 and must use `docs/home-field-chibi-style-reference.md`.
   - These may run in parallel after the grass baseline exists.
5. Produce and validate candidates.
   - Producer/Validation Worker writes candidate PNGs, proof sheets, evidence manifests, and clean screenshots.
   - Use `npm run game:home-field:combined-candidate-preview` as the primary scene proof.
6. Visual review and stop.
   - Visual Critic reviews the composed mobile/desktop screenshots first.
   - Mark rows `needs_review` or `needs_regen` only. For deferred assets, keep `verdict: "needs_regen"`, `accepted: false`, and start `reason` with `Deferred:`. Never approve or set `accepted: true`.
   - Final handoff must include clickable links to the candidate folder, evidence manifest, review sheets, and clean screenshots.

Fastest viable target: grass + Arena/Journey entrances + `bush_cluster_dark_01`, `bush_cluster_light_01`, `leaf_sprout_01`, `mushroom_cluster_small_amber`, `mushroom_cluster_small_violet`, `mushroom_cap_red_spotted`, `fallen_branch_mycelium`, and Thalla. Path and optional `lomie` are stretch items, not blockers for a coherent v1 candidate.

## Subagent Roles

Use subagents when available. No single role may generate and approve its own image.

### 1. Orchestrator

Owns scope, sequencing, and final handoff.

Must:

- confirm repo state and current `main`;
- read `docs/home-field-agent-flow.md`;
- keep the run candidate-only;
- prevent scope expansion;
- stop after human-review candidate evidence exists.

Must not:

- generate images;
- approve assets;
- promote to `web/public/home-field` without explicit human approval.

### 2. Prompt/Contract Reviewer

Read-only preflight.

Must check:

- minimal asset scope;
- candidate-only paths;
- shared-source grass and path rules;
- chibi Stage 1 contract;
- prop scale contract;
- final evidence commands.

Must report contradictions before imagegen starts.

### 3. Grass/Path Worker

Generates terrain raw sources only.

Grass:

- use `npm run game:home-field:rerun-grass-family`;
- save one shared meadow source;
- produce through `npm run game:home-field:produce-grass-family-candidate`;
- reject dense texture, square blocks, obvious grid rhythm, or flowers that become repeat markers.

Path:

- use `npm run game:home-field:rerun-path-family`;
- save one shared path source;
- produce through `npm run game:home-field:produce-path-family-candidate`;
- path is optional for v1 if it keeps looking pasted.

Fast stop rule:

- if path fails clean-preview blending twice, defer path and ship a grass-first scene candidate with a subtle destination landing only.

### 4. Props/Entrances Worker

Generates only the scoped props and exits as object-layer candidates.

Rules:

- broad silhouettes;
- low mobile detail;
- muted shared palette;
- compact shadows;
- transparent background;
- no full-scene illustrations;
- no prop that only looks good at 256px.

Use mobile readability and alpha/halo sheets before visual review.

### 5. Chibi Worker

Generates only `thalla` for Stage 1.

Rules:

- clear stale rejected `thalla_chibi.frame_*.source.png` raw files and stale chibi candidate output before regenerating;
- generate and visually check the non-production turnaround reference before final frames;
- top-down 2.5D field sprite, not portrait;
- simple mobile-readable silhouette with BJD-inspired chibi doll appeal;
- 8 unique poses minimum in the current compact 12-slot contract;
- no 32-frame full animation requirement yet;
- use `--resize`, not `--resize-nearest`, when producing the candidate sheet from larger isolated raw frames;
- mechanical alpha/readability success does not override style failure;
- keep Thalla simpler than the 2026-06-20 candidate: fewer cap/gold marks, one broad robe block, smooth doll-like face planes, tiny planted body;
- no roster expansion until Thalla passes scene review.

If Thalla fails twice, simplify Thalla and stop. Do not generate the rest of the roster. If Thalla passes and a second chibi is still needed for the scene, generate `lomie` only; keep the rest of the roster deferred.

### 6. Producer/Validation Worker

Runs only documented producer and proof commands.

Required evidence:

```bash
npm run game:home-field:candidate-preview
npm run game:home-field:terrain-candidate-preview
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/object-layer/latest HOME_FIELD_CANDIDATE_IDS=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01,mushroom_cluster_small_amber,mushroom_cluster_small_violet,mushroom_cap_red_spotted,fallen_branch_mycelium,arena_mushroom_arch,journey_gate_under_construction npm run game:home-field:object-candidate-preview
npm run game:home-field:chibi-candidate-preview
npm run game:home-field:combined-candidate-preview
```

For the full object/exit scope, use:

```bash
OBJECT_IDS=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01,mushroom_cluster_small_amber,mushroom_cluster_small_violet,mushroom_cap_red_spotted,fallen_branch_mycelium,arena_mushroom_arch,journey_gate_under_construction
npm run game:home-field:produce-object-candidate -- bush_cluster_dark_01 bush_cluster_light_01 leaf_sprout_01 mushroom_cluster_small_amber mushroom_cluster_small_violet mushroom_cap_red_spotted fallen_branch_mycelium arena_mushroom_arch journey_gate_under_construction --resize --chroma-key=#ff00ff
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=$OBJECT_IDS --check-files --check-alpha-halo --check-readability
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:mobile-readability-sheet -- --ids=$OBJECT_IDS
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:alpha-sheet -- --ids=$OBJECT_IDS
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/object-layer/latest HOME_FIELD_CANDIDATE_IDS=$OBJECT_IDS npm run game:home-field:candidate-evidence
```

For Thalla Stage 1, the legacy manifest `sourcePath` is not enough. Use the isolated raw frame files from `docs/home-field-chibi-candidate-contract.md`, then run:

```bash
npm run game:home-field:produce-chibi-candidate -- thalla --resize --chroma-key=#ff00ff
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-alpha-halo
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-readability
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:mobile-readability-sheet -- --ids=thalla
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:alpha-sheet -- --ids=thalla
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest HOME_FIELD_CANDIDATE_IDS=thalla npm run game:home-field:candidate-evidence
npm run game:home-field:chibi-candidate-preview
```

For the completed minimal scene candidate, run the polish pass after producing object/chibi candidates:

```bash
npm run game:home-field:polish-minimal-candidate
```

For the full composed scene, the default `npm run game:home-field:combined-candidate-preview` already routes the default latest grass, terrain, object-layer, and chibi candidate roots. If any worker uses non-default candidate folders, set `HOME_FIELD_CANDIDATE_ROOTS` and `HOME_FIELD_CANDIDATE_IDS` explicitly before running the combined preview.

Also run the relevant scoped validation commands:

- terrain file/connectors/review;
- edge profile and family cohesion for terrain;
- alpha halo and readability for props/chibi;
- candidate evidence manifests;
- contact, adjacency, alpha, and mobile-readability sheets.

Primary proof files:

- `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png`
- `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png`

### 7. Visual Critic

Reviews the composed scene first.

Must fail if:

- tile squares are visible;
- path or destination pad looks pasted onto grass;
- grass is too noisy for chibis;
- props or entrances are too detailed for mobile;
- chibi scale/camera is wrong;
- any asset family looks like a different renderer.

May mark `needs_review` only when the full scene feels coherent enough for human approval.

Must never set:

- `verdict: "approved"`;
- `accepted: true`.

## Recommended Execution Order

1. Grass candidate.
2. Combined preview with existing props/chibi placeholders.
3. Path candidate only if it improves the field.
4. Props and entrances micro-batch.
5. Thalla Stage 1 chibi.
6. Combined candidate preview with all selected candidate roots routed.
7. Visual Critic updates `docs/home-field-asset-review.json`.
8. Stop for human approval.

Do not promote app-facing assets during this plan.

## Ready-To-Run Delegation Prompts

Use these when the orchestrator can spawn subagents. Each prompt is bounded so workers do not expand scope.

### Prompt/Contract Reviewer

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, act as read-only Prompt/Contract Reviewer for the minimal Home Field production-candidate run.

Read docs/home-field-minimal-production-plan.md, docs/home-field-agent-flow.md, app/shared/home-field/home-field-assets.json, app/shared/home-field/home-field-prompts.json, and docs/home-field-chibi-candidate-contract.md.

Report contradictions or missing instructions only. Check candidate-only paths, minimal scope, shared-source grass/path rules, prop scale/readability rules, Thalla Stage 1 rules, subagent separation, and required final evidence. Do not edit files, generate images, approve assets, or run producers.
```

### Grass/Path Worker

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, act as Grass/Path Worker for the minimal Home Field production-candidate run.

Follow docs/home-field-minimal-production-plan.md and docs/home-field-agent-flow.md. Generate terrain candidates only under .agent/home-field-workspace. Start with grass only: run npm run game:home-field:rerun-grass-family, use imagegen for one shared meadow source, then run npm run game:home-field:produce-grass-family-candidate.

After grass preview evidence exists, generate the shared-source path family only if it improves the composed field. If path looks pasted after two attempts, defer path by keeping path rows at verdict needs_regen, accepted false, with reason beginning Deferred:. Do not touch web/public/home-field, do not approve assets, and include links to raw source, candidate folder, and clean preview screenshots in your handoff.
```

### Props/Entrances Worker

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, act as Props/Entrances Worker for the minimal Home Field production-candidate run.

Follow docs/home-field-minimal-production-plan.md, docs/home-field-agent-flow.md, and docs/home-field-scale-contract.md. Generate only these object-layer candidates: bush_cluster_dark_01, bush_cluster_light_01, leaf_sprout_01, mushroom_cluster_small_amber, mushroom_cluster_small_violet, mushroom_cap_red_spotted, fallen_branch_mycelium, arena_mushroom_arch, journey_gate_under_construction.

Use broad mobile-readable silhouettes, fewer segments, top-down 2.5D camera, muted shared palette, compact shadows, and transparent backgrounds. Produce only candidate outputs under .agent/home-field-workspace/candidates/object-layer/latest. Run alpha/halo and mobile-readability proof sheets. Do not edit web/public/home-field or approve assets.
```

### Chibi Worker

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, act as Chibi Worker for the minimal Home Field production-candidate run.

Follow docs/home-field-minimal-production-plan.md, docs/home-field-agent-flow.md, docs/home-field-chibi-candidate-contract.md, docs/home-field-chibi-style-reference.md, and docs/design-requirements.md. Generate Thalla Stage 1 only: elevated top-down 2.5D hand-drawn field sprite, simple 64px runtime read, 8 unique poses minimum in the compact 12-slot contract, no 32-frame full animation.

Create a non-production turnaround reference first, then isolated transparent raw frames. Target a simple BJD-inspired chibi doll illustration: smooth doll-like face, tiny planted body, broad costume block, and very few large Thalla marks. Reject pixel-art, tiny featureless doll-sprite, beige generic elf, busy ornate fantasy sprite, straight portrait, realistic doll-photo/toy-render, or human-with-mushroom-hat results. Produce only candidate outputs under .agent/home-field-workspace/candidates/chibi-active-roster/latest. Do not generate the roster or optional lomie unless Thalla passes scene review and the orchestrator explicitly asks.
```

### Producer/Validation Worker

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, act as Producer/Validation Worker for the minimal Home Field production-candidate run.

Follow docs/home-field-minimal-production-plan.md and docs/home-field-agent-flow.md. Convert raw outputs into candidate folders only, generate proof sheets, run scoped validators, and create evidence manifests. Required scene proof is npm run game:home-field:combined-candidate-preview.

Do not hand-edit PNGs, change contracts, overwrite web/public/home-field, or approve art. Final handoff must list candidate folder, evidence manifest, contact sheet, adjacency sheet, alpha/halo sheet, mobile-readability sheet, and mobile/desktop clean screenshots as clickable links.
```

### Visual Critic

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, act as Visual Critic for the minimal Home Field production-candidate run.

Review the composed mobile and desktop clean screenshots first, then supporting contact/adjacency/alpha/readability sheets and evidence manifests. Fail visible square terrain cells, pasted path bands, noisy grass, wrong chibi camera/scale, over-detailed mobile props, mismatched entrances, or mixed renderer styles.

Update only docs/home-field-asset-review.json rows for the active batch with needs_review or needs_regen. Encode deferral as verdict needs_regen, accepted false, and reason beginning Deferred:. Never set verdict approved or accepted=true without explicit human approval.
```

## Decision Rules

Use these rules to keep the run short.

- Grass fails twice: simplify grass further, remove flower emphasis, and regenerate one more shared source.
- Path fails twice: defer path; a coherent grass-first field is better than a patchy path field.
- Prop fails twice: defer that prop unless it is an entrance.
- Entrance fails twice: keep the best candidate as `needs_review` only if scale/style are acceptable; otherwise mark `needs_regen`.
- Thalla fails twice: simplify the chibi; do not expand the roster.
- Thalla passes and a second chibi is needed: generate `lomie` only, then stop.
- Any visible square tile boundary in clean preview: fail `cleanPreviewCheck`.
- Any candidate that needs explanation to look correct on mobile: fail.

## Final Handoff Requirements

The final response from the run must include clickable Markdown links to:

- candidate folder;
- candidate evidence manifest;
- contact sheet;
- adjacency sheet;
- alpha/halo sheet if props/chibi are included;
- mobile readability sheet if props/chibi are included;
- mobile clean field screenshot;
- desktop clean field screenshot.

It must also state:

- app-facing `web/public/home-field` was or was not changed;
- which assets are `needs_review`, `needs_regen`, or deferred via a `Deferred:` reason;
- whether the scene is ready for human approval.

## Recommended Short Run Prompt

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the minimal Home Field production-candidate plan with subagents. Follow docs/home-field-minimal-production-plan.md and docs/home-field-agent-flow.md exactly.

Goal: one coherent candidate scene, not perfect isolated tiles. Candidate-only: do not overwrite web/public/home-field, do not approve assets, do not set accepted=true.

Use minimal scope only: grass_base_01, grass_base_02, grass_flowers_01, optional path family, bush_cluster_dark_01, bush_cluster_light_01, leaf_sprout_01, mushroom_cluster_small_amber, mushroom_cluster_small_violet, mushroom_cap_red_spotted, fallen_branch_mycelium, arena_mushroom_arch, journey_gate_under_construction, thalla. Generate optional lomie only after Thalla passes scene review.

Prioritize clean mobile/desktop composed field screenshots. If path looks pasted after two attempts, defer path and proceed with grass-first scene. Visual Critic must review final combined evidence and fail visible tile squares.

Final response must include clickable links to candidate folder, evidence manifest, review sheets, and mobile/desktop clean field screenshots.
```
