# Script Directory Organization

## Source Of Truth

Organize the supported scripts into clear responsibility groups such as checks,
generation, and other useful categories so `app/scripts` is easier to navigate.

## Acceptance Criteria

- **AC1:** `app/scripts/` contains only `README.md`, `command-manifest.json`, and
  documented responsibility directories.
- **AC2:** Executable scripts are grouped under `checks/`, `generation/`,
  `workflows/`, `operations/`, or `runners/`; reusable modules remain under
  `lib/`.
- **AC3:** Existing npm command names and behavior remain compatible.
- **AC4:** Imports, queue output, tests, docs, and deployment examples use the
  relocated paths.
- **AC5:** The command manifest and scripts README document the directory model.
- **AC6:** Automated checks reject root-level executable scripts, unknown
  directories, missing package entry points, and npm aliases that invoke `lib/`.
- **AC7:** Focused pipeline tests, the full game test suite, syntax checks, build,
  and Playwright E2E pass from the reorganized repository.

## Constraints

- Do not rename public npm aliases.
- Do not merge distinct queue, image-generation, database, deployment, or test
  safety boundaries.
- Preserve historical evidence and deprecated-path records as point-in-time
  artifacts.
- Leave unrelated hub and submodule worktree changes untouched.

## Non-Goals

- Change game behavior, artwork, production data, or deployment topology.
- Split every product domain into another nested directory layer.

## Verification

Run the structural documentation checker, focused script/Home Field tests, all
game unit tests, production build, domain gates, and the unified E2E wrapper.
