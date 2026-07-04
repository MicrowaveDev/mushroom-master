# Backpack Game Core Update Log

This log records which `backpack-game-core` commits were consumed by
`mushroom-master`. It exists so future core changes have a clear release trail
before there is a registry package version or a second backpack-game consumer.

## Current Policy

- Core source changes are committed and pushed in
  `vendor/backpack-game-core` first.
- `mushroom-master` then commits the nested submodule pointer and any adapter,
  lockfile, or documentation changes.
- The hub pointer is updated last.
- Use the core SHA as the package release identity until registry publishing or
  semver tags exist.

## Current Consumer Baseline

`mushroom-master` currently consumes:

- core SHA: `b3da37951b55aa0a9d106e554abbe7c59f242305`
- core short SHA: `b3da379`
- core commit: `Add gacha simulation helpers`
- runtime/API baseline: `d5fb481` (`Add package type declarations`)
- game pointer commit: this commit (`Use core gacha simulation helpers`)
- package path: `vendor/backpack-game-core`
- dependency path: `file:vendor/backpack-game-core`

## Nested Submodule Pointer History

| Date | Game commit | Core SHA | Core change | Notes |
| --- | --- | --- | --- | --- |
| 2026-07-04 | this commit | `b3da379` | Gacha simulation helpers | Added `modules/gacha/simulation` for deterministic pack odds simulation over injected packs, catalogs, ownership snapshots, copy counts, pity state, seed, and RNG. Mushroom admin preview and CLI/runtime odds simulation delegate through thin adapters while static/runtime pack lookup and catalog visibility stay local. |
| 2026-07-04 | `be6ff3e` | `8345448` | Gacha admin validation helpers | Added `modules/gacha/admin-validation` for release checklist, fixture normalization, plan-item asset-id invariants, season-plan catalog projection, promotion metadata, and plan coverage summaries. Mushroom gacha admin service now delegates through DB-aware wrappers while keeping transactions, audit logs, uploads, permissions, and route payloads local. |
| 2026-07-04 | `5c78a00` | `3e3d5d6` | Layered module/client exports | Added public module facades for gacha, shop, loadout, battle, and fusion, plus route-adapter client and shared loadout view-model helpers. Mushroom now imports gacha through `modules/gacha` and uses the shared projection helper through a compatibility wrapper. |
| 2026-07-04 | `7b35440` | `f47ff96` | Reusable asset/gacha policy helpers | Mushroom gacha acquisition, pack validation, roll selection, pity/guarantee, duplicate burn, and pack shaping now delegate through the core adapter. |
| 2026-07-02 | `5e5e7cf` | `300583b` | Core changelog and package release notes | Documentation/package baseline only; runtime/API baseline remains `d5fb481`. |
| 2026-07-02 | `5fa7d7b` | `d5fb481` | Type declarations and export metadata | Current baseline for typed consumers. |
| 2026-07-02 | `634d242` | `13e6e0c` | Reusable RNG helpers | Mushroom kept string-seed hashing local and imported numeric RNG/shuffle helpers from core. |
| 2026-07-02 | `2f4c2da` | `d884410` | Provider-driven loadout validation | Mushroom adapter passes catalog, pricing, family, grid, and stat policy. |
| 2026-07-02 | `ad2cb08` | `b9879bd` | Nested submodule adoption | Switched from pinned Git dependency to `file:vendor/backpack-game-core`. |

## Pre-Submodule Package Pin History

These commits consumed the core through
`github:MicrowaveDev/backpack-game-core#<sha>` before the nested submodule was
added.

| Date | Game commit | Core SHA | Core change |
| --- | --- | --- | --- |
| 2026-07-02 | `447963b` | `b9879bd` | Hookable battle simulation |
| 2026-07-01 | `95719d2` | `4056d7a` | Backpack loadout generator |
| 2026-07-01 | `cede5ef` | `6be48a9` | Shop offer helper |
| 2026-07-01 | `a71d212` | `fdbad4b` | Fusion matching helper |
| 2026-07-01 | `1e2b3ff` | `92a39d5` | Grid geometry helpers |
| 2026-07-01 | `437040d` | `69666c8` | Bag shape helpers |

## Next Update Checklist

1. Commit and push the core repo.
2. Run `npm test` and `npm pack --dry-run` in `vendor/backpack-game-core`.
3. Update the nested submodule pointer in `mushroom-master`.
4. Run `npm run game:core:check` and the focused consumer tests affected by the
   changed module.
5. Add a row to this file with the new core SHA and consumer commit.
6. Update `docs/backpack-game-core-extraction-inventory.md` if the latest core
   commit or exported surface changed.
