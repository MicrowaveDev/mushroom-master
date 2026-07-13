# Script Surface Refactor Evidence

## Verdict

PASS. Acceptance criteria AC1-AC16 are implemented and verified.

## Results

- Package scripts: 99 before, 76 after (includes the new documentation check).
- Home Field aliases: 48 before, 25 after.
- Node tests: 645 passed.
- Focused script/Home Field tests: 71 passed.
- Playwright E2E: 48 passed, 1 intentionally skipped.
- Artifact provenance/coverage: 131 approved images passed.
- Season provenance/coverage: 31 approved images passed.
- Home Field status: 12/46 production-ready; blocked, missing, placeholder,
  and rejected assets are not reported ready.
- Production build: passed.
- JavaScript syntax, shell syntax/help smoke tests, README/manifest check, and
  `git diff --check`: passed.

## Acceptance Mapping

| AC | Evidence |
| --- | --- |
| AC1 | Artifact placeholder generator and alias removed; regression test prevents return. |
| AC2 | Shared status state machine and fixture test reject existence-only readiness. |
| AC3 | Queue JSON/printer own the launcher and prompt renderer; context script removed. |
| AC4 | Grass/path use shared family config, CLI, and production helpers. |
| AC5 | E2E/screens aliases use `run-game-playwright.js`; argument/env tests pass. |
| AC6 | Artifact/season use shared provenance and metadata bundle modules. |
| AC7 | Standalone and producer normalization use one module and require validation/provenance refresh. |
| AC8 | Minimal candidate polish script/alias removed and documented as historical. |
| AC9 | Placeholder tiles write only ignored raw proof output with `productionEligible: false`. |
| AC10 | Wallet/support aliases remain separate; deployment scripts share helpers but retain entry points. |
| AC11 | Status compatibility alias has replacement and 2026-07-27 removal date. |
| AC12 | Home Field surface reduced from 48 aliases to 25. |
| AC13 | Unit, pipeline, domain, build, and final E2E gates pass. |
| AC14 | Current Home Field/artifact docs use canonical commands; historical references are labeled. |
| AC15 | `app/scripts/README.md` covers every supported family, mutation/risk, selection, and follow-up. |
| AC16 | `npm run scripts:docs:check` validates 76 commands, links, classification, and alias budget. |

## Raw Logs

- `raw/focused-verification.log`
- `raw/game-test.log`
- `raw/domain-gates.log`
- `raw/metadata-generation.log`
- `raw/game-build.log`
- `raw/game-e2e-final.log`
- `raw/e2e-fusion-rerun-fixed.log`
- `raw/syntax-shell.log`
- `raw/final-hygiene.log`

The first full E2E attempt exposed a pre-existing mobile recipes interaction bug:
the detail sheet defaulted open and intercepted catalog clicks. The component now
requires an explicit artifact selection; the targeted rerun and final full E2E
suite pass. The diagnostic failure output is retained in `raw/game-e2e.log` and
`raw/e2e-fusion-rerun.log` to preserve the discovery trail; neither file is final
PASS evidence.
