# Codex Prompt — Home Field Grass Tile Generation

Copy the block below into a fresh Codex session. It is self-contained and intentionally narrow: generate only the first grass-family terrain batch, validate it, produce review evidence, update review verdicts, commit, push, and stop.

---

You are picking up the imagegen workstream for the **Mushroom Master Home Field hub** in `mushroom-master`.

Your goal is to regenerate only the first grass-family terrain tiles:

- `grass_base_01`
- `grass_base_02`
- `grass_flowers_01`

Do not generate path tiles, edge tiles, props, exits, effects, or chibi sprites. Stop after the grass-family review evidence is ready.

## Required Agent Flow

Use sub-agents only when your Codex environment supports them. If sub-agents are unavailable, perform these stages yourself, but keep the roles separate in your notes and do not let a generation stage approve its own output.

### 1. Orchestrator

Owns the run. It may edit only after a validation or review stage says what needs changing. It must:

- confirm the repo is `mushroom-master` on clean `main`;
- run `npm run game:home-field:validate`;
- run `npm run game:home-field:rerun-grass-field`;
- assign or perform the stages below;
- stop after the grass batch is committed and pushed.

### 2. Prompt/Contract Reviewer

Read-only role. It may read:

- `app/shared/home-field/README.md`
- `docs/home-field-agent-flow.md`
- `docs/home-field-tileset-contract.md`
- `app/shared/home-field/home-field-assets.json`
- `app/shared/home-field/home-field-prompts.json`
- `app/shared/home-field/home-field-style-anchor.json`
- output from `npm run game:home-field:rerun-grass-field`

It must confirm:

- each requested asset is one reusable `256x256` tile cell, not a scene;
- every grass edge remains `grass`;
- no tile contains path, blocker, prop, sign, exit, character, horizon, text, vignette, or focal object;
- style is dark-green, cute-goth, broad, low-frequency, and game-readable;
- the grass will work as a quiet stage under chibi mushroom-elf avatars, with enough rest around character feet.

It must not generate images, edit files, or approve art.

### 3. Imagegen Worker

Generation-only role. It may write only raw files under `.agent/home-field-workspace/raw/`.

For each prompt emitted by `npm run game:home-field:rerun-grass-field`, use the imagegen skill and save the raw PNG exactly to the printed `sourcePath`.

This run uses field-context generation. Do not ask for an isolated square texture. Generate or imagine a larger continuous 3x3 or 4x4 meadow patch first, then save a quiet center crop as the raw source. Reject candidates with columns, rows, diagonal mottling, repeated stamp clusters, hard value bands, edge lighting, or visible square blocks.

Scene target: the final field should feel like a polished in-game hub screenshot with chibi mushroom-elf avatars on a soft green meadow, framed by chunky inked foliage, flowers, vines, mushrooms, gates, and props on object layers. For this grass-only run, do not draw those objects into the tile. Make the ground calm enough that later chibis and props will read clearly on top.

It must reject and regenerate any raw output that:

- looks like a complete illustration, wallpaper, photo, or dense texture;
- contains text, UI, horizon, props, mushrooms, path, blockers, or a unique center focal mark;
- visibly clashes with the style anchor;
- cannot plausibly repeat edge-to-edge as grass.

It must not edit manifests, app PNGs, review JSON, statuses, docs, or tests.

### 4. Producer/Validation Worker

Mechanical role. It runs exactly the producer commands printed in the prompt blocks, then:

```bash
npm run game:home-field:validate -- --check-files --check-connectors --check-review
npm run game:home-field:sheet
npm run game:home-field:adjacency
npx playwright test --config=tests/game/playwright.config.js tests/game/home-field-preview.spec.js --reporter=line
```

It may fix mechanical produce issues by rerunning produce with the printed flags. It must not mark assets approved.

### 5. Visual Critic

Review-only role. It reviews:

- `.agent/home-field-workspace/review/contact-sheet.png`
- `.agent/home-field-workspace/review/adjacency-sheet.png`
- clean `/home-field-preview?debug=0` screenshots from the Playwright run

It updates `docs/home-field-asset-review.json` for only these three grass assets with:

- `repeatCheck`
- `connectorCheck`
- `cleanPreviewCheck`
- `sceneFitCheck`
- `styleCohesionCheck`
- `alphaCheck`
- `scaleCheck`
- `verdict`
- `accepted`
- `reason`

Allowed verdicts without human approval: `needs_review`, `needs_regen`, or `rejected`.

Do not set `"verdict": "approved"` or `"accepted": true` unless the human explicitly approves in this conversation.

## Strict Guardrails

- Direct-to-main workflow: commit completed work on `main` and push to `origin/main`.
- Do not create a feature branch.
- Do not edit `home-field-assets.json`, `home-field-map.json`, validator code, producer code, or prompt scripts during this generation run.
- Do not commit `.agent/home-field-workspace/`; it is local evidence only.
- Do not continue to path or edge tiles.
- Do not claim production-ready art. This run can produce candidates only.
- Production validation is expected to fail until human-approved assets exist.

## Run Order

1. `cd /Users/microwavedev/workspace/microwave-hub/mushroom-master`
2. `git status --short --branch`
3. If the tree is not clean on `main`, stop and report.
4. `npm run game:home-field:validate`
5. `npm run game:home-field:rerun-grass-field`
6. Generate only the three raw PNGs printed by that command.
7. Run the printed `npm run game:home-field:produce -- <id> ...` command for each generated asset.
8. Run the validation and review commands from the Producer/Validation Worker section.
9. Update `docs/home-field-asset-review.json` for only the three grass rows.
10. Run:

```bash
npm run game:home-field:validate -- --check-files --check-connectors --check-review
node --test tests/game/home-field-pipeline.test.js
git diff --check
```

11. Commit and push:

```bash
git add web/public/home-field/terrain/grass_base_01.png \
  web/public/home-field/terrain/grass_base_02.png \
  web/public/home-field/terrain/grass_flowers_01.png \
  docs/home-field-asset-review.json
git commit -m "Regenerate home field grass tile candidates"
git push origin main
```

12. Stop and report:

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
  <what was regenerated, rejected, retried, or still visually weak>
```

Then wait for human approval before generating any path or edge terrain.

---
