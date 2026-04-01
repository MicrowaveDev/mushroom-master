# Telegram Autobattler V1 Spec

## Source of Truth

### Original request

Implement the Telegram mushroom auto-battler plan through the full v1 app in this repository.

Primary source documents:

- `/Users/microwavedev/workspace/mushroom-master/docs/telegram-mushroom-autobattler-plan.md`
- `/Users/microwavedev/workspace/mushroom-master/AGENTS.md`
- `/Users/microwavedev/workspace/mushroom-master/.agent/workflows/ui-design.md`

### Stated criteria and constraints

- Treat the plan doc as the primary product and architecture spec.
- Follow the repo-local proof-loop workflow for this task.
- Create a durable task folder under `.agent/tasks/telegram-autobattler-v1/`.
- Freeze the task into `spec.md` with explicit `AC1`, `AC2`, and so on before substantial implementation.
- Keep implementation, evidence, fresh verification, and fixes clearly separated.
- Validate after each meaningful stage.
- Do not claim completion until every v1 acceptance criterion is actually proven.
- Build the v1 Telegram Mini App and backend in this repo using:
  - frontend: Vue + JavaScript
  - backend: Node.js + JavaScript
  - database: PostgreSQL
- Implement the shared session architecture from the plan:
  - Telegram Mini App auth via signed `initData`
  - browser fallback auth via one-time bot-code handoff
  - same app session format for both
  - protected APIs accept `X-Session-Key` or `Authorization: Bearer ...`
- Implement the v1 feature scope listed in the user request and plan, including:
  - Telegram bot entry flow for mention and deep-link discovery
  - Telegram Mini App shell
  - Telegram auth and browser fallback auth
  - player/session persistence
  - five launch mushrooms
  - character selection
  - artifact library and `4x4` artifact-grid builder
  - exactly 3 artifacts required
  - no duplicates
  - no rotation
  - no overlap
  - save loadout to DB using placement rows, not raw cell storage
  - deterministic `1v1` battle engine
  - random ghost matchmaking in v1
  - friend-code system
  - friend challenge flow with explicit accept from link
  - battle replay based on stored server-authored event logs
  - results, `spore`, per-character `mycelium`, levels tracked only as display progression
  - leaderboard with v1 scoring rules from the plan
  - structured wiki built from existing markdown sources reorganized into wiki folders
  - Russian-first UI with English toggle
  - Local AI Test Lab in local/dev only
  - no notifications in v1
  - no seasonality in v1
- Respect critical v1 rules:
  - ghost, offline, and snapshot opponent battles are one-sided for rewards, stats, and rating
  - accepted live friend battles score both players
  - levels unlock nothing in v1
  - wiki is canon and repo-authored, not edited in-app
  - do not add status effects, monetization, custom avatars, season systems, or deeper skill trees
- Follow the suggested phase order from the user request unless blocked by a smaller safe sequencing adjustment.
- Artifact builder requirements:
  - Vue UI
  - CSS grid board for `4x4`
  - placements saved canonically as artifact placements with coordinates
  - occupancy and stat totals derived from placements plus artifact definitions
  - validate bounds, overlap, duplicates, and exact count of 3
  - mobile-first behavior that works in Telegram
  - tap-to-place required
  - drag and drop optional only if it does not compromise mobile behavior
- Verification requirements:
  - create and maintain proof-loop artifacts
  - run focused tests throughout
  - run a fresh verification pass that does not edit production code
  - if verification fails, write `problems.md`, apply the smallest safe fix, regenerate evidence, and verify again

### Success conditions

- The repository contains a working v1 Telegram Mini App and backend aligned with the plan.
- Every v1 acceptance criterion below is proven with current-repo evidence.
- The proof-loop bundle contains durable spec, evidence, raw proof, and final verification outputs.
- Any non-v1 work remains explicitly outside scope and is not silently introduced.

### Non-goals

- Notifications and inbox delivery UI.
- Seasonality or seasonal ladders.
- Status effects beyond stun.
- Branching skill choices or deeper skill trees.
- Custom avatar uploads.
- Monetization.
- Rotation, advanced packing puzzles, or duplicate artifacts.
- Real-time multiplayer.
- In-app wiki editing.

### Open assumptions

- The current repo may not yet include a web server, frontend bundler, or PostgreSQL wiring, so those will be added as part of implementation in the smallest coherent form that satisfies the plan.
- Existing lore/archive flows should remain intact unless a change is required to support the new wiki pipeline.
- If the full existing markdown corpus is too large to fully remodel in one step, the v1 wiki will prioritize the launch mushrooms, locations, factions, and glossary coverage needed by the plan while keeping the folder structure extensible.

## Continuation Freeze 2026-04-01

