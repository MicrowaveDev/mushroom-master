# Mushrooms Docs Renderer Evidence

## Implementation Summary

- Added template-aware lore rendering in `src/lib/render.js` with shared artifact generation and two templates:
  - `classic` for the existing dossier output
  - `mushrooms-docs` for the new docs-style output
- Kept the pipeline DRY by reusing one render entry point for:
  - HTML generation
  - PDF generation
  - page-image generation
  - artifact naming and pruning
- Added template selection to existing render/regeneration entry points.
- Added `--skip-bot` / `--no-send-pdf` support so local verification can regenerate PDFs without Telegram delivery.

## Acceptance Criteria

### AC1

Status: PASS

The codebase now supports an alternate renderer/template while preserving the existing default renderer. Proof:

- `src/lib/render.js` exposes template selection through `normalizeRenderTemplate(...)` and `renderMarkdownToHtmlAndPdf(..., { template })`.
- `src/render-existing-lore.js` and `src/lib/lore-builder.js` pass template options through to the shared renderer.

### AC2

Status: PASS

The implementation stays DRY instead of duplicating the whole render pipeline. Proof:

- Shared code in `src/lib/render.js` handles:
  - output naming
  - browser launch
  - HTML write
  - PDF export
  - page-image export
  - artifact pruning
- Only the HTML builders differ between templates.

### AC3

Status: PASS

Character sections render in a docs/profile style distinct from the existing dossier layout. Proof:

- The generated HTML contains `5` occurrences of `Профиль персонажа:` from the current lore set.
- The generated HTML contains `30` profile sections under `.docs-profile-section`.
- Fresh screenshots reviewed:
  - `data/channel/generated/page-images-mushrooms-docs/page-03.png`
  - `data/channel/generated/page-images-mushrooms-docs/page-04.png`

### AC4

Status: PASS

General lore renders in a corresponding docs-like scheme. Proof:

- The generated HTML contains `3` `.docs-topic` general-lore chapter blocks.
- Fresh screenshot reviewed:
  - `data/channel/generated/page-images-mushrooms-docs/page-01.png`

### AC5

Status: PASS

A fresh render produced current HTML/PDF/page-image artifacts for the new renderer, and they are newer than the recorded render start. Proof:

- Render command recorded in `.agent/tasks/mushrooms-docs-renderer/raw/render-command.txt`
- Freshness timestamps recorded in `.agent/tasks/mushrooms-docs-renderer/raw/timestamps.txt`
- Page-image manifest copied to `.agent/tasks/mushrooms-docs-renderer/raw/page-images-manifest.json`

## Raw Proof

- `.agent/tasks/mushrooms-docs-renderer/raw/render-command.txt`
- `.agent/tasks/mushrooms-docs-renderer/raw/timestamps.txt`
- `.agent/tasks/mushrooms-docs-renderer/raw/structure-counts.txt`
- `.agent/tasks/mushrooms-docs-renderer/raw/page-images-manifest.json`
