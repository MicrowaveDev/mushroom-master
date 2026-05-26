# Run Home Field Chibi Proof

Use this file as the canonical instruction set for the next chibi generation run.

## Short Launcher Prompt

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field chibi Stage 1 proof with sub-agents, exactly as documented in app/shared/home-field/RUN_CHIBI_PROOF_PROMPT.md. Generate only thalla. Candidate-only, no app overwrite, validation/screenshots/final links required.
```

## Required Flow

1. Use sub-agents for separate roles: Producer, Validator, Visual Critic, and Handoff.
2. Read `docs/home-field-chibi-candidate-contract.md`, `docs/home-field-chibi-style-reference.md`, `docs/home-field-agent-flow.md`, `app/shared/home-field/home-field-prompts.json`, and `docs/design-requirements.md`.
3. Generate only `thalla`. Do not generate Lomie, Axilin, Kirt, Morga, or Dalamar in Stage 1.
4. Use `npm run game:home-field:next-chibi-proof` to print the current prompt and commands.
5. Generate one non-production reference turnaround sheet first and save it to `.agent/home-field-workspace/reference/thalla_chibi_turnaround.reference.png`. It should show Thalla in `down`, `up`, `left`, and `right` directions with the same proportions, top-down 2.5D camera, palette, and detail budget. This reference is for consistency only; do not slice it into final frames.
6. Generate each final raw frame as a separate isolated transparent PNG into the exact `thalla_chibi.frame_*.source.png` raw paths from the contract. If the run asks for retina/source quality, `128x128` isolated source frames are allowed, but they must downscale cleanly to the current `64x64` runtime sheet. Do not generate final raw frames by cropping a sheet, lineup, grid, scene, or larger multi-sprite image.
7. Produce with `npm run game:home-field:produce-chibi-candidate -- thalla --resize-nearest --chroma-key=#ff00ff`.
8. Validate and build evidence using the candidate root:

```bash
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-review
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-alpha-halo
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:validate -- --ids=thalla --check-files --check-readability
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:sheet
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:mobile-readability-sheet -- --ids=thalla
HOME_FIELD_ASSET_ROOT=.agent/home-field-workspace/candidates/chibi-active-roster/latest npm run game:home-field:alpha-sheet -- --ids=thalla
npm run game:home-field:chibi-candidate-preview
```

## Stage 1 Visual Target

Stage 1 proves the character design, not animation polish. Use the reference turnaround sheet to keep the four directions consistent. Then create 8 unique final poses minimum: idle and walk for down, up, left, and right. Fill the current 12 composer slots by duplicating or subtly varying the idle pose for each direction.

Thalla must read at `64px` on mobile as an ancient gold-white mushroom-elf sovereign with visible mushroom-elf biology, strong simple silhouette, grounded feet/base, compact shadow, dark warm outline, and restrained bone/gold/white/brown palette. Use `docs/home-field-chibi-style-reference.md` for the desired squat field-sprite feel, but do not copy the reference image and do not use huge white portrait eyes.

Use an elevated top-down 2.5D hub-sprite view: the top of the mushroom cap/head should be visible, the body should feel planted on the map, and the pose should feel like a small walkable-field character rather than a front-facing portrait sticker. Keep the design less detailed than character art: broad shapes first, `2-3` main color regions, `1-2` gold mycelium/spore marks, tiny face features only, and no ornate filigree, particle halo, jewelry clusters, lace-like micro-detail, or oversized eye treatment. Avoid human-with-hat reads, baked backgrounds, text, UI, floor planes, and loose glow effects that hide the body.

If the reference sheet looks good but any isolated raw frame drifts from it, regenerate that raw frame. If any final raw frame contains multiple sprites, a mini spritesheet, a border, a background, crop artifacts, or detail that disappears into noise at mobile scale, regenerate before producing the candidate sheet.

## Final Response Requirement

The final response must include:

- verdict for `thalla`
- exact validation commands run and pass/fail
- reference turnaround sheet path
- screenshot/evidence paths
- candidate folder link: `/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/chibi-active-roster/latest`
- note that no app-facing PNG was overwritten
