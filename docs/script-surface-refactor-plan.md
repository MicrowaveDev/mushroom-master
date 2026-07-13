# Script Surface Refactor Plan

## Source Of Truth

Refactor `app/scripts`, remove deprecated tooling, merge redundant implementations,
and simplify the command surface without losing valid operational workflows.

### Constraints

- Preserve current production, validation, deployment, wallet, support, season,
  artifact, and Home Field capabilities.
- Keep queue-generated commands deterministic and tested.
- Do not combine every workflow into one large script.
- Treat the Home Field generation queue as the single source of truth.
- Preserve temporary compatibility aliases while documentation and generated queue
  output migrate.
- Never let placeholder generators overwrite production assets.
- Keep deployment setup operations distinct from routine update and restart
  operations.

### Success Conditions

- Obsolete and dangerous scripts are removed.
- Home Field status cannot confuse file existence with production readiness.
- Shared behavior has one implementation.
- `package.json` exposes a smaller, coherent command vocabulary.
- Existing queue, validation, review, and operational workflows remain covered by
  tests.

### Open Ambiguity

The exact compatibility window for deprecated aliases can be selected during
implementation. One release or two weeks is the recommended default.

## Phase 1: Lock Current Behavior

Before restructuring, capture the supported command surface and classify every
script.

Create `.agent/tasks/script-surface-refactor/` containing:

- `spec.md` with the acceptance criteria from this plan.
- `inventory.json` listing every script, npm alias, documentation reference,
  import, and classification.
- `evidence.md` and `evidence.json`.
- `problems.md` only if verification cannot pass.

Classify scripts as:

- public workflow command
- internal reusable module
- operational or admin command
- deployment command
- diagnostic command
- placeholder or proof-only command
- historical or deprecated command

Add smoke tests for commands whose behavior will move but is not currently
asserted, especially status output and Playwright runner argument construction.

## Phase 2: Remove Unsafe And Historical Commands

### Remove The Artifact Placeholder Generator

Delete:

- `app/scripts/generate-artifact-bitmaps.js`
- `game:artifacts:generate`

Verify whether `web/src/artifacts/render.js` remains unreferenced. Delete it if
the audit confirms it has no runtime consumer.

Update documentation to state that artifact production begins with:

```bash
npm run game:artifacts:next
npm run game:artifacts:produce -- <ids>
```

Add a regression test proving that no supported artifact command procedurally
generates SVG-derived production PNGs.

### Remove The Completed Minimal-Candidate Repair

Delete:

- `app/scripts/polish-home-field-minimal-candidate.js`
- `game:home-field:polish-minimal-candidate`

Convert references in `docs/home-field-minimal-production-plan.md` into
historical completion notes rather than runnable current instructions. Do not
preserve this as a legacy executable; Git history already preserves the old
transformation.

## Phase 3: Correct Home Field Status Semantics

Move status calculation into a shared module such as:

```text
app/shared/home-field/home-field-status.js
```

Define explicit states:

- `missing`
- `exists`
- `mechanically_valid`
- `needs_regen`
- `needs_review`
- `approved`
- `production_ready`

Production readiness must require all relevant conditions:

- expected file exists
- schema and mechanical checks pass
- review record is accepted
- manifest status is approved
- source and provenance gates are satisfied
- no blocking queue or source-gate state applies

Expose status through the validator:

```bash
npm run game:home-field:validate -- --status
npm run game:home-field:validate -- --status --json
```

Keep `game:home-field:status` as a temporary compatibility alias, then remove
`app/scripts/home-field-status.js` after migration. Never print "All assets
produced" based only on file existence.

## Phase 4: Make The Queue The Chibi Authority

Move all useful output from `home-field-chibi-proof-context.js` into
`print-home-field-generation-queue.js` or shared queue-formatting modules.

The queue output must own:

- active generation method
- source path and hash
- source-gate state
- exhausted sources
- required commands
- output locations
- verification stages
- review requirements
- production-readiness result
- copyable next-run prompt

Then:

