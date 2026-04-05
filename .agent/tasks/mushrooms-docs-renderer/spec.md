# Source Of Truth

## Original Request

Add a second PDF rendering that uses a structured "mushrooms docs" scheme for characters, and a similar scheme for lore, based on the provided Thalla profile example. Keep the implementation DRY.

## Stated Criteria And Constraints

- Add a second PDF rendering instead of replacing the current one.
- The new rendering can be named `mushrooms docs`.
- Character presentation should follow a profile-style scheme like:
  - title/profile heading
  - concept/style summary
  - numbered sections
- General lore should use a similar docs-like scheme.
- Keep the implementation DRY rather than duplicating the whole renderer pipeline.

## Success Conditions

- AC1: The codebase supports an alternate renderer/template for lore PDFs while preserving the current default renderer.
- AC2: The alternate `mushrooms docs` renderer uses shared parsing/render infrastructure rather than copy-pasting the existing full render pipeline.
- AC3: Character sections render in a docs/profile style that is recognizably different from the current dossier layout and grounded in the existing lore markdown structure.
- AC4: General lore renders in a corresponding docs-like section scheme instead of the current parchment dossier presentation.
- AC5: A fresh render produces current HTML/PDF/page-image artifacts for the new renderer, and those artifacts are newer than the implementation start for this task.

## Non-Goals

- Rewriting the canonical authored lore markdown.
- Replacing the existing default lore PDF theme.
- Changing unrelated web app files.

## Open Assumptions

- The new renderer should be available through the existing local render/regenerate entry points via an explicit template option.
- The current default sent/uploaded PDF behavior should remain unchanged unless the new template is explicitly requested.

## Verification Plan

- Add template-aware render tests through executable local render commands.
- Regenerate the alternate HTML/PDF/page images from the current stored lore markdown.
- Record outputs and timestamps in the task evidence bundle.
