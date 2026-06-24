# Home Field Grass Run Prompt

Paste this short prompt into a fresh Codex session.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field grass candidate workflow exactly as documented.

Read and follow:
- app/shared/home-field/RUN_GRASS_PROMPT.md
- docs/home-field-imagegen-requirements.md
- docs/home-field-agent-flow.md
- docs/home-field-scale-contract.md
- app/shared/home-field/README.md

Use separate sub-agents if available. Generate only the shared grass-family source via `npm run game:home-field:rerun-grass-family`, keeping the same elevated top-down 2.5D camera, palette, lighting, and scale contract as the rest of Home Field. Produce/review only the three grass tiles as a candidate folder, run the candidate field preview screenshot, never approve or overwrite app PNGs without explicit human approval, then commit/push review JSON/docs only if changed and stop. Final response must include clickable Markdown links for the candidate folder and the mobile/desktop candidate field screenshots. Folder link example: `Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)`.
```
