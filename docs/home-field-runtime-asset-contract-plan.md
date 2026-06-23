# Home Field Runtime Asset Contract Plan

Date: 2026-06-23

This plan upgrades Home Field image generation from "make a nice picture" to "make a runtime-ready game asset." A candidate is not ready because it looks good in isolation. It is ready only when the generated source, processed PNG, metadata, review evidence, and composed scene prove that the asset works inside the game.

## Goal

Every Home Field generation run should produce assets that are:

- authored for their runtime role, camera, scale, and on-screen footprint;
- complete in the raw source, with no clipped silhouettes or missing edges;
- processed only through allowed deterministic cleanup steps;
- alpha-clean, padded, anchored, and shadow-compatible;
- readable on mobile at the actual size used by the field renderer;
- visually coherent in the composed mobile and desktop scene;
- reviewed by a role that did not generate the image.

## Research Notes

Runtime asset preparation has a few recurring constraints that match the failures seen in recent Home Field runs:

- **Final size drives design.** A prop that renders around `52px` on mobile must be designed as a `52px` readable field token, not as a detailed `256px` illustration.
- **Large raw sources are for cleaner processing.** Extra source pixels help with alpha cleanup and downscaling, but they should not add tiny details that disappear in the field.
- **Pivot and anchor stability matters.** Sprite and animation pipelines depend on consistent pivots/anchors. For Home Field this maps to bottom-center object anchors, planted chibi feet, and stable frame placement.
- **Transparent edges need padding.** Alpha processing should prevent visible chroma fringe and filtering halos. A technically transparent PNG can still be a bad runtime asset if the visible object touches the canvas edge or leaves colored fringe.
- **Baked shadows reduce reuse.** Runtime shadows should normally be separate layers so terrain, props, and chibi state frames can be sorted, animated, and reused without carrying incompatible lighting blobs.
- **Scaling policy is part of the style.** Hand-drawn chibi candidates should downscale smoothly. Pixel-style nearest-neighbor output is a style failure unless a future asset family explicitly asks for pixel art.
- **Composed scene proof is primary.** Contact sheets show assets, but the mobile and desktop clean field screenshots prove whether the assets actually work together.

## Sub-Agent Implementation Model

Use these roles when implementing or running the runtime asset contract. If sub-agents are unavailable, the active agent must still separate these stages in notes and must not let the generation role approve its own output.

### 1. Contract Architect

Owns the shared rules.

Must:

- read `docs/home-field-agent-flow.md`, `docs/home-field-scale-contract.md`, `docs/home-field-minimal-production-plan.md`, prompt launchers, asset metadata, and current validators;
- convert repeated lessons into one shared runtime contract;
- define the general requirements for canvas, footprint, anchor, alpha, shadow, source completeness, post-processing, evidence, and approval.

Must not:

- generate images;
- approve assets;
- edit candidate review verdicts as part of contract writing.

### 2. Prompt Integrator

Owns prompt entry points and generated agent instructions.

Must:

- update Home Field run prompts so every generation worker sees the runtime contract before imagegen;
- include role-specific runtime facts in prompt output: final canvas size, expected visible footprint, anchor convention, alpha/background rules, shadow policy, allowed post-processing, and required scene proof;
- preserve family-specific rules for grass, path, props, exits, effects, and chibi rather than replacing them with generic text.

Must not:

- broaden the active generation scope;
- remove stricter family-specific constraints.

### 3. Pipeline/Validator Agent

Owns low-risk mechanical checks.

Must consider adding checks for:

- visible alpha touching or nearly touching canvas edges on transparent object/chibi assets;
- chroma-key fringe and halo pixels after processing;
- minimum readable alpha bounds for each asset's runtime footprint;
- bottom-anchor and planted-foot sanity for object-layer props and chibi frames;
- chibi frame stability and grouped-sheet source ownership.

Must not:

- encode subjective style taste as a mechanical pass/fail when it needs human visual review;
- weaken existing validators to make a candidate pass.

### 4. Evidence/Review Agent

Owns review data and evidence expectations.

Must:

- update `docs/home-field-asset-review.json` expectations and docs so every active run records runtime-readiness results;
- require evidence for raw source completeness, processed output hash, alpha/readability sheets, and composed mobile/desktop screenshots;
- document new or clarified review checks such as `runtimeScaleCheck`, `anchorCheck`, `edgePaddingCheck`, `sourceCompletenessCheck`, and `composedSceneCheck`.

Must not:

- set `approved` or `accepted: true` without explicit human approval;
- treat missing evidence as a pass.

### 5. Visual Critic

Owns subjective in-game judgment.

Must review in this order:

1. composed mobile clean field screenshot;
2. composed desktop clean field screenshot;
3. contact sheet;
4. mobile-readability sheet;
5. alpha/halo sheet;
6. evidence manifest and hashes.

Must fail candidates that:

