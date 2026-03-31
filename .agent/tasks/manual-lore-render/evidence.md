# Manual Lore Render Evidence

## Implementation summary

This task updated the current generated lore markdown with the user-provided authored Russian text and added a narrow render-only CLI path on the existing regeneration entrypoint.

Implementation areas:

- authored lore replacement in `data/channel/generated/mushroom-lore.md`
- render-only helper in `src/render-existing-lore.js`
- argument handling in `src/regenerate-from-telegram.js`
- proof bundle in `.agent/tasks/manual-lore-render/`

## Criterion evidence

### AC1

PASS. The generated lore markdown now contains the user-provided authored text instead of the previous model-generated dossier content.

Proof:

- `data/channel/generated/mushroom-lore.md`
- `.agent/tasks/manual-lore-render/spec.md`

### AC2

PASS. The existing CLI entrypoint now supports `--render-existing-markdown`, which renders the current `generated/mushroom-lore.md` directly into HTML/PDF without invoking the normal Telegram/OpenAI lore rebuild path.

Proof:

- `src/regenerate-from-telegram.js`
- `src/render-existing-lore.js`
- `.agent/tasks/manual-lore-render/raw/render-command.txt`

### AC3

PASS. The render-only path completed successfully and produced fresh lore artifacts and page-image metadata under `data/channel/generated/`.

Proof:

- `.agent/tasks/manual-lore-render/raw/render-command.txt`
- `.agent/tasks/manual-lore-render/raw/timestamps.txt`
- `data/channel/generated/mushroom-lore.html`
- `data/channel/generated/mushroom-lore.pdf`
- `data/channel/generated/page-images/manifest.json`

## Fresh verification summary

Fresh verification command:

- `node src/regenerate-from-telegram.js --render-existing-markdown`

Observed result:

- command completed successfully
- `mushroom-lore.html` updated at `2026-03-31T01:56:59Z`
- `page-images/manifest.json` updated at `2026-03-31T01:57:02Z`
- `mushroom-lore.pdf` updated at `2026-03-31T01:57:03Z`
- page-image manifest reports `11` pages

## Renderer follow-up

Follow-up verification after chunking the authored markdown confirmed that the remaining image-placement issue was caused by `src/render-existing-lore.js` re-normalizing already canonical markdown.

Fix:

- render-only now treats `data/channel/generated/mushroom-lore.md` as canonical authored input
- it no longer rewrites character sections before handing markdown to `renderMarkdownToHtmlAndPdf()`

Current proof:

- `data/channel/generated/mushroom-lore.html` contains a single `## Персонажи` heading followed by clean `character-intro` blocks
- the rendered intro block for Axylin now contains `<h3>Аксилин (Axylin)</h3>` with the overview paragraph instead of promoting a body paragraph into the heading
- visual inspection of `data/channel/generated/page-images/page-03.png` and `data/channel/generated/page-images/page-08.png` shows the regular side-by-side portrait layout restored for character dossiers

## Drift / assumptions / partials

No lore wording was normalized or regenerated. The markdown content was stored from the user-provided text as authored, with only a trailing newline normalization assumption captured in the spec.
