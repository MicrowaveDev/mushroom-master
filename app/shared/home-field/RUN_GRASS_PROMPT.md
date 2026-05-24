# Home Field Grass Run Prompt

Paste this short prompt into a fresh Codex session.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field grass candidate workflow.

Follow the durable instructions in:
- docs/home-field-agent-flow.md
- app/shared/home-field/README.md

Use separate sub-agents if available: Prompt/Contract Reviewer, Imagegen Worker, Producer/Validation Worker, Visual Critic. A single read-only sidecar is not enough.

Prompt queue:
npm run game:home-field:rerun-grass-family

Generate one shared meadow source only. Save it to the printed .agent/home-field-workspace/raw/grass_family_meadow.source.png path, then run the printed family producer command. Do not generate separate per-tile raw PNGs.

Target: a quiet soft green meadow stage for chibi mushroom-elf avatars, with foliage/props on object layers. Reject noisy texture, square seams, rows/columns, diagonal mottling, focal marks, paths, props, characters, horizons, text, and anything that competes with 64px chibi feet/shadows.

Run validation, contact sheet, adjacency sheet, and preview screenshot checks required by docs/home-field-agent-flow.md. Update only those three rows in docs/home-field-asset-review.json, including sceneFitCheck and familyCohesionCheck. Do not approve or set accepted:true without explicit human approval.

Commit and push candidate PNGs plus review JSON on main, then stop and report SHA, verdicts, contact sheet, adjacency sheet, and clean preview screenshot paths.
```