- are attractive in isolation but wrong in the field;
- use the wrong camera, scale, lighting, outline, renderer, or zoom level;
- have baked shadows where runtime shadows should be separate;
- lose identity at mobile scale;
- contain tiny detail that only works on the contact sheet;
- have unstable anchors or jittery chibi frames;
- are clipped, haloed, or source-incomplete.

### 6. Orchestrator

Owns sequencing, commits, and handoff.

Must:

- run the contract reviewer before imagegen;
- keep candidates out of app-facing paths until explicit approval;
- stop when a required role reports a contract contradiction;
- commit and push docs/tests/pipeline changes on `main`;
- stage only the intended submodule pointer in the hub after a submodule commit.

Must not:

- generate images;
- approve art by itself;
- mix unrelated dirty submodule changes into the hub pointer commit.

## Implementation Phases

### Phase 1: Shared Contract Documentation

Create or update a runtime asset contract that says:

- the raw image is not the asset by itself;
- the runtime-ready asset is the processed PNG plus metadata, validation, evidence, and scene proof;
- source size and visible footprint are different;
- sources must be complete and unclipped before processing;
- transparent objects need edge padding and clean alpha;
- anchors/pivots must be stable and match metadata;
- shadows are separate unless an asset family explicitly says otherwise;
- allowed post-processing is limited to cleanup, crop/fit, chroma-key removal, and resize unless a family contract explicitly allows more;
- composed scene screenshots are the primary approval evidence.

### Phase 2: Prompt Integration

Update all Home Field generation entry points to include a runtime-preparation block. The block should be short enough that it remains visible in generated prompts:

```text
Runtime asset contract: generate for the final in-game footprint, not contact-sheet beauty. Keep the raw source complete and unclipped. Use the declared camera, anchor, alpha/background, and shadow policy. Post-processing may clean alpha/chroma fringe, crop/fit, and resize only; it must not change identity, silhouette, pose, lighting, or style. The candidate is judged first in composed mobile/desktop field screenshots.
```

Add role-specific details:

- terrain: seamless/shared-source family, quiet stage, no baked props;
- props/exits: transparent object-layer, bottom-center anchor, visible padding, broad silhouette;
- chibi: grouped state sheet, planted feet, separate shadow, smooth resize, no synthetic post-split motion;
- effects: transparent overlay behavior and no UI/text unless a future effect contract says otherwise.

### Phase 3: Review Contract

Extend the review checklist in docs before changing JSON schema. The Visual Critic should record these checks in `reason` until the JSON format is deliberately expanded:

- `runtimeScaleCheck`: asset reads at actual field size;
- `anchorCheck`: bottom/feet/base placement is stable and matches metadata;
- `edgePaddingCheck`: transparent object has safe visible margins and no halo;
- `sourceCompletenessCheck`: raw source includes the whole asset before processing;
- `composedSceneCheck`: asset works in mobile and desktop clean previews.

If the JSON schema is expanded later, add tests and migration defaults in the same commit.

### Phase 4: Mechanical Validators

Add only objective checks:

- visible alpha margin from canvas edges for object/chibi assets;
- halo/fringe pixel checks after chroma-key removal;
- readable alpha bounding box minimums by asset metadata;
- chibi per-frame alpha center/height stability;
- optional bottom-anchor checks where metadata makes the expected base measurable.

Keep style failures in visual review. A validator should catch "this cannot work as a file"; the Visual Critic catches "this does not look like the game."

### Phase 5: Regression Tests

Add tests that prove:

- generated prompts include the runtime asset contract;
- minimal-run prompt points to the runtime contract;
- chibi prompt still includes grouped-sheet motion and no synthetic post-split motion;
- object prompts include footprint, alpha, anchor, and composed-scene requirements;
- validators reject clipped-edge or haloed transparent objects when those checks are implemented.

### Phase 6: Handoff Shape

Every Home Field asset-generation handoff should include:

```text
Runtime readiness:
  source complete/unclipped: <pass|fail|pending>
  alpha/edge padding: <pass|fail|pending>
  anchor/footing: <pass|fail|pending>
  runtime-scale read: <pass|fail|pending>
  composed mobile scene: <pass|fail|pending>
  composed desktop scene: <pass|fail|pending>
```

The handoff must link the candidate folder, evidence manifest, contact sheet, alpha/halo sheet, mobile-readability sheet, and composed mobile/desktop clean screenshots.

## Acceptance Criteria

The plan is implemented when:

- a new agent run can find the runtime asset contract from the main Home Field flow docs;
- generated prompts include the runtime-preparation block;
- sub-agent prompts explicitly separate contract, generation, validation, evidence, and visual criticism;
- a candidate cannot be presented as ready without composed mobile/desktop scene evidence;
- docs distinguish mechanical validation from visual approval;
- app-facing assets remain untouched until explicit human approval.

