# Home Field Agent Flow

Date: 2026-05-23

This workflow prevents one agent from generating, validating, and approving its own Home Field art. Use it for terrain generation runs, starting with the grass-family batch.

## Core Rule

No single role may both create an image and approve it. Generation, mechanical validation, and visual review are separate stages.

If the environment supports sub-agents, assign Prompt/Contract Reviewer, Imagegen Worker, Producer/Validation Worker, and Visual Critic as separate agents. A single read-only sidecar is not enough for a generation run. If sub-agents are unavailable, the active agent must still execute the stages separately and name which role it is acting as in its notes.

When using the multi-agent tool, use the known-good call shape only:

```json
{"agent_type":"explorer","message":"<bounded role, read/write scope, exact completion condition>"}
```

Do not pass `fork_context` or mixed `message`/`items` payloads; those have caused avoidable retries in prior Home Field runs.

## Roles

| Role | May read | May write | Must not do |
| --- | --- | --- | --- |
| Orchestrator | Workflow docs, command output, final reports | Commit and push approved candidate-batch changes | Generate images, approve art by itself, skip stop gates |
| Prompt/Contract Reviewer | Assets, prompts, style anchor, tileset contract, rerun-grass output | Nothing | Generate images, edit manifests, approve art |
| Imagegen Worker | Prompt blocks and style anchor | Raw PNGs under `.agent/home-field-workspace/raw/` | Edit app PNGs directly, edit JSON/docs, approve art |
| Producer/Validation Worker | Raw files, manifest, command output | Candidate PNGs under `.agent/home-field-workspace/candidates/`; generated local review sheets | Hand-edit PNGs, change contracts, overwrite app-facing PNGs before human approval, approve art |
| Visual Critic | Contact sheet, adjacency sheet, clean preview screenshots | `docs/home-field-asset-review.json` verdict/check rows for the active batch only | Set `approved` or `accepted: true` without explicit human approval |

## Grass-First Stop Gate

The next tile generation run is limited to:

- `grass_base_01`
- `grass_base_02`
- `grass_flowers_01`

`npm run game:home-field:next-tiles` is the gated first-pass queue. Once a grass candidate is marked `needs_review`, that command can block to prevent accidental continuation.

For intentional grass-family reruns, use the shared-source queue:

```bash
npm run game:home-field:rerun-grass-family
```

That command emits one shared meadow-source prompt for the three grass rows. The Imagegen Worker must generate a larger continuous meadow/pattern context and save only `.agent/home-field-workspace/raw/grass_family_meadow.source.png`. The Producer/Validation Worker then runs:

```bash
npm run game:home-field:produce-grass-family-candidate
```

Do not generate or save separate per-tile raw PNGs for this grass batch. The family producer crops coordinated nearby regions from the same source so `grass_base_01`, `grass_base_02`, and `grass_flowers_01` share lighting, brushwork, and value range. Candidate mode writes to `.agent/home-field-workspace/candidates/grass-family/latest/`; it must not overwrite `web/public/home-field/terrain/` before explicit human approval.

The default crop plan is `tight-center`. If visual review still shows square value boundaries, the Producer/Validation Worker may rerun the same raw source with `--plan=lower-band` or `--plan=upper-band`, regenerate evidence, and let the Visual Critic choose the best non-approved candidate before commit. Do not commit multiple crop-plan attempts.

The run must still stop after these three candidates are produced and reviewed. Path and edge tiles require a separate later run after the grass family is accepted.

## Path And Edge Family Gate

After the grass family is human-approved or explicitly selected as the active candidate baseline, path and edge terrain must be generated as terrain-family candidates, not app-facing PNGs.

Use the family queues:

```bash
npm run game:home-field:rerun-path-family
npm run game:home-field:rerun-edge-family
```

These commands print candidate-safe prompts and producer commands that write under `.agent/home-field-workspace/candidates/terrain-family/latest/`. Do not use plain `game:home-field:produce` for path or edge reruns before human approval.

Required path-family scope:

- `path_h_end_w`
- `path_dirt_straight`
- `path_spore_glow`
- `path_h_end_e`
- `path_destination_row`

Required edge-family scope:

- `edge_roots_01`
- `edge_moss_rocks_01`
- `edge_left_forest_01`
- `edge_right_forest_01`

