# Home Field Scene Props Candidate Batch

Paste this launcher prompt into a fresh Codex session:

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field scene props candidate batch with sub-agents, exactly as documented in app/shared/home-field/RUN_SCENE_PROPS_PROMPT.md. Candidate-only, no app overwrite, validation/screenshots/final links required.
```

The canonical run instructions are below. The launcher prompt should stay short and point here instead of repeating the details.

## Canonical Run Instructions

Read and follow:

- docs/home-field-agent-flow.md
- app/shared/home-field/README.md
- app/shared/home-field/home-field-prompts.json

Use sub-agents if available, with narrow scopes: one generation agent for the four raw/candidate assets, one review agent for mobile/desktop screenshots and sheets, and one validation agent for commands and final evidence. Keep all writes inside `.agent/home-field-workspace/candidates/object-layer/latest`, `.agent/home-field-workspace/review`, and review/docs files only. Do not let any sub-agent approve candidates or overwrite app-facing PNGs.

Generate only `mushroom_cluster_small_amber`, `mushroom_cluster_small_violet`, `mushroom_cap_red_spotted`, and `fallen_branch_mycelium` as candidate assets. Goal: make the field feel production-ready with readable edge/foreground personality, not clutter.

Pixel budget: these props render in about a 52x52 CSS box on the 375x667 mobile preview and about a 90x90 CSS box on desktop. The visible alpha silhouette may be only 30-48px wide on mobile, so design them as tiny field tokens, not hero illustrations. Each prop needs one bold outside silhouette, 2-3 main color regions, 0-3 large accent marks, and a compact shadow. Avoid gills, many spots, many tiny caps, root tangles, bark chips, fine veins, realistic texture, glossy highlights, bright glow blobs, or any detail that only works at 256px.

Asset shape targets: small mushroom clusters should be 2-3 squat caps total, not 5+ caps; the red spotted cap should use 3-5 large cream spots, no gill forest; the fallen branch should be a simple low log silhouette with one chunky mycelium wrap and maybe 1-2 tiny mushrooms, not a nest of roots. Use true alpha or flat `#ff00ff` chroma key. Avoid bright attention-grabbing blobs near the walkable center, text, characters, exits, effects, and terrain.

Produce only to `.agent/home-field-workspace/candidates/object-layer/latest`, run scoped file/review validation, `--check-alpha-halo`, contact sheet, mobile-readability sheet, alpha/halo sheet, and mobile/desktop object candidate preview screenshots. Use `HOME_FIELD_CANDIDATE_IDS` for this exact four-asset batch when running preview. Never approve, never overwrite app-facing PNGs, then commit/push review JSON/docs only if changed and stop.

Final response must include clickable Markdown links to the candidate folder, mobile field screenshot, desktop field screenshot, contact sheet, mobile-readability sheet, and alpha/halo sheet.