- Remove `game:home-field:chibi-proof-context`.
- Delete `app/scripts/home-field-chibi-proof-context.js`.
- Make `next-chibi-proof` a queue view or preset rather than an independent
  contract.
- Update `RUN_CHIBI_PROOF_PROMPT.md` to require only the queue command as its
  launcher.
- Remove duplicated command prose from docs where the queue can print it.

Keep the individual preflight, archive, stage, split, verify, palette, recovery,
evidence, and verdict modules. They enforce separate safety boundaries and
should not become one large mutable script.

## Phase 5: Consolidate Home Field Families

Create shared family definitions:

```text
app/shared/home-field/home-field-family-config.js
app/scripts/lib/home-field-family-production.js
```

Each family configuration should describe:

- IDs
- source dimensions
- crop definitions
- output directories
- style anchors
- prompt additions
- validation profile
- candidate root

Replace:

- `next-home-field-grass-family-prompt.js`
- `next-home-field-path-family-prompt.js`

with:

```bash
npm run game:home-field:next -- --family=grass
npm run game:home-field:next -- --family=path
```

Replace:

- `produce-home-field-grass-family.js`
- `produce-home-field-path-family.js`

with:

```bash
npm run game:home-field:produce-family -- --family=grass
npm run game:home-field:produce-family -- --family=path
```

Keep family-specific visual rules in configuration or focused modules, not in
conditional blocks scattered through one large CLI.

## Phase 6: Consolidate Playwright Runners

Replace `run-game-e2e.js` and `run-game-screenshot-check.js` with:

```text
app/scripts/run-game-playwright.js
```

Supported modes:

```bash
npm run game:test:e2e
npm run game:test:screens
npm run game:test:screens:debug
```

All aliases should call the same runner with `--suite=e2e`, `--suite=screens`,
and optional `--debug` arguments.

The shared implementation should own:

- free backend and frontend port selection
- environment construction
- signal propagation
- reporter selection
- Playwright configuration
- replay timing defaults

Add unit tests for argument and environment construction without launching
Playwright.

## Phase 7: Share Artifact And Season Pipeline Infrastructure

Do not collapse artifact and season workflows into one monolithic CLI. Extract
their common lifecycle instead.

Add shared modules for:

- provenance checking
- metadata bundle generation
- contact-sheet manifest handling
- standard prompt-selection arguments
- common file-freshness checks

Use domain adapters such as:

```text
artifactImageDomain
seasonImageDomain
```

Each adapter supplies entries, sections, paths, prompt builders, dimensions, and
domain-specific validation.

Keep the user-facing commands:

```text
game:artifacts:next
game:artifacts:validate
game:artifacts:sheet
game:artifacts:provenance:generate
game:artifacts:provenance:check

game:season:next
game:season:validate
game:season:sheet
game:season:provenance:generate
game:season:provenance:check
```

Internally, these commands should call shared implementations. Artifact
validation remains specialized because its footprint and irregular-mask logic
is substantially richer.

## Phase 8: Integrate Artifact Detail Normalization

Move the reusable normalization functions from `normalize-artifact-detail.js`
into an internal artifact-image processing module.

Support normalization directly during production:

```bash
npm run game:artifacts:produce -- <ids> --normalize-detail
```

Retain the standalone alias temporarily for targeted repair:

```bash
npm run game:artifacts:normalize-detail -- <ids>
```

Both paths must use the same implementation. Normalization must invalidate or
regenerate provenance and require validation afterward. Do not normalize
approved production files silently or by default.

## Phase 9: Simplify Package Commands

Replace preset aliases with explicit parameters.

Prompt presets:

```bash
npm run game:home-field:next -- --preset=terrain-grass
npm run game:home-field:next -- --preset=terrain-edge
npm run game:home-field:next -- --preset=scene-props
npm run game:home-field:next -- --preset=chibi-proof
```

Candidate production:

```bash
npm run game:home-field:produce -- --scope=terrain --candidate
npm run game:home-field:produce -- --scope=objects --candidate
npm run game:home-field:produce -- --scope=chibi --candidate
```

Candidate previews:

```bash
npm run game:home-field:preview -- --scope=grass
npm run game:home-field:preview -- --scope=terrain
npm run game:home-field:preview -- --scope=objects
npm run game:home-field:preview -- --scope=chibi
npm run game:home-field:preview -- --scope=combined
```

Validation profiles:

```bash
npm run game:home-field:validate -- --profile=minimal-production
npm run game:home-field:validate -- --profile=full-registry-production
```

Keep compatibility aliases only when generated queue output or external
operations still consume them. Mark those aliases with a removal date in a
command manifest rather than comments scattered through `package.json`.

Target: reduce the 48 Home Field aliases to approximately 20-25.

## Phase 10: Keep Operational Boundaries

Keep wallet and support commands separate at the npm level because they are
suitable for cron, runbooks, and audited operator use.

Their argument parsing and database startup can share internal helpers, but
retain commands such as:

```text
game:wallet:audit
game:wallet:reconcile
game:wallet:expire-intents
game:wallet:import-settlement
game:wallet:ops-check
game:support:money-lookup
game:support:money-action
```

Likewise, keep Docker setup, nginx setup, update, and restart as distinct
operations. Extract duplicated shell helpers into
`app/scripts/lib/production-server.sh`, but do not make setup reachable
accidentally through a routine restart command.

## Phase 11: Rename Proof-Only Commands

Keep `generate-home-field-proof-tiles.js`, but make its placeholder nature
unmistakable:

```text
generate-home-field-placeholder-tiles.js
game:home-field:placeholder-tiles
```

The command must:

- write only to the ignored workspace
- refuse app-facing production output
- mark generated assets as placeholder or proof
- never produce an approved review record

Keep the old `proof-tiles` alias during migration if current docs or tests still
rely on it.

## Phase 12: Documentation And Migration

Update:

- `AGENTS.md`
- Home Field README and agent-flow documents
- artifact bitmap workflow docs
- season image workflow docs
- production deployment runbook
- generated queue command strings
- package-command assertions in tests

Add a concise script catalog documenting only public commands. Internal modules
should not be presented as runnable scripts.

For every retired command, either remove all current documentation references
or label the reference explicitly as historical.

## Acceptance Criteria

- **AC1:** No supported command can generate SVG or procedural artifact
  placeholders into production paths.
- **AC2:** Home Field status never equates file existence with production
  readiness.
- **AC3:** The generation queue is the only source of chibi run instructions.
- **AC4:** Grass and path family generation share implementations with
  family-specific configuration.
- **AC5:** E2E and screenshot suites share one Playwright runner.
- **AC6:** Artifact and season pipelines share generic provenance and metadata
  infrastructure.
- **AC7:** Artifact detail normalization has one implementation and always
  triggers validation and provenance handling.
- **AC8:** Historical minimal-candidate polish tooling is removed.
- **AC9:** Proof-tile generation is visibly placeholder-only and cannot promote
  production assets.
- **AC10:** Wallet, support, and deployment operations retain their safety
  boundaries.
- **AC11:** Existing public aliases either continue working or emit a clear
  migration message during the compatibility window.
- **AC12:** Home Field npm aliases are reduced substantially without removing
  capabilities.
- **AC13:** Unit tests, Home Field pipeline tests, artifact and season checks,
  and Playwright runner tests pass.
- **AC14:** Documentation contains no stale current-workflow references to
  removed commands.

## Verification

Run relevant checks after each phase rather than waiting until the end:

```bash
node --test tests/game/home-field-pipeline.test.js
npm run game:artifacts:provenance:check
npm run game:artifacts:validate -- --all
npm run game:artifacts:sheet -- --validate-only
npm run game:season:provenance:check
npm run game:season:validate -- --all
npm run game:home-field:generation-queue -- --id=thalla-stage1-chibi-proof
npm run game:home-field:validate -- --status --json
npm run game:test
npm run game:test:e2e
```

The safest implementation order is Phases 1-4 first because they remove the
dangerous paths and establish one Home Field authority. Then consolidate
implementations, simplify aliases, and finish with documentation and full
verification.