The Visual Critic must review each family as one set. A path family fails if the dirt band, glow band, end fades, or destination landing use different camera, palette, edge values, or Y-band reads. An edge family fails if side stacks feel like unrelated forest strips, cropped full scenes, or a different zoom level from the grass/path baseline.

Minimum evidence:

```bash
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:validate -- --ids=<family_ids> --check-files --check-connectors --check-review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:validate -- --ids=<family_ids> --check-files --check-edge-profiles
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest npm run game:home-field:adjacency
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest HOME_FIELD_CANDIDATE_IDS=<family_ids> npm run game:home-field:candidate-evidence
HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/terrain-family/latest HOME_FIELD_CANDIDATE_IDS=<family_ids> npm run game:home-field:terrain-candidate-preview
```

Before any production approval, run the combined scene proof:

```bash
npm run game:home-field:combined-candidate-preview
```

Use `HOME_FIELD_CANDIDATE_ROOTS` and `HOME_FIELD_CANDIDATE_IDS` if the latest accepted candidate folders differ from the defaults.

## Object-Layer Candidate Gate

For prop-only review runs, use the generic candidate producer instead of the promotion producer:

```bash
npm run game:home-field:produce-object-candidate -- bush_cluster_dark_01 bush_cluster_light_01 leaf_sprout_01 --resize
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01 --check-files --check-review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01 --check-files --check-alpha-halo
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:validate -- --ids=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01 --check-files --check-readability
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:mobile-readability-sheet -- --ids=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/object-layer/latest npm run game:home-field:alpha-sheet -- --ids=bush_cluster_dark_01,bush_cluster_light_01,leaf_sprout_01
npm run game:home-field:object-candidate-preview
```

This writes candidate PNGs under `.agent/home-field-workspace/candidates/object-layer/latest/web/public/home-field/props/` and uses route interception for `/home-field-preview?debug=0`, so app-facing PNGs remain untouched before human approval. If a run covers a different prop set, pass `--candidate-root=<dir>` to `game:home-field:produce` and set `HOME_FIELD_CANDIDATE_IDS` / `HOME_FIELD_CANDIDATE_ROOT` when running the candidate preview spec.

## Active-Roster Chibi Candidate Gate

For active-roster chibi runs, follow [`docs/home-field-chibi-candidate-contract.md`](home-field-chibi-candidate-contract.md). The first scoped proof id is:

- `thalla`

This batch is candidate-only. Do not overwrite `web/public/home-field/characters/*/spritesheet.png`, do not mark rows approved, and do not set `accepted: true`.

Stage 1 is not a full-animation run. It proves Thalla's identity, silhouette, alpha, and mobile readability first. Use the compact Stage 1 frame contract: 8 unique poses minimum, written into the current 12 raw frame slots, then composed into the locked `512 x 256` runtime sheet by replicating one walk pose across columns `2-7` per direction. Do not require 32 unique frames until the base chibi design passes review.

Use a two-step character consistency flow. First generate a non-production turnaround reference sheet under `.agent/home-field-workspace/reference/` that shows Thalla in `down`, `up`, `left`, and `right` with one consistent design. Then generate the final raw frames as separate isolated transparent images. The reference sheet is allowed for visual consistency only; do not slice it into production raw frames.

Each final raw frame must be generated as a separate isolated transparent image, normally `64x64` or `128x128` when the run explicitly asks for source-quality downscaling. Do not accept a larger spritesheet/source grid that has to be cropped into final frames; that failure mode produced wrong-facing walk rows and miniature repeated fragments. The Visual Critic must fail `sourceFrameIsolationCheck`, `sheetMappingCheck`, and `stageContractCheck` if any final raw image contains multiple sprites, borders, a background, or cropped sheet artifacts. A reference turnaround sheet must not be treated as that failure mode unless it is used as the production source.

The Stage 1 camera target is an elevated top-down 2.5D hub sprite: show some top of the mushroom cap/head, keep feet/base planted on the map, and avoid straight-on portrait-sticker or fashion-pose reads. Detail must be aggressively budgeted for mobile: broad shapes, `2-3` main color regions, `1-2` gold mycelium/spore marks, tiny facial features only, and no ornate filigree or particle halo.

After Thalla passes review, expand to `lomie`, `axilin`, `kirt`, and `dalamar` as a second stage. Keep `morga` deferred until her design contract is explicit enough for production chibi generation.

Review evidence for this batch should live under:

