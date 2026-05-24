# Home Field Agent Flow

Date: 2026-05-23

This workflow prevents one agent from generating, validating, and approving its own Home Field art. Use it for terrain generation runs, starting with the grass-family batch.

## Core Rule

No single role may both create an image and approve it. Generation, mechanical validation, and visual review are separate stages.

If the environment supports sub-agents, assign Prompt/Contract Reviewer, Imagegen Worker, Producer/Validation Worker, and Visual Critic as separate agents. A single read-only sidecar is not enough for a generation run. If sub-agents are unavailable, the active agent must still execute the stages separately and name which role it is acting as in its notes.

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

## Scene Target Gate

The target is not an isolated grass texture. The final composed field should read like a polished game-hub screenshot: chibi mushroom-elf avatars standing on a soft green meadow, with chunky dark-ink foliage, vines, flowers, mushrooms, exits, and props framing the walkable area on object layers.

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

Review evidence lives locally under:

- `.agent/home-field-workspace/candidates/grass-family/latest/`
- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/grass-family-sheet.png`
- `.agent/home-field-workspace/review/adjacency-sheet.png`
- `.agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/` after human-approved promotion

Do not commit `.agent` review artifacts.

Run the Playwright clean preview only after human approval promotes the candidate into `web/public/home-field/terrain/`. Candidate sheets are the pre-approval proof; app-facing preview screenshots are post-promotion proof.

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
- If visual review fails, set the active rows to `needs_regen` or `rejected`, leave app-facing PNGs untouched, commit the review manifest if it changed, and stop.
- If visual review passes as `needs_review`, stop and ask for human approval before promoting candidate PNGs to app-facing paths.

## Handoff Report

Every generation run ends with:

```text
Grass tile candidate batch complete.
Candidate folder: /Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest
Committed assets: <none unless human approval promoted the candidate>
Review evidence:
  Candidate folder: /Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest
  Contact sheet: .agent/home-field-workspace/review/contact-sheet.png
  Grass family sheet: .agent/home-field-workspace/review/grass-family-sheet.png
  Adjacency sheet: .agent/home-field-workspace/review/adjacency-sheet.png
  Clean preview screenshots: <only after human-approved promotion>
Review verdicts:
  grass_base_01: <verdict + check summary>
  grass_base_02: <verdict + check summary>
  grass_flowers_01: <verdict + check summary>
Notes:
  <retry/rejection/remaining issue summary>
```
