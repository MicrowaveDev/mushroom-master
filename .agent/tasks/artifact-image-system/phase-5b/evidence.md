# Phase 5B Evidence — Per-Artifact Battle-Event Attribution

Status: PASS

## AC5.1

PASS. New battle `action` events include `artifactAttribution` groups for placed non-bag artifacts that positively contribute attack damage, stun chance, or target armor. Replay renders those groups as compact artifact chips near the active hit feedback.

## AC5.2

PASS. The attribution display is static DOM text/chip state, so reduced-motion mode still conveys the same information without relying on animation.

## AC5.3

PASS. Attribution chips render in the replay center lane below the damage pop and above the status/log area. The refreshed replay screenshot shows no HP obstruction or broken image state.

## AC5.4

PASS. Stage B landed `[Req 6-K]` in `docs/game-requirements.md`. Tests cover both new event attribution and legacy action events without `artifactAttribution`.

## Commands Run

```bash
node --check app/server/services/battle-engine.js
node --check web/src/components/ReplayDuel.js
node --test tests/game/battle-engine.test.js
node --test tests/web/replay-attribution.test.js
node --test tests/web/artifact-render.test.js
npm run game:test:screens
npm run game:build
```

## Screenshot Evidence

```text
.agent/tasks/telegram-autobattler-v1/raw/screenshots/06-replay.png
.agent/tasks/telegram-autobattler-v1/raw/screenshots/06-replay.json
```
