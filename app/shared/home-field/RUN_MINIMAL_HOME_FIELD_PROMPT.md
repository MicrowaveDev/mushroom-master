# Minimal Home Field Run Prompt

Use this short prompt when the goal is the fastest production-looking Home Field candidate instead of a narrow grass, prop, or chibi batch.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the minimal Home Field production-candidate plan with subagents.

Follow app/shared/home-field/RUN_MINIMAL_HOME_FIELD_PROMPT.md, docs/home-field-minimal-production-plan.md, docs/home-field-agent-flow.md, and docs/home-field-runtime-asset-contract-plan.md exactly.

Generate only this candidate scope: grass_base_01, grass_base_02, grass_flowers_01, path_h_end_w, path_dirt_straight, path_spore_glow, path_h_end_e, path_destination_row, bush_cluster_dark_01, bush_cluster_light_01, leaf_sprout_01, mushroom_cluster_small_amber, mushroom_cluster_small_violet, mushroom_cap_red_spotted, fallen_branch_mycelium, arena_mushroom_arch, journey_gate_under_construction, thalla. Optional second chibi only after Thalla passes scene review.

Candidate-only: do not overwrite web/public/home-field, do not approve assets, and do not set accepted=true.

For Thalla, clear stale rejected raw/candidate files first, generate a non-production turnaround reference, visually reject the reference if it misses the style, then generate one coherent grouped `8x4` state sheet and split it into final raw frames. Idle bob and walk poses must be in the grouped sheet itself, not synthesized after split. Use smooth `--resize`, not `--resize-nearest`, when producing the candidate. Mechanical readability does not count as style approval.

Use separate subagents for contract review, terrain, props/entrances, chibi, producer/validation, and visual criticism. Judge success from the composed mobile/desktop clean field screenshots, including raw-source completeness, alpha/edge safety, anchor stability, runtime-scale readability, and scene fit. Final response must include clickable links to the candidate folder, evidence manifest, review sheets, and mobile/desktop clean screenshots.
```
