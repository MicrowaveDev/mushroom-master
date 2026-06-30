# Minimal Home Field Run Prompt

Use this short prompt when the goal is the fastest production-looking Home Field candidate instead of a narrow grass, prop, or chibi batch.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the minimal Home Field production-candidate plan with subagents.

Follow app/shared/home-field/RUN_MINIMAL_HOME_FIELD_PROMPT.md, docs/home-field-minimal-production-plan.md, docs/home-field-imagegen-requirements.md, docs/home-field-agent-flow.md, and docs/home-field-runtime-asset-contract-plan.md exactly.

Generate only this candidate scope: grass_base_01, grass_base_02, grass_flowers_01, path_h_end_w, path_dirt_straight, path_spore_glow, path_h_end_e, path_destination_row, bush_cluster_dark_01, bush_cluster_light_01, leaf_sprout_01, mushroom_cluster_small_amber, mushroom_cluster_small_violet, mushroom_cap_red_spotted, fallen_branch_mycelium, arena_mushroom_arch, journey_gate_under_construction, thalla. Optional second chibi only after Thalla passes scene review.

Candidate-only: do not overwrite web/public/home-field, do not approve assets, and do not set accepted=true.

For Thalla, run `npm run game:home-field:preflight-chibi-proof` first and stop if it fails, except for the one diagnostic built-in output probe allowed by `docs/home-field-imagegen-requirements.md` only when reference-image input binding is already confirmed and disk output is the remaining blocker. Only after preflight passes, archive stale rejected raw/reference/candidate files with `npm run game:home-field:archive-stale-chibi-proof -- thalla`; do not delete or reuse them. Then generate a non-production sprite-box reference using the checked-in Thalla/style PNGs as actual imagegen inputs, not another text-only reference attempt, `view_image`-only attempt, or large painterly turnaround; claim built-in output with `npm run game:home-field:claim-imagegen-output` when needed, visually reject the reference if it misses the style, generate one coherent grouped `8x4` state sheet, and split it into final raw frames. Idle bob and walk poses must be in the grouped sheet itself, not synthesized after split. Use a limited sprite palette: prefer `12-18` artist-visible colors and stay under `20`, excluding transparency and chroma-key. Use smooth `--resize`, not `--resize-nearest`, when producing the candidate. Mechanical readability does not count as style approval.

Use separate subagents for contract review, terrain, props/entrances, chibi, producer/validation, and visual criticism. Judge success from the composed mobile/desktop clean field screenshots, including raw-source completeness, alpha/edge safety, anchor stability, runtime-scale readability, and scene fit. Final response must include clickable links to the candidate folder, evidence manifest, review sheets, and mobile/desktop clean screenshots.
```
