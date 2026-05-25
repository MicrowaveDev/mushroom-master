# Run Home Field Chibi Proof

Use this file as the canonical instruction set for the next chibi generation run.

## Short Launcher Prompt

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field chibi Stage 1 proof with sub-agents, exactly as documented in app/shared/home-field/RUN_CHIBI_PROOF_PROMPT.md. Generate only thalla. Candidate-only, no app overwrite, validation/screenshots/final links required.
```

## Required Flow

1. Use sub-agents for separate roles: Producer, Validator, Visual Critic, and Handoff.
2. Read `docs/home-field-chibi-candidate-contract.md`, `docs/home-field-agent-flow.md`, `app/shared/home-field/home-field-prompts.json`, and `docs/design-requirements.md`.
3. Generate only `thalla`. Do not generate Lomie, Axilin, Kirt, Morga, or Dalamar in Stage 1.
4. Use `npm run game:home-field:next-chibi-proof` to print the current prompt and commands.
5. Generate per-frame transparent PNGs into the exact `thalla_chibi.frame_*.source.png` raw paths from the contract.
6. Produce with `npm run game:home-field:produce-chibi-candidate -- thalla --resize-nearest --chroma-key=#ff00ff`.
7. Validate and build evidence using the candidate root:

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

Stage 1 proves the character design, not animation polish. Use 8 unique poses minimum: idle and walk for down, up, left, and right. Fill the current 12 composer slots by duplicating or subtly varying the idle pose for each direction.

Thalla must read at `64px` on mobile as an ancient gold-white mushroom-elf sovereign with visible mushroom-elf biology, strong simple silhouette, grounded feet/base, compact shadow, dark warm outline, and restrained bone/gold/white/brown palette. Avoid portrait detail, human-with-hat reads, baked backgrounds, text, UI, floor planes, and loose glow effects that hide the body.

## Final Response Requirement

The final response must include:

- verdict for `thalla`
- exact validation commands run and pass/fail
- screenshot/evidence paths
- candidate folder link: `/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/chibi-active-roster/latest`
- note that no app-facing PNG was overwritten