- `.agent/home-field-workspace/candidates/chibi-active-roster/latest/`
- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/mobile-readability-sheet.png`
- `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png`
- `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png`

The Visual Critic updates only the scoped character rows in `docs/home-field-asset-review.json`; for Stage 1, that means `thalla` only.

## Scene Target Gate

The target is not an isolated grass texture. The final composed field should read like a polished game-hub screenshot: chibi mushroom-elf avatars standing on a soft green meadow, with chunky dark-ink foliage, vines, flowers, mushrooms, exits, and props framing the walkable area on object layers.

Before any terrain, prop, or exit generation, follow [`docs/home-field-scale-contract.md`](home-field-scale-contract.md). The source canvas size is not the visual footprint: `256x256` props should not fill the whole source canvas unless they are terrain, and larger source sizes are for cleaner alpha/cropping rather than extra tiny detail. Reject any batch where assets look like different zoom levels, camera angles, renderers, or lighting setups in the same Home Field preview.

For the grass batch, this means:

- grass must be quiet enough that 64px chibi feet and shadows stay readable;
- tiny grass strokes and yellow-green marks are accents only, not a texture carpet;
- flowers and strong foliage shapes belong mostly on object-layer props, not base terrain;
- the three grass tiles must look like crops from the same meadow source, not unrelated imagegen outputs;
- the clean preview must feel like a usable stage for characters, even before the real chibi sprites are replaced.

## Required Evidence

Before any grass candidate can be considered for human approval, the run must produce:

- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:validate -- --ids=grass_base_01,grass_base_02,grass_flowers_01 --check-files --check-connectors --check-review`
- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:sheet`
- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:grass-family-sheet`
- `HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/grass-family/latest npm run game:home-field:adjacency`
- `HOME_FIELD_CANDIDATE_ROOT=.agent/home-field-workspace/candidates/grass-family/latest HOME_FIELD_CANDIDATE_IDS=grass_base_01,grass_base_02,grass_flowers_01 npm run game:home-field:candidate-evidence`
- `npm run game:home-field:candidate-preview`

Review evidence lives locally under:

