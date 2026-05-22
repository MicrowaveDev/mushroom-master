# Codex Prompt — Home Field tile generation

Copy the block below into Codex. It's self-contained: it tells Codex where to look, what to do, when to stop, and what to commit. No prior conversation context needed.

---

You are picking up the imagegen workstream for the **Mushroom Master Home Field hub**. Phase 0 contracts (validator, prompts, scripts, ADR, requirement IDs) have already shipped on `main`. Your job is to generate the production bitmap art that the renderer (Phase 3) will load.

## Environment

- Repo: `mushroom-master` (`cd` into it before running anything; the shared metadata and scripts live there).
- Branch policy: **direct-to-main**. Commit completed batches on `main` and push. Do not open feature branches unless explicitly asked.
- Authoritative handoff doc: `app/shared/home-field/README.md`. Read it once at the start — it has the full workflow, batch list, resize flags, and commit rules. Anything below this prompt that conflicts with the README, the README wins.

## Goal

Generate the v1 home-field bitmap assets through three staged batches, with a human-review stop between each batch. The contracts are frozen — do not modify `home-field-assets.json` (asset list), `home-field-map.json`, or `home-field-validator.js`. Only **add PNGs** under `web/public/home-field/`.

## Strict guardrails

- **One batch at a time.** After completing a batch, push, then **stop and report the contact sheet** at `.agent/home-field-workspace/review/contact-sheet.png`. Do not start the next batch until the human approves.
- **Never modify** the schema, validator, map JSON, or asset manifest. If validation fails because of a schema concern, surface the error and stop; do not "fix" it by editing the contract.
- **No new dependencies.** The pipeline runs on the existing `bitmap-image-toolkit.js`. Do not add `pngquant`, `sharp`, `phaser`, or anything else.
- **No text in any image.** Signposts and banners are art-only — runtime renders localized labels. If an imagegen output contains readable text, regenerate it.
- **Style anchor is non-negotiable.** Every prompt block emitted by `npm run game:home-field:next` already includes the locked style anchor (palette, lighting, shadows, rejections). Feed it verbatim into your imagegen call alongside the subject/details.
- **Terrain assets are tilemap cells, not background art.** A terrain prompt must produce one reusable `256×256` tile that can repeat edge-to-edge in a Phaser/Tiled layer. Do not generate a complete field, wallpaper, horizon scene, vignette, prop cluster, sign, entrance, or character inside a terrain tile.
- **Reject dense texture tiles.** Grass/path terrain must be low-frequency map art: broad readable patches, quiet edges, sparse tiny marks only. If a generated tile looks like a detailed texture painting, contains a unique center highlight, or becomes obvious wallpaper in a repeated patch, reject it even if it is visually pretty.

## Run order (do this exactly)

1. `cd` into `mushroom-master`. Confirm clean tree on `main` (`git status --short`). If not clean, stop and ask.
2. `npm install` if you haven't already in this environment.
3. `npm run game:home-field:validate` — must print `home-field validation: PASS`. If not, stop.
4. `npm run game:home-field:status` — should show `Progress: 0/24 produced`. If non-zero, some assets already exist; you'll work on whatever's still pending.

### Batch 1 — `proof-static` (7 single-image PNGs)

5. `npm run game:home-field:next -- --batch=proof-static --all` — prints 7 prompt blocks (terrain × 3, props × 2, exits × 2).
6. For each of the 7 prompts:
   - Read the prompt block in full, including the **Style anchor** section.
   - Call your imagegen skill with `subject + details + size + transparency + constraints + style anchor` as the prompt. Request a transparent PNG when the block says "transparent background required"; otherwise a solid-background PNG.
   - Save the raw output to the exact `sourcePath` shown in the block (under `.agent/home-field-workspace/raw/`). Create the directory if needed.
   - It is fine if imagegen returns at a non-target size (e.g. 1024×1024 instead of 256×256). The next step rescales.
7. `npm run game:home-field:produce -- --all-missing --resize` — composes / rescales / re-encodes the raws into the final PNGs under `web/public/home-field/`. Inspect the per-asset OK/FAIL summary.
   - If a row prints FAIL, read the reason and regenerate that specific asset (`npm run game:home-field:next -- --id=<that_id>` then redo step 6 + this step for just that ID).
8. `npm run game:home-field:validate -- --check-files` — must pass for the 7 produced assets. Schema-only checks still pass for the rest.
9. `npm run game:home-field:sheet` — refreshes the contact sheet PNG + manifest.
10. Inspect `.agent/home-field-workspace/review/contact-sheet.png` yourself for obvious problems (text in image, wrong palette, hard black outlines, photoreal style). Terrain cells must read as repeated tile patches in the contact sheet, not as miniature full-screen scenes. If any asset clearly violates the style anchor or tilemap contract, regenerate it before continuing.
11. Commit and push:
    ```
    git add web/public/home-field/ .gitignore
    git commit -m "Home field proof-static batch: 7 terrain/prop/exit PNGs"
    git push origin main
    ```
