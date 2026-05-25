# Home Field Scene Props Candidate Prompt

Paste this short prompt into a fresh Codex session after the current foliage candidates are reviewed.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, generate the next Home Field object-layer scene-framing candidate batch exactly as documented.

Read and follow:
- docs/home-field-agent-flow.md
- app/shared/home-field/README.md
- app/shared/home-field/home-field-prompts.json

Generate only `mushroom_cluster_small_amber`, `mushroom_cluster_small_violet`, `mushroom_cap_red_spotted`, and `fallen_branch_mycelium` as candidate assets. Goal: make the field feel production-ready with readable edge/foreground personality, not clutter. Use bold simple silhouettes, compact blob shadows, true alpha or flat `#ff00ff` chroma key, and mobile-readable shapes. Avoid tiny detail, busy textures, bright attention-grabbing blobs near the walkable center, text, characters, exits, effects, and terrain.

Produce only to `.agent/home-field-workspace/candidates/object-layer/latest`, run scoped file/review validation, `--check-alpha-halo`, contact sheet, mobile-readability sheet, alpha/halo sheet, and mobile/desktop object candidate preview screenshots. Use `HOME_FIELD_CANDIDATE_IDS` for this exact four-asset batch when running preview. Never approve, never overwrite app-facing PNGs, then commit/push review JSON/docs only if changed and stop.

Final response must include clickable Markdown links to the candidate folder, mobile field screenshot, desktop field screenshot, contact sheet, mobile-readability sheet, and alpha/halo sheet.
```
