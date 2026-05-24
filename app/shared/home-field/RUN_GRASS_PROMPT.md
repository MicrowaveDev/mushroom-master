# Home Field Grass Run Prompt

Paste this short prompt into a fresh Codex session.

```text
In /Users/microwavedev/workspace/microwave-hub/mushroom-master, run the Home Field grass candidate workflow exactly as documented.

Read and follow:
- app/shared/home-field/RUN_GRASS_PROMPT.md
- docs/home-field-agent-flow.md
- app/shared/home-field/README.md

Use separate sub-agents if available. Generate only the shared grass-family source via `npm run game:home-field:rerun-grass-family`, produce/review only the three grass tiles as a candidate folder, never approve or overwrite app PNGs without explicit human approval, then commit/push review JSON/docs only if changed and stop. Final response must include a clickable Markdown folder link exactly like: `Candidate folder: [open in Finder](/Users/microwavedev/workspace/microwave-hub/mushroom-master/.agent/home-field-workspace/candidates/grass-family/latest)`.
```
