# Telegram Autobattler V1 Evidence

## Implementation summary

The repository now contains a new game stack alongside the existing lore/archive workflows:

- backend and API entrypoint under `app/server/`
- Vue Mini App frontend under `web/`
- structured wiki source content under `wiki/`
- game-focused automated tests under `tests/game/`
- proof-loop bundle under `.agent/tasks/telegram-autobattler-v1/`

Core implementation areas:

- shared auth and session handling in `app/server/auth.js`
- Telegram discovery and bot-code handoff helpers in `app/server/bot-gateway.js`
- PostgreSQL-compatible schema and DB abstraction in `app/server/schema.js` and `app/server/db.js`
- v1 game content and balance tables in `app/server/game-data.js`
- player, loadout, battle, leaderboard, friendship, challenge, and local-test services in `app/server/services/game-service.js`
- repo-authored wiki reader in `app/server/wiki.js`
- runtime API surface in `app/server/create-app.js`
- v1 Mini App shell and screens in `web/src/main.js` and `web/src/styles.css`

## Criterion evidence

### AC1

PASS. The durable task bundle exists under `.agent/tasks/telegram-autobattler-v1/` with:

- `spec.md`
- `evidence.md`
- `evidence.json`
- `verdict.json`
- `raw/` logs and screenshot artifacts

Proof:

- `.agent/tasks/telegram-autobattler-v1/raw/task-tree.txt`

### AC2

PASS. The repo now includes:

- Node.js backend files in `app/server/`
- Vue + JavaScript frontend in `web/`
- PostgreSQL-compatible persistence via `pg` and `pg-mem`
- runnable local build/test flows in `package.json`

Proof:

- `package.json`
- `package-lock.json`
- `.agent/tasks/telegram-autobattler-v1/raw/game-build.txt`
- `.agent/tasks/telegram-autobattler-v1/raw/game-test.txt`

### AC3

PASS. Shared session auth is implemented for signed Telegram `initData` and one-time Telegram bot-code fallback, with shared session-key lookup via `X-Session-Key` and `Authorization: Bearer ...`.

Proof:

- `app/server/auth.js`
- automated auth coverage in `tests/game/auth.test.js`
- pass record in `.agent/tasks/telegram-autobattler-v1/raw/game-test.txt`

### AC4

PASS. Mention/deep-link discovery helpers and bot start handling exist in the bot gateway. Browser fallback auth payloads generate DM bot links and the code-confirm path is implemented.

Proof:

- `app/server/bot-gateway.js`
- `app/server/create-app.js`
- auth-code flow coverage in `tests/game/auth.test.js`

### AC5

PASS. Player, settings, sessions, active character, per-character progression, and loadout persistence are stored through the database layer and returned by bootstrap/profile state assembly.

Proof:

- `app/server/schema.js`
- `app/server/services/game-service.js`
- `tests/game/loadout-and-battle.test.js`

### AC6

PASS. All five launch mushrooms are implemented in `app/server/game-data.js`, including Thalla, Lomie, Axilin, Kirt, and Morga. Character selection persistence is wired through the frontend and service layer.

Proof:

- `app/server/game-data.js`
- `web/src/main.js`
- screenshots:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/03-characters.png`

### AC7

PASS. The Vue artifact builder uses a `4x4` CSS grid, tap-to-place flow, canonical placement rows, and validation for exact-count, duplicates, overlap, and bounds.

Proof:

- `web/src/main.js`
- `web/src/styles.css`
- `app/server/services/game-service.js`
- `tests/game/loadout-and-battle.test.js`
- screenshot:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/04-artifacts.png`

### AC8

PASS. Deterministic `1v1` battles, server-authored event logs, snapshot-based combatants, fixed-seed replay determinism, ghost matchmaking, and one-sided ghost reward handling are implemented.

Proof:

- `app/server/services/game-service.js`
- `tests/game/loadout-and-battle.test.js`
- screenshots:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/05-battle-prep.png`
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/06-replay.png`

### AC9

PASS. Replay rendering, results, `spore`, per-character `mycelium`, and display-only levels are implemented and surfaced in the app.

Proof:

- `web/src/main.js`
- `app/server/services/game-service.js`
- screenshots:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/06-replay.png`
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/07-results.png`
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/13-profile.png`

### AC10

PASS. Elo-style leaderboard ordering and the scoring distinction between one-sided ghost battles and accepted two-sided friend battles are implemented.

Proof:

- `app/server/services/game-service.js`
- `tests/game/social-wiki-lab.test.js`
- screenshot:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/10-leaderboard.png`

### AC11

PASS. Unique 6-digit friend codes, add-by-code, challenge creation, explicit accept flow, and two-sided scored friend battles are implemented.

Proof:

- `app/server/services/game-service.js`
- `tests/game/social-wiki-lab.test.js`
- screenshot:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/09-friends.png`

### AC12

PASS. Structured wiki folders exist under `wiki/`, built as repo-authored markdown pages. Backend wiki APIs read and render them, and the frontend exposes wiki home/detail screens.

Proof:

- `wiki/characters/`
- `wiki/factions/`
- `wiki/locations/`
- `wiki/glossary/`
- `app/server/wiki.js`
- `tests/game/social-wiki-lab.test.js`
- screenshots:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/11-wiki-home.png`
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/12-wiki-detail.png`

### AC13

PASS. The Local AI Test Lab is runtime-gated through `/api/app-config` and server environment checks, exposed in non-production UI/runtime, and persisted separately in `local_test_runs`.

Proof:

- `app/server/create-app.js`
- `web/src/main.js`
- `app/server/services/game-service.js`
- `tests/game/social-wiki-lab.test.js`
- screenshot:
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots/15-local-lab.png`

### AC14

PASS. Fresh verification was run after implementation without editing production code during the verification pass.

Proof:

- automated API/service verification:
  - `.agent/tasks/telegram-autobattler-v1/raw/game-test.txt`
- production frontend build:
  - `.agent/tasks/telegram-autobattler-v1/raw/game-build.txt`
- screenshot verification:
  - `.agent/tasks/telegram-autobattler-v1/raw/playwright-screenshots.txt`
  - `.agent/tasks/telegram-autobattler-v1/raw/screenshots-manifest.txt`

## Fresh verification summary

Fresh verification commands:

- `npm run game:test`
- `npm run game:build`
- `npx playwright test tests/game/screenshots.spec.js --config=tests/game/playwright.config.js --reporter=line`

All three passed in the fresh verification pass recorded under `raw/`.

## Drift / assumptions / non-v1 backlog

No production-scope drift was intentionally added beyond implementation choices needed to realize the plan.

Notable implementation choices:

- local and test environments use the same PostgreSQL-shaped schema through `pg-mem` when `DATABASE_URL` is absent
- the frontend uses a single Vue SPA file for the initial v1 shell instead of a large component tree
- the canonical game slug is `axilin`, while wiki source explicitly documents the legacy `axylin` spelling from older repo assets
- Morga's wiki page is repo-authored from the v1 launch plan because the existing lore archive does not yet provide the same source depth as the older characters

Still intentionally outside v1:

- notifications and inbox delivery
- seasons and seasonal ladders
- status effects beyond stun
- monetization
- deeper skill trees
- custom avatars
- artifact rotation or advanced packing puzzles
