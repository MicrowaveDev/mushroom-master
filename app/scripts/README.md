# Supported Scripts

Run commands from the repository root. This is the supported command surface;
files under `app/scripts/lib/` are implementation modules, not standalone tools.
The machine-readable classification is in
[`command-manifest.json`](./command-manifest.json), and
`npm run scripts:docs:check` keeps it aligned with `package.json`.

Mutation labels used below are **none**, **temporary output**, **candidate files**,
**production files**, **database**, and **runtime**. Commands with database or
production-file effects should be run only after reading their `--help` output or
the linked workflow documentation.

## Quick Decision Guide

| Situation | Start with | Expected output | Follow with |
| --- | --- | --- | --- |
| Find the next image work | `next` or the Home Field `generation-queue` | Prompt/queue text; no files | The exact printed producer command |
| Turn approved raw sources into bitmaps | `produce` | Candidate or app-facing PNGs | Domain `validate` and review sheets |
| Check mechanical or release readiness | `validate` or `release-check` | PASS/FAIL report | Fix failures before provenance or promotion |
| Review a group visually | `sheet` or `preview` | Ignored review images/manifests | Record a human verdict |
| Bind approved files to metadata | `provenance:generate` | Committed metadata | `provenance:check` |

For Home Field chibis, always start with `generation-queue`; copied historical
command sequences are not authoritative. `next -- --preset=chibi-proof` is a
queue-owned prompt renderer, not an independent launcher.

## Prerequisites And Stops

- Use the repository Node version and install dependencies with `npm install`.
- Image producers expect raw PNGs at the paths printed by their `next` command.
- Playwright commands require installed browser dependencies. Debug mode changes
  logs only; it does not approve screenshot changes.
- Wallet, support, season-admin, and deployment commands may require database,
  provider, Telegram, or host environment variables. Read `--help`; never infer a
  secret file or place credentials in command history.
- A dry run or read-only audit is not permission to run its write mode. Database
  and infrastructure commands stop on missing confirmation, invalid environment,
  failed preflight, or failed health checks.
- Image commands stop on missing source, invalid dimensions, provenance mismatch,
  rejected review, or queue source gate. Mechanical PASS is not visual approval.

<!-- command-family:game-runtime -->
## Develop And Build The Game

| Task | Command | Mutation |
| --- | --- | --- |
| Start backend and frontend development servers | `npm run game:start` | runtime |
| Start only the backend | `npm run game:start:backend` | runtime |
| Build the web application | `npm run game:build` | temporary output |
| Check the core submodule and fusion catalog | `npm run game:core:check`; `npm run game:fusions:check` | none |
| Generate the social preview | `npm run game:social-preview` | production files |

<!-- command-family:artifact-images -->
## Produce Artifact Images

Artifact image production starts with a prompt queue and produces supplied image
sources. There is no procedural placeholder-to-production generator.

```bash
npm run game:artifacts:next
npm run game:artifacts:produce -- <artifact-id> [<artifact-id> ...]
npm run game:artifacts:release-check
```

Use `game:artifacts:sheet` and `game:artifacts:thumbnail-review` for review,
`game:artifacts:validate` for coverage, and the `provenance:generate` then
`provenance:check` pair after approved source changes. `normalize-detail` mutates
selected production bitmaps and immediately invalidates provenance, so regenerate
metadata and validate before release. See the
[`artifact image plan`](../../docs/artifact-image-system-improvement-plan.md).

<!-- command-family:season -->
## Operate Seasons

Use `npm run game:season:next` to select image work, then the `sheet`,
`provenance:generate`, `provenance:check`, and `validate` commands for review and
release gates. `recalculate`, `archive`, and related commands can mutate season or
database state; `inspect` and `analytics` are read-only diagnostics. Read
[`season-ranking.md`](../../docs/season-ranking.md) before administrative changes.

<!-- command-family:home-field -->
## Produce Home Field Images

### Chibi Proofs

The production queue is the sole launcher and workflow authority:

```bash
npm run game:home-field:generation-queue
```

