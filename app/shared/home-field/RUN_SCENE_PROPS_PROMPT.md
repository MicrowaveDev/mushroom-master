# Home Field Scene Props Candidate Batch

Paste this launcher prompt into a fresh Codex session:

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field scene prop polish batch with sub-agents, exactly as documented in app/shared/home-field/RUN_SCENE_PROPS_PROMPT.md. Generate only: mushroom_cluster_small_violet. Candidate-only, no app overwrite, validation/screenshots/final links required.
```

The canonical run instructions are below. The launcher prompt should stay short and point here instead of repeating the details.

## Canonical Run Instructions

Read and follow:

- docs/home-field-agent-flow.md
- app/shared/home-field/README.md
- app/shared/home-field/home-field-prompts.json

Print the current prompt blocks with `npm run game:home-field:rerun-scene-props`. This is the intentional candidate rerun path for scene props that already have app-facing files, so do not use a plain `game:home-field:next -- --id=...` result of "nothing to generate" as a stop condition.

Use sub-agents if available, with narrow scopes: one generation agent for the four raw/candidate assets, one review agent for mobile/desktop screenshots and sheets, and one validation agent for commands and final evidence. Keep all writes inside `.agent/home-field-workspace/candidates/object-layer/latest`, `.agent/home-field-workspace/review`, and review/docs files only. Do not let any sub-agent approve candidates or overwrite app-facing PNGs.

Generate only `mushroom_cluster_small_violet` as a candidate asset. Do not regenerate `mushroom_cluster_small_amber`, `mushroom_cap_red_spotted`, or `fallen_branch_mycelium`; the latest review marks them `needs_review` pending human approval. Goal: fix the violet cluster's weak gray/low-identity read while keeping it production-ready as quiet edge/foreground personality, not clutter.

Pixel budget: these props render in about a 52x52 CSS box on the 375x667 mobile preview and about a 90x90 CSS box on desktop. The visible alpha silhouette may be only 30-48px wide on mobile, so design them as tiny field tokens, not hero illustrations. Each prop needs one bold outside silhouette, 2-3 main color regions, 0-3 large accent marks, and a compact shadow. Avoid gills, many spots, many tiny caps, root tangles, bark chips, fine veins, realistic texture, glossy highlights, bright glow blobs, or any detail that only works at 256px.

Asset shape target: the violet cluster should have 2-3 squat caps total, a clear muted violet cap read at 32-48px, a merged simple base, no gray-only caps, no saturated neon glow, no tiny cap field, and no gills. Use true alpha or flat `#ff00ff` chroma key. Avoid bright attention-grabbing blobs near the walkable center, text, characters, exits, effects, and terrain.

Produce only to `.agent/home-field-workspace/candidates/object-layer/latest` using `npm run game:home-field:produce-object-candidate -- mushroom_cluster_small_violet --resize --chroma-key=#ff00ff`, run scoped file/review validation, `--check-alpha-halo`, contact sheet, mobile-readability sheet, alpha/halo sheet, and mobile/desktop object candidate preview screenshots. Use `HOME_FIELD_CANDIDATE_IDS=mushroom_cluster_small_violet` for preview. Never approve, never overwrite app-facing PNGs, then commit/push review JSON/docs only if changed and stop.

Final response must include a per-asset visual verdict (`needs_review`, `needs_regen`, or `rejected`) plus clickable Markdown links to the candidate folder, mobile field screenshot, desktop field screenshot, contact sheet, mobile-readability sheet, and alpha/halo sheet.
