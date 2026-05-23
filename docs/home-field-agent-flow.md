# Home Field Agent Flow

Date: 2026-05-23

This workflow prevents one agent from generating, validating, and approving its own Home Field art. Use it for terrain generation runs, starting with the grass-family batch.

## Core Rule

No single role may both create an image and approve it. Generation, mechanical validation, and visual review are separate stages.

If the environment supports sub-agents, assign the roles below as separate agents. If it does not, the active agent must still execute the stages separately and name which role it is acting as in its notes.

## Roles

| Role | May read | May write | Must not do |
| --- | --- | --- | --- |
| Orchestrator | Workflow docs, command output, final reports | Commit and push approved candidate-batch changes | Generate images, approve art by itself, skip stop gates |
| Prompt/Contract Reviewer | Assets, prompts, style anchor, tileset contract, next-tiles output | Nothing | Generate images, edit manifests, approve art |
| Imagegen Worker | Prompt blocks and style anchor | Raw PNGs under `.agent/home-field-workspace/raw/` | Edit app PNGs directly, edit JSON/docs, approve art |
| Producer/Validation Worker | Raw files, manifest, command output | App-facing PNGs produced through `game:home-field:produce`; generated local review sheets | Hand-edit PNGs, change contracts, approve art |
| Visual Critic | Contact sheet, adjacency sheet, clean preview screenshots | `docs/home-field-asset-review.json` verdict/check rows for the active batch only | Set `approved` or `accepted: true` without explicit human approval |

## Grass-First Stop Gate

The next tile generation run is limited to:

- `grass_base_01`
- `grass_base_02`
- `grass_flowers_01`

`npm run game:home-field:next-tiles` emits only these three prompts. The run must stop after these three candidates are produced, reviewed, committed, and pushed. Path and edge tiles require a separate later run after the grass family is accepted.

## Required Evidence

Before any grass candidate can be considered for human approval, the run must produce:

- `npm run game:home-field:validate -- --check-files --check-connectors --check-review`
- `npm run game:home-field:sheet`
- `npm run game:home-field:adjacency`
- `npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line`

Review evidence lives locally under:

- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/adjacency-sheet.png`
- `.agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/`

Do not commit `.agent` review artifacts.

## Review JSON Rules

The Visual Critic updates only the active batch rows in `docs/home-field-asset-review.json`.

Required fields:

- `repeatCheck`
- `connectorCheck`
- `cleanPreviewCheck`
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
- If produce fails, rerun only the affected asset with the printed producer command.
- If validation fails because a contract changed, stop and report. Do not edit validators or manifests during a generation run.
- If visual review fails, set the active rows to `needs_regen` or `rejected`, commit the review manifest if it changed, and stop.

## Handoff Report

Every generation run ends with:

```text
Grass tile candidate batch complete.
Committed assets: grass_base_01, grass_base_02, grass_flowers_01
Review evidence:
  Contact sheet: .agent/home-field-workspace/review/contact-sheet.png
  Adjacency sheet: .agent/home-field-workspace/review/adjacency-sheet.png
  Clean preview screenshots: .agent/tasks/telegram-autobattler-v1/raw/screenshots/home-field-preview/
Review verdicts:
  grass_base_01: <verdict + check summary>
  grass_base_02: <verdict + check summary>
  grass_flowers_01: <verdict + check summary>
Notes:
  <retry/rejection/remaining issue summary>
```
