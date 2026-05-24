# Home Field Object Foliage Cleanup Prompt

Paste this short prompt into a fresh Codex session.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, rerun the Home Field object-layer foliage candidate cleanup exactly as documented.

Read and follow:
- app/shared/home-field/RUN_OBJECT_FOLIAGE_PROMPT.md
- docs/home-field-agent-flow.md
- app/shared/home-field/README.md

Use separate sub-agents if available. Generate only `bush_cluster_dark_01`, `bush_cluster_light_01`, and `leaf_sprout_01` as candidate assets. Fix the known issues: no magenta/pink alpha fringe on bushes, and make `leaf_sprout_01` larger, chunkier, readable at mobile scale, with a warm dark outline and compact shadow.

Produce only to `.agent/home-field-workspace/candidates/object-layer/latest`, run scoped file/review validation, `--check-alpha-halo`, contact sheet, alpha/halo sheet, and mobile/desktop object candidate preview screenshots. Never approve, never overwrite app-facing PNGs, never generate chibi/exits/effects/paths in this run, then commit/push review JSON/docs/scripts only if changed and stop.

Final response must include clickable Markdown links to the candidate folder, mobile field screenshot, desktop field screenshot, contact sheet, and alpha/halo sheet.
```
