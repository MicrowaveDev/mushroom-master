# Phase 4 Evidence — Prompt And Provenance Pipeline

Status: PASS

## Production-Ready Gate

PASS. The app-facing artifact PNG baseline is now tracked in `web/public/artifacts/`, and the active user request on 2026-05-01 says the bitmap artifacts were handled for production readiness. Runtime-facing provenance was therefore generated as committed metadata rather than as a local draft.

## AC4.1

PASS. `app/shared/artifact-image-metadata.json` contains one `approved` entry per production artifact PNG. Each entry resolves to:

- artifact metadata snapshot
- visual classification snapshot
- full prompt text from the existing prompt builder
- output path
- PNG `sha256`, dimensions, and size
- validation snapshot
- reviewer decision
- optional `candidates[]` array

## AC4.2

PASS. Prompt and image metadata drift are now reviewable through the committed JSON diff.

## AC4.3

PASS. Added `npm run game:artifacts:provenance:check`, which recomputes each PNG `sha256` and fails on mismatch.

## AC4.4

PASS. Runtime-facing metadata uses `status: "approved"` per artifact plus `policy.runtimeUsesApprovedOnly: true`. Temporary generated candidates stay under `.agent/artifact-image-workspace/`.

## Commands Run

```bash
npm run game:artifacts:validate -- --all
npm run game:artifacts:next
npm run game:artifacts:sheet -- --allow-unchanged --highlight-changed
npm run game:artifacts:thumbnail-review
npm run game:artifacts:provenance:generate
npm run game:artifacts:provenance:check
node --test tests/game/artifact-visual-classification.test.js
```
