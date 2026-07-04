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

- core SHA: `20926631a52a7a7f933e40ccc4e4b54a3ee56bdf`
- core short SHA: `2092663`
- core commit: `Add game run response patch helpers`
- runtime/API baseline: `d5fb481` (`Add package type declarations`)
- game pointer commit: this commit (`Use core game run response patch helpers`)
- package path: `vendor/backpack-game-core`
- dependency path: `file:vendor/backpack-game-core`

## Nested Submodule Pointer History

| Date | Game commit | Core SHA | Core change | Notes |
| --- | --- | --- | --- | --- |
| 2026-07-04 | this commit | `2092663` | Game-run response patch helpers | Mushroom game-run composable delegates start, ready, round-transition, and completion response state projection through `client-view-model`. Routes, loadout projection, bootstrap updates, replay loading, navigation, haptics, and product copy stay local. |
| 2026-07-04 | `fb7e89b` | `f4734ea` | Run-shop response patch helpers | Mushroom game-run composable delegates refresh-shop, buy, and sell response state projection through `client-view-model`. API calls, price guards, placement payload construction, row-id sell payloads, haptics, replay loading, route names, and product copy stay local. |
| 2026-07-04 | `46d7a22` | `5ee7ee8` | Headless wallet/gacha state helpers | Mushroom customization delegates wallet bundle loading states, wallet checkout next-action decisions, and roll/burn refresh decisions through `client-view-model`. API calls, Telegram/web checkout side effects, bootstrap refresh callbacks, route names, and product copy stay local. |
| 2026-07-04 | `9c848fe` | `458d4bb` | Profile asset result DTO shapers | Mushroom direct-buy/equip responses and roll/burn grant instance summaries now delegate through `modules/assets`, including idempotent replay summaries where instance rows are still active. Runtime catalogs, SQL mutations, wallet spends, RNG, mutation claims, and route ownership stay local. |
| 2026-07-04 | `880322b` | `b56ad91` | Consumer route-client adoption | Mushroom replay and dev-tool routes now use the local route map plus shared core route-adapter client, and the legacy `apiJson` helper was removed from live code. Replay state, timers, dev fixtures, and product copy stay local. |
| 2026-07-04 | `715d7b2` | `b56ad91` | Consumer route-client adoption | Mushroom game-run start/load/readiness/shop/buy/sell/abandon/loadout routes now use the local route map plus shared core route-adapter client while keeping run state projection, placement payload shaping, replay loading, haptics, and product copy local. |
| 2026-07-04 | `0bbfcd9` | `b56ad91` | Consumer route-client adoption | Mushroom auth/bootstrap/settings routes now use the local route map plus shared core route-adapter client while keeping auth-code verification, bootstrap state projection, cache ownership, navigation effects, and product copy local. |
| 2026-07-04 | `eaa1b01` | `b56ad91` | Consumer route-client adoption | Mushroom social and wiki-detail flows now use the same local route map plus shared core route-adapter client while keeping route ownership, session header policy, navigation effects, replay autoplay, and product copy local. |
| 2026-07-04 | `90b3ef9` | `b56ad91` | Client response envelope unwrapping | Added optional `{ success, data, error }` envelope unwrapping to the shared route-adapter client. Mushroom customization wallet/gacha flows now use a local route map with the core client while keeping route ownership, session header policy, idempotency-key generation, Telegram/web checkout opening, bootstrap refresh, and product copy local. |
| 2026-07-04 | `24fe884` | `fc53abc` | Wallet and roll mutation view-state helpers | Added headless wallet purchase and asset roll/burn mutation state reducers through `client-view-model`. Mushroom customization delegates opening/success/failure view-state transitions while keeping API routes, idempotency-key generation, Telegram/web checkout opening, bootstrap refresh, and product copy local. |
| 2026-07-04 | `b7c7729` | `0f8beee` | Profile asset target variant shaper | Added profile asset target-variant list projection through `modules/assets`. Mushroom progression portraits delegate list shaping while keeping portrait asset id convention, runtime catalog, gacha-plan policy, active/equipment resolution, and product routes local. |
| 2026-07-04 | `1732ddc` | `9b7b505` | Asset gacha result DTO shapers | Added persisted asset roll and duplicate-burn row normalizers plus roll/burn result DTO shapers through `modules/gacha`. Mushroom delegates roll and burn response shaping while keeping SQL queries, wallet spends, asset grants, RNG, idempotency, and route payload ownership local. |
| 2026-07-04 | `426abc1` | `f387670` | Wallet and roll status view-model helpers | Added wallet purchase-intent, Telegram invoice, and asset-roll error status normalization helpers. Mushroom customization checkout and pack roll/burn flows delegate status mapping through core while keeping product routes, Telegram/web checkout opening, localization, and final UI composition local. |
| 2026-07-04 | `458140b` | `786d41c` | Canonical artifact preview orientation helper | Added `artifactPreviewOrientation` for preview-only surfaces that must preserve non-bag canonical bitmap dimensions while still deriving shaped/legacy bag preview dimensions. Mushroom delegates shop, backpack, social, catalog, and fusion preview orientation through this helper while keeping placement-preferred orientation local to placement flows. |
| 2026-07-04 | `fab895c` | `725ffab` | Artifact grid view-model helpers | Added `client-view-model` helpers for occupied-cell value maps and preferred artifact preview orientation. Mushroom delegates `buildOccupancy` and `preferredOrientation` while keeping placement state, visual previews, drag/drop actions, and product rendering local. |
| 2026-07-04 | `a672a73` | `41a3ad5` | Artifact stat view-model helpers | Added `client-view-model` helpers for stat total summing, signed delta formatting, bonus-entry DTO shaping, and loadout stat text composition. Mushroom delegates `deriveTotals`, artifact bonus labels, loadout stat text, and stat chips while keeping product stat labels, visual role classes, and UI composition local. |
| 2026-07-04 | `42bf0be` | `f403553` | Grid cell classification view-model helpers | Added `client-view-model` helpers for slot-first bag row lookup, grid cell classification, and occupied footprint key generation. Mushroom's artifact grid board imports the shared helpers while keeping visual classes, overlays, events, and board layout local. |
| 2026-07-04 | `f3786ad` | `cf7c680` | Wallet and roll feedback view-model helpers | Added `client-view-model` helpers for wallet purchase surface balance/bundle/status/support shaping and asset roll-result/problem feedback assembly. Mushroom uses them in the home wallet and pack feedback UI while keeping Telegram/web surface detection, localization, route actions, and UI composition local. |
| 2026-07-04 | `779aaab` | `578279d` | Asset pack client view-model helpers | Added `client-view-model` helpers for asset pack rarity odds, guarantee/pity/duplicate copy text, active/availability labels, and roll-pack summaries over product-provided labels. Mushroom uses the helper in the home skin picker while keeping localization, selected-character state, runtime bootstrap data, routes, and UI composition local. |
| 2026-07-04 | `84d8fae` | `77b1d7b` | Asset catalog acquisition policy helper | Added `resolveAssetCatalogAcquisitionPolicy` through `asset-gacha` / `modules/gacha` so paid/free default acquisition modes, per-asset overrides, explicit `packId: null`, and default pack assignment are shared. Mushroom keeps env parsing, `PORTRAIT_PACK_ID`, product catalog assembly, runtime pack lookup, and direct-buy/roll execution local. |
| 2026-07-04 | `6f997ff` | `6ae688b` | Profile asset state helpers | Added `profile-asset-state`, `modules/assets`, and `modules/assets/profile-state` for profile asset ownership/equipment row shaping, equip validation, direct-purchase spend parameters, instance drafts, and portrait variant projection. Mushroom asset service delegates these pure helpers while keeping runtime catalogs, SQL lifecycle, gacha roll/burn lifecycle, support actions, paid rollback behavior, and the `player_mushrooms.active_portrait` mirror local. |
| 2026-07-04 | `03b7bfb` | `af520f0` | Wallet accounting helpers | Added `wallet-accounting`, `modules/wallet`, and `modules/wallet/accounting` for profile-wallet delta validation, balance math, purchase grant/reversal mutation shaping, purchase status classification, and settlement invariants. Mushroom wallet and provider-settlement services delegate to those pure helpers while keeping SQL, locks, provider callbacks, support actions, mirrors, and reconciliation queries local. |
| 2026-07-04 | `ed7068e` | `b3da379` | Gacha simulation helpers | Added `modules/gacha/simulation` for deterministic pack odds simulation over injected packs, catalogs, ownership snapshots, copy counts, pity state, seed, and RNG. Mushroom admin preview and CLI/runtime odds simulation delegate through thin adapters while static/runtime pack lookup and catalog visibility stay local. |
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
