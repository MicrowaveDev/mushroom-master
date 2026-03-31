# Manual Lore Render Spec

## Source of Truth

### Original request

Update the markdown lore result document with the user-provided Russian text and generate a PDF from that unchanged text. Adjust the script with an argument if needed.

### Stated criteria and constraints

- Treat the pasted Russian lore text as the primary authored content.
- Update the current lore result markdown under `data/channel/generated/mushroom-lore.md`.
- Preserve the provided text unchanged in content rather than regenerating/rephrasing it through the normal lore builder.
- If needed, adjust the regeneration script by adding a narrow argument for rendering from existing markdown.
- Generate fresh HTML/PDF artifacts from that markdown.
- Validate that the generated lore artifacts exist after the render pass.
- Use the repo-local proof loop for this non-trivial multi-stage task.

### Success conditions

- `data/channel/generated/mushroom-lore.md` contains the user-provided lore text.
- A CLI path exists to render the existing generated markdown without rebuilding lore from Telegram/OpenAI sources.
- Fresh `mushroom-lore.html`, `mushroom-lore.pdf`, and `generated/page-images/manifest.json` are produced from the updated markdown.
- The task bundle contains criterion-level evidence for the current repository state.

### Non-goals

- Rewriting, normalizing, or improving the lore wording.
- Re-tagging Telegram source messages.
- Changing the normal Telegram/OpenAI regeneration flow beyond the new narrow render-only argument.

### Open assumptions

- "Unchanged text" means preserving the user-provided wording and ordering as authored, aside from storing it as UTF-8 markdown with a trailing newline.

## Acceptance Criteria

### AC1. Authored lore replacement

The file `data/channel/generated/mushroom-lore.md` is replaced with the user-provided lore text as authored.

### AC2. Render-only CLI path

The repository provides a narrow CLI argument on the existing regeneration entrypoint that renders the current generated markdown into HTML/PDF without rebuilding lore from Telegram/OpenAI sources.

### AC3. Fresh artifact generation

Running the render-only path produces current `mushroom-lore.html`, `mushroom-lore.pdf`, and `generated/page-images/manifest.json` artifacts in `data/channel/generated/`.

## Verification Plan

- Inspect the updated markdown file contents directly.
- Run the render-only CLI path against the existing generated markdown.
- Capture command output and file timestamps under `.agent/tasks/manual-lore-render/raw/`.
- Record criterion-level results in `evidence.md`, `evidence.json`, and `verdict.json`.
