# Home Field Minimal Production Plan

Date: 2026-05-26

This plan is the fastest path to a production-acceptable Home Field v1. The goal is not to finish every terrain family or every character animation. The goal is one coherent composed field that looks good enough on mobile and desktop, with simple natural grass, correctly scaled chibis, entrances, and a few props in the same style.

## Target Result

Deliver a candidate scene that can become the final Home Field baseline after human approval:

- simple green field with natural-looking repeat pattern;
- no obvious square tile pattern in mobile or desktop clean preview;
- `thalla` chibi present at correct top-down field scale;
- Arena and Journey entrances present;
- a small set of bushes, mushrooms, and foliage props present;
- all visible assets share camera, palette, outline weight, detail budget, and scale;
- app-facing `web/public/home-field` is untouched until explicit approval.

The primary proof is the composed field screenshot, not isolated asset beauty.

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

- `thalla`

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

- top-down 2.5D field sprite, not portrait;
- simple mobile-readable silhouette;
- 8 unique poses minimum in the current compact 12-slot contract;
- no 32-frame full animation requirement yet;
- no roster expansion until Thalla passes scene review.

If Thalla fails twice, simplify Thalla and stop. Do not generate the rest of the roster.

### 6. Producer/Validation Worker

Runs only documented producer and proof commands.

Required evidence:

```bash
npm run game:home-field:candidate-preview
npm run game:home-field:terrain-candidate-preview
npm run game:home-field:object-candidate-preview
npm run game:home-field:chibi-candidate-preview
npm run game:home-field:combined-candidate-preview
```

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
6. Combined candidate preview with all accepted candidates routed.
7. Visual Critic updates `docs/home-field-asset-review.json`.
8. Stop for human approval.

Do not promote app-facing assets during this plan.

## Decision Rules

Use these rules to keep the run short.

- Grass fails twice: simplify grass further, remove flower emphasis, and regenerate one more shared source.
- Path fails twice: defer path; a coherent grass-first field is better than a patchy path field.
- Prop fails twice: defer that prop unless it is an entrance.
- Entrance fails twice: keep the best candidate as `needs_review` only if scale/style are acceptable; otherwise mark `needs_regen`.
- Thalla fails twice: simplify the chibi; do not expand the roster.
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
- which assets are `needs_review`, `needs_regen`, or deferred;
- whether the scene is ready for human approval.

## Recommended Short Run Prompt

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the minimal Home Field production-candidate plan with subagents. Follow docs/home-field-minimal-production-plan.md and docs/home-field-agent-flow.md exactly.

Goal: one coherent candidate scene, not perfect isolated tiles. Candidate-only: do not overwrite web/public/home-field, do not approve assets, do not set accepted=true.

Use minimal scope only: grass_base_01, grass_base_02, grass_flowers_01, optional path family, bush_cluster_dark_01, bush_cluster_light_01, leaf_sprout_01, mushroom_cluster_small_amber, mushroom_cluster_small_violet, mushroom_cap_red_spotted, fallen_branch_mycelium, arena_mushroom_arch, journey_gate_under_construction, thalla.

Prioritize clean mobile/desktop composed field screenshots. If path looks pasted after two attempts, defer path and proceed with grass-first scene. Visual Critic must review final combined evidence and fail visible tile squares.

Final response must include clickable links to candidate folder, evidence manifest, review sheets, and mobile/desktop clean field screenshots.
```
