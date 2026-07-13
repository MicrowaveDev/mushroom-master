# Script Surface Refactor Specification

## Original Request

Implement `docs/script-surface-refactor-plan.md` completely, including the
operator-facing script README that explains which commands to use, how to use
them, and in which situations.

## Acceptance Criteria

- **AC1:** No supported command can generate SVG or procedural artifact placeholders into production paths.
- **AC2:** Home Field status never equates file existence with production readiness.
- **AC3:** The generation queue is the only source of chibi run instructions.
- **AC4:** Grass and path family generation share implementations with family-specific configuration.
- **AC5:** E2E and screenshot suites share one Playwright runner.
- **AC6:** Artifact and season pipelines share generic provenance and metadata infrastructure.
- **AC7:** Artifact detail normalization has one implementation and always triggers validation and provenance handling.
- **AC8:** Historical minimal-candidate polish tooling is removed.
- **AC9:** Proof-tile generation is visibly placeholder-only and cannot promote production assets.
- **AC10:** Wallet, support, and deployment operations retain their safety boundaries.
- **AC11:** Existing public aliases either continue working or emit a clear migration message during the compatibility window.
- **AC12:** Home Field npm aliases are reduced substantially without removing capabilities.
- **AC13:** Unit tests, Home Field pipeline tests, artifact and season checks, and Playwright runner tests pass.
- **AC14:** Documentation contains no stale current-workflow references to removed commands.
- **AC15:** `app/scripts/README.md` provides a task-oriented command selector, usage examples, prerequisites, mutation levels, stop conditions, and links to deeper workflow documents for every supported public command family.
- **AC16:** An automated documentation check proves that README commands match `package.json`, compatibility aliases identify replacements and removal dates, and removed commands do not appear in current-use examples.

## Constraints

- Preserve production, validation, deployment, wallet, support, season, artifact, and Home Field capabilities.
- Keep queue-generated commands deterministic and tested.
- Prefer shared modules and thin CLIs over a new monolith.
- Treat the Home Field generation queue as the single chibi authority.
- Never let placeholder generators overwrite production assets.
- Keep deployment setup separate from routine update and restart operations.
- Preserve unrelated user changes and dirty submodules.

## Non-Goals

- Change game behavior, balance, art, database schemas, or deployment topology.
- Run image generation or alter approved production artwork.
- Merge distinct wallet, support, or deployment safety boundaries into one command.

## Verification Plan

Run focused script-surface tests during implementation, then the Home Field
pipeline suite, artifact and season gates, game unit suite, build, and full E2E
wrapper. Record command output under `raw/` and map final evidence to AC1-AC16.