12. **STOP.** Report:
    - the contact-sheet path,
    - the 7 asset IDs you committed,
    - any FAILs you had to retry and the reason,
    - the `home-field-status` output.
    Wait for human approval before continuing to Batch 2.

### Batch 2 — `proof-animated` (2 animated effects, per-frame composition)

Only proceed after the human approves Batch 1.

13. `npm run game:home-field:next -- --batch=proof-animated --all` — prints prompts for `spore_motes_loop` (8 frames at 256×256) and `tap_ripple` (4 frames at 128×128).
14. For each animated asset:
    - The prompt explicitly says **PER-FRAME GENERATION**: do not try to produce a single wide strip. Call imagegen once per frame.
    - Save each frame at the printed per-frame path: `.agent/home-field-workspace/raw/<id>.frame_NN.source.png` (NN = 00, 01, ...).
    - Frames must form a clean loop (last frame must transition smoothly to first).
15. `npm run game:home-field:produce -- spore_motes_loop tap_ripple --resize`. The produce script auto-detects per-frame raws and composes them into the horizontal strip declared in the manifest (`2048×256` and `512×128` respectively).
16. `npm run game:home-field:validate -- --check-files` and `npm run game:home-field:sheet`.
17. Commit, push, **STOP**, report.

### Batch 3 — `proof-character` (the placeholder chibi spritesheet)

Only proceed after the human approves Batch 2.

18. `npm run game:home-field:next -- --batch=proof-character --all` — prints the prompt for `_placeholder`.
19. Generate the 12 named raw frames listed in the prompt body (2 idle frames + 1 walk frame per direction × 4 directions). Save each at the exact path printed. Each frame is 64×64. The placeholder is a generic mushroom-elf silhouette with visible elf ears.
20. `npm run game:home-field:produce -- _placeholder --resize-nearest`. The producer assembles the full `8×4 × 64×64` spritesheet, replicating each walk frame across columns 2–7 of its row.
21. `npm run game:home-field:validate -- --check-files` and `npm run game:home-field:sheet`.
22. Commit, push, **STOP**, report.

### Batch 4 — `full` (remaining static assets)

Only proceed after the human approves Batch 3.

23. `npm run game:home-field:next -- --batch=full --all` — emits whatever's still pending (the rest of the terrain/prop set plus the remaining 3 animated effects).
24. Same loop: generate → produce (`--resize` for static, per-frame for animated) → validate → sheet → commit → push → report.

## How to report between batches

After every batch, post a short report:

```
Batch <name> complete.
  Committed: <comma-separated asset IDs>
  Contact sheet: .agent/home-field-workspace/review/contact-sheet.png
  Status: <output of `npm run game:home-field:status`>
  Notes: <any FAIL/retry, anything you regenerated and why, anything I should look at>
```

Then stop. Do not start the next batch.

## When something goes wrong

- **Validator fails after produce**: read the `[scope.code] message` line. The code points at the contract field that was violated. Regenerate the specific asset; do not edit the validator.
- **Produce FAILs with dimensions mismatch and `--resize` is already passed**: the imagegen output is corrupt or the wrong shape (e.g. portrait instead of square). Re-run imagegen with the same prompt.
- **`no transparency detected; alpha coverage 100%`**: imagegen returned a solid background instead of transparent. Re-prompt with explicit `transparent background required` emphasis, or pass `--chroma-key=#ff00ff` to produce if imagegen returned magenta-keyed.
- **Frame composition fails for an animated asset** (`missing N frame(s)`): you saved frames with the wrong filename. The exact names are printed in the prompt body — match them character-for-character.
- **`home_field_asset_failed` style style drift in the contact sheet** (one tile reads totally differently from its siblings): regenerate that one tile only via `--id=<id>`; do not regenerate the whole batch.
- Anything else: stop, report, ask.

## What you must not do

- Don't open a feature branch. Direct-to-main on `mushroom-master`.
- Don't edit any `.json` / `.js` under `app/shared/home-field/` or the validator/produce/next scripts. They are the contract.
- Don't commit anything under `.agent/home-field-workspace/`. It's gitignored.
- Don't continue past a STOP point. The contact sheet is the gate.
- Don't generate per-character chibis (only the `_placeholder`). Specific-character chibis come in a later phase.
- Don't write text into images. Localized text is rendered at runtime over art-only signposts.

That's it. Start at step 1.

---
