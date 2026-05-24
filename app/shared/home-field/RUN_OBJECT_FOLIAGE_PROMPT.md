# Home Field Object Foliage Cleanup Prompt

Paste this short prompt into a fresh Codex session.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, rerun the Home Field object-layer foliage candidate cleanup exactly as documented.

Read and follow:
- app/shared/home-field/RUN_OBJECT_FOLIAGE_PROMPT.md
- docs/home-field-agent-flow.md
- app/shared/home-field/README.md

Use separate sub-agents if available. Generate only `bush_cluster_dark_01`, `bush_cluster_light_01`, and `leaf_sprout_01` as candidate assets. Fix the known issues: no magenta/pink alpha fringe, and make the bushes feel more natural and simpler for mobile: one irregular asymmetric shrub mass with a bold silhouette, 3-5 readable major lobes, uneven scalloped edges, small negative notches, and very little internal leaf texture. Avoid broccoli/cauliflower blobs, flower rosettes, evenly spaced circular clumps, repeated stamp marks, tiny leaf noise, or a mound made from many same-size round bushes. The asset must still read at 48-64px in the mobile-readability sheet. Keep `leaf_sprout_01` larger, chunkier, readable at mobile scale, with 3-5 broad leaves, a warm dark outline, and compact shadow.

Produce only to `.agent/home-field-workspace/candidates/object-layer/latest`, run scoped file/review validation, `--check-alpha-halo`, `--check-readability`, contact sheet, mobile-readability sheet, alpha/halo sheet, and mobile/desktop object candidate preview screenshots. Never approve, never overwrite app-facing PNGs, never generate chibi/exits/effects/paths in this run, then commit/push review JSON/docs/scripts only if changed and stop.

Final response must include clickable Markdown links to the candidate folder, mobile field screenshot, desktop field screenshot, contact sheet, mobile-readability sheet, and alpha/halo sheet.
```