Run only the commands and prompt renderer printed by that queue. The lower-level
preflight, source claim/stage, split, recovery, file verification, palette audit,
candidate evidence, and verdict commands are safety stages used by queue output;
do not compose a separate chibi workflow from them. See
[`RUN_CHIBI_PROOF_PROMPT.md`](../shared/home-field/RUN_CHIBI_PROOF_PROMPT.md).

### Terrain, Objects, And Families

```bash
npm run game:home-field:next -- --preset=terrain-production
npm run game:home-field:produce -- --scope=terrain --candidate
npm run game:home-field:produce -- --scope=objects --candidate
npm run game:home-field:produce-family -- --family=grass --candidate
npm run game:home-field:produce-family -- --family=path --candidate
npm run game:home-field:preview -- --scope=combined
```

`placeholder-tiles` writes visibly marked, non-production files only under
`.agent/home-field-workspace/raw`. Review helpers (`sheet`, `alpha-sheet`,
`mobile-readability-sheet`, `grass-family-sheet`, `adjacency`, and
`candidate-evidence`) write temporary evidence. Validate readiness with:

```bash
npm run game:home-field:validate -- --profile=minimal-production
npm run game:home-field:validate -- --profile=full-registry-production
npm run game:home-field:validate -- --status
```

The temporary `game:home-field:status` alias maps to the last command and is due
for removal after 2026-07-27. See the
[`Home Field workflow`](../../docs/home-field-agent-flow.md).

## Compatibility Aliases

| Alias | Replacement | Remove after |
| --- | --- | --- |
| `game:home-field:status` | `game:home-field:validate -- --status` | 2026-07-27 |

<!-- command-family:wallet-support -->
## Wallet And Support Operations

`game:wallet:audit` and `game:wallet:ops-check` are verification entry points.
`reconcile`, `expire-intents`, `import-settlement`, and `support:money-action`
can mutate financial records; use their dry-run or confirmation controls first.
`support:money-lookup` is the read-only support path. The command `--help` output
is the source of truth for provider inputs and confirmation flags.

<!-- command-family:simulation -->
## Run Diagnostics

`npm run game:gacha:simulate` is a read-only probability simulation.

<!-- command-family:tests -->
## Test

```bash
npm run game:test
npm run game:test:e2e
npm run game:test:screens
npm run game:test:screens:debug
```

All Playwright aliases use `run-game-playwright.js`; suite selection and debug
behavior are arguments to that single runner. `npm test` remains the package-wide
Node test entry point.

<!-- command-family:lore-maintenance -->
## Maintain Lore Imports

The unprefixed `fetch`, `regenerate`, message/hashtag, repost, duplicate-cleaning,
analysis, and audit commands belong to the older Telegram lore ingestion surface.
They are operational and can mutate imported data. Inspect the corresponding
`src/*.js` entry point before use; they are not game image pipeline commands.

<!-- command-family:repository-tools -->
## Repository Tools

`npm run shrink:screenshots -- <paths...>` creates reduced review copies.
`npm run scripts:docs:check` validates this README, the manifest, links, aliases,
and the Home Field command-count budget.

## Deployment Scripts

Deployment scripts are intentionally direct shell entry points because setup,
routine updates, restarts, and nginx installation have different risk boundaries:

```bash
app/scripts/setup-docker-production.sh --help
app/scripts/update-production-server.sh --help
app/scripts/restart-production-server.sh --help
app/scripts/setup-nginx-production.sh --help
```

They share argument, path, Compose, and environment parsing through
`app/scripts/lib/production-server.sh`. Read
[`telegram-production-readiness.md`](../../docs/telegram-production-readiness.md)
before changing a production host.

## Do Not Invoke Directly

Do not run files under `app/scripts/lib/` or shared domain adapters directly.
They do not own complete argument validation, mutation policy, or follow-up
checks. Likewise, compatibility wrappers and generated queue helpers are not new
workflow authorities. Use the npm aliases in this README, except for the four
explicit deployment shell entry points above.