- `.agent/home-field-workspace/candidates/grass-family/latest/`
- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/grass-family-sheet.png`
- `.agent/home-field-workspace/review/adjacency-sheet.png`
- `.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png`
- `.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png`
- `.agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/` after human-approved promotion

Do not commit `.agent` review artifacts.

Run `game:home-field:candidate-preview` before visual review. It uses Playwright route interception to render `/home-field-preview?debug=0` with the candidate grass PNGs from `.agent/home-field-workspace/candidates/grass-family/latest/`, without promoting or overwriting app-facing PNGs. The app-facing clean preview screenshots under `.agent/tasks/...` remain post-promotion proof.

Run `game:home-field:object-candidate-preview` for the foliage micro-batch. It uses the same clean preview screenshot paths, but routes `bush_cluster_dark_01`, `bush_cluster_light_01`, and `leaf_sprout_01` from `.agent/home-field-workspace/candidates/object-layer/latest/`.

## Review JSON Rules

The Visual Critic updates only the active batch rows in `docs/home-field-asset-review.json`. It must refresh every required check field for each active row, not only the prose `reason`.

Required fields:

- `repeatCheck`
- `connectorCheck`
- `cleanPreviewCheck`
- `sceneFitCheck`
- `familyCohesionCheck`
- `styleCohesionCheck`
- `alphaCheck`
- `scaleCheck`
- `verdict`
- `accepted`
- `reason`

Recommended evidence fields before any human approval:

- `candidateRoot`
- `candidateEvidenceManifest`
- `candidateSha256`
- `rawSourceSha256`
- `mobileScreenshotSha256`
- `desktopScreenshotSha256`

Allowed non-human verdicts:

- `needs_review`
- `needs_regen`
- `rejected`

Human-only approval:

- `verdict: "approved"`
- `accepted: true`

An approved row must have all checks set to `pass` or `not_applicable`.

## Failure Handling

- If imagegen returns a full scene, dense texture, path, prop, text, horizon, or focal object inside a grass tile, discard the raw and regenerate.
- If the shared meadow output still shows repeated square blocks, diagonal mottling, columns, rows, hard value bands, or visibly different zones in the contact sheet or clean preview, mark it `needs_regen`. Passing file and connector validation is not enough.
- If the clean preview does not look like a calm stage where chibi avatars and object-layer foliage can sit naturally, set `sceneFitCheck` to `fail` even if the tile is technically seamless.
- If the grass variants do not share lighting, brushwork, and value range, set `familyCohesionCheck` to `fail`.
- If produce fails, rerun only the affected asset with the printed producer command.
- If `tight-center` produces blocky family transitions, try at most the two documented alternate crop plans from the same raw source, refresh `grass-family-sheet`, and commit only the best candidate set.
- If validation fails because a contract changed, stop and report. Do not edit validators or manifests during a generation run.
- If `--check-edge-profiles` fails, inspect the adjacency sheet before retrying. The heuristic is allowed to be conservative, but visible path-band, grass-edge, or edge-stack seams must be regenerated rather than papered over with metadata.
- If `--check-alpha-halo` reports visible chroma fringe, reprocess with stricter chroma-key cleanup or regenerate the affected raw PNG. Do not leave `alphaCheck: pending` on a candidate whose halo validator fails.
- If `--check-readability` fails, regenerate or reprocess the candidate so the visible alpha bounding box meets the asset's `readability` minimums. Do not compensate by scaling objects with CSS in the preview.
- If a bush candidate looks like many repeated round clumps, broccoli/cauliflower crowns, flower rosettes, or obvious brush stamps instead of one irregular natural shrub mass, set it to `needs_regen` even if alpha, scale, and field screenshots pass.
- If a bush candidate is constructed from many visible leafy segments or mini-crowns, set it to `needs_regen`. The target is a few large overlapping foliage masses, not a collection of many small shrub pieces.
- If a light foliage candidate reads bright yellow/lemon and pulls attention from the chibi/path area in the mobile clean preview, set `sceneFitCheck` and `styleCohesionCheck` to `fail` even if shape/readability pass.
- If an object-layer prop loses its main identity at 48-64px in `mobile-readability-sheet.png` or in the mobile clean field screenshot, set `scaleCheck` or `cleanPreviewCheck` to `fail`. Passing the 256px contact sheet is not enough.
- If a field prop only looks good as a large 256px contact-sheet illustration, set `scaleCheck` to `fail`. In the current DOM preview, small scene props render at roughly 52x52 CSS pixels on the 375x667 mobile viewport and roughly 90x90 CSS pixels on desktop, with the visible alpha shape often only 30-48px wide on mobile. Dense gills, many spots, tiny caps, root tangles, bark chips, fine veins, and glossy hero-object rendering are review failures for these props.
- Intentional vegetable or strange-flower references are allowed only for assets with `role: "funny_foliage_prop"` such as `mutant_broccoli_bush_01`; do not use that allowance to approve accidental broccoli shapes in natural `bush_cluster_*` assets.
- If visual review fails, set the active rows to `needs_regen` or `rejected`, leave app-facing PNGs untouched, commit the review manifest if it changed, and stop.
- If visual review passes as `needs_review`, stop and ask for human approval before promoting candidate PNGs to app-facing paths.
- Every candidate run must update `docs/home-field-asset-review.json` with a per-asset visual verdict for the generated IDs. Do this even when the verdict remains `needs_regen`; fresh evidence with stale reasons/checks is a failed handoff.

## Handoff Report

Every generation run ends with:

```text
Grass tile candidate batch complete.
Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)
Committed assets: <none unless human approval promoted the candidate>
Review evidence:
  Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)
  Contact sheet: .agent/home-field-workspace/review/contact-sheet.png
  Grass family sheet: .agent/home-field-workspace/review/grass-family-sheet.png
  Adjacency sheet: .agent/home-field-workspace/review/adjacency-sheet.png
  Mobile readability sheet: [mobile readability sheet](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/review/mobile-readability-sheet.png)
  Candidate field mobile: [mobile field screenshot](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/review/home-field-candidate-mobile-clean.png)
  Candidate field desktop: [desktop field screenshot](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/review/home-field-candidate-desktop-clean.png)
  Clean preview screenshots: <only after human-approved promotion>
Review verdicts:
  <asset_id>: <needs_review|needs_regen|rejected> — <short visual reason + check summary>
  <asset_id>: <needs_review|needs_regen|rejected> — <short visual reason + check summary>
  <asset_id>: <needs_review|needs_regen|rejected> — <short visual reason + check summary>
Notes:
  <retry/rejection/remaining issue summary>
```

Do not wrap the candidate folder or candidate field screenshot paths in backticks in the final response. They must be Markdown links so the reviewer can open them from Codex Desktop.