### Additional user requirement

- The artifact builder must show the actual artifact shapes in a Backpack Battles-style packing UI instead of raw artifact ids in cells.
- The same artifact figure must be reused in the artifact library and in the placed result container so the player sees the same shape before and after placement.

### Additional constraints

- Keep the existing `4x4` tap-to-place interaction working in mobile and Telegram contexts.
- Prefer SVG-backed or equivalent deterministic repo-authored artifact visuals over text labels inside cells.
- Do not change artifact gameplay rules, placement storage rules, or introduce rotation.

## Acceptance Criteria

### AC1. Foundation and proof-loop bundle

The task bundle exists under `.agent/tasks/telegram-autobattler-v1/` and contains a stable spec, evidence files, raw artifacts, and final verification outputs that map criterion-level proof to the current repository state.

### AC2. Full-stack app foundation

The repository contains a Node.js backend, Vue + JavaScript frontend, and PostgreSQL-backed persistence path for the v1 app, with runnable local build/test flows.

### AC3. Shared auth and session architecture

Telegram Mini App auth via signed `initData` and browser fallback auth via one-time bot-code handoff both create the same session format. Protected APIs accept `X-Session-Key` and `Authorization: Bearer ...` and populate a shared authenticated request context.

### AC4. Bot discovery and launch flow

The bot supports mention-based discovery plus command and deep-link entry points, and produces Mini App launch links and browser fallback links consistent with Telegram constraints from the plan.

### AC5. Player bootstrap and persistence

Player, session, settings, active mushroom selection, and progression persistence exist in PostgreSQL and are returned through bootstrap/profile APIs.

### AC6. Launch roster and character selection

All five launch mushrooms from the plan are implemented with the specified stats, passives, actives, and metadata. The frontend allows selecting and persisting the active mushroom.

### AC7. Artifact library and grid-builder rules

The frontend provides a mobile-first Vue artifact builder using a `4x4` CSS grid with tap-to-place interaction. The backend and frontend enforce exactly 3 artifacts, no duplicates, no rotation, no overlap, and in-bounds placement. Saved loadouts use canonical placement rows, not raw cell storage.

### AC8. Deterministic battle engine and ghost matchmaking

The backend implements deterministic `1v1` battle simulation using server-authored snapshots, battle seeds, stored event logs, reward rules, and the plan’s combat math. V1 ghost matchmaking selects random eligible opponent snapshots and resolves one-sided outcomes.

### AC9. Replay, results, and progression

The frontend replays stored server-authored event logs, shows synchronized results, and displays `spore`, per-character `mycelium`, and levels as display-only progression. Loss rewards, draw rewards, and level-display behavior match the plan.

### AC10. Leaderboard and scoring distinctions

Leaderboard rating and ordering follow the plan’s v1 scoring rules. Accepted live friend battles score both players; ghost, offline, and snapshot battles remain one-sided for rewards, stats, and rating.

### AC11. Friends and challenge flow

Unique 6-digit friend codes are implemented, friend add-by-code works idempotently, challenges can be created and opened from links, and invited players must explicitly accept before a two-sided scored battle is created.

### AC12. Structured wiki pipeline and wiki UI

Repo-authored wiki content is organized into structured wiki folders built from existing markdown sources, exposed through backend wiki services, and rendered in the app with Russian-first UI and English toggle support. Wiki editing is not exposed in-app, and canon content remains repo-authored.

### AC13. Local AI Test Lab and env gating

The Local AI Test Lab exists in local and development environments only, supports prompt/model comparison flows for battle narration experiments, and is excluded from production behavior.

### AC14. Verification coverage

Focused automated tests and screenshot-oriented UI verification cover the core v1 flows and all required critical rules closely enough to prove the implemented scope. Fresh verification is run without editing production code.

### AC15. Artifact shape visual parity

The artifact builder renders artifact pieces as recognizable Backpack Battles-style shapes rather than cell text, and the same visual figure is reused in both the library and the placed loadout container or preview surfaces.

## Verification Plan

- Backend unit and integration tests for auth, session middleware, player persistence, loadout validation, battle simulation, rewards, rate limits, leaderboard logic, friend challenges, and wiki reads.
- Frontend tests for auth/bootstrap, onboarding, mushroom selection, artifact builder rules, replay rendering, results, language toggle, friends, leaderboard, wiki, and Local AI Test Lab gating.
- E2E coverage for artifact shape rendering in both the library and the placed board container.
- Screenshot-oriented Playwright coverage for the key v1 screens the plan requires.
- Raw proof artifacts stored under `.agent/tasks/telegram-autobattler-v1/raw/`.
- Criterion-level evidence tracked in `evidence.md`, `evidence.json`, and if needed `problems.md`.
