# Season Ranking Guide

**Scope:** Designer and operator reference for the Mushroom Master season rank system.
[`game-requirements.md`](game-requirements.md#season-level-recap) remains the authoritative behavioral spec; this document explains how to tune, inspect, and operate the system.

## Current Season

- id: `season_1`
- name: `Season of the Deep Ring` / `Сезон Глубокого Кольца`
- dates: `2026-04-01` to `2026-06-30`
- reset policy: chapter-style progress, not a destructive wipe

Season rank is cosmetic progression. It supports recap drama, achievements, analytics, and season-end rewards. It does not affect combat, matchmaking, ghosts, shop offers, round rewards, or Elo rating.

## Formula

Finished runs add season rank points with this formula:

```text
seasonPoints = min(wins, 7) * 2 - losses + fullClearBonus - abandonPenalty
```

Where:

- `wins`: completed-round wins in the run.
- only the first `7` wins count for rank points.
- `losses`: completed-round losses in the run.
- `fullClearBonus`: `+3` when `endReason == max_rounds`.
- `abandonPenalty`: `-2` before any completed round, `-5` after at least one completed round.

Run deltas may be negative. Persisted season totals clamp at `0`, so Bronze cannot fall below the floor.

## Ranks

| Rank | Minimum Points |
|---|---:|
| Bronze | 0 |
| Silver | 25 |
| Gold | 70 |
| Diamond | 140 |

The rank assets are documented in [`season-rank-image-reference.md`](season-rank-image-reference.md).

## Current Vs Peak

The system tracks both:

- `total_points` / `level_id`: current season score and rank.
- `peak_points` / `peak_level_id`: best reached score and rank.

Losses and abandons can demote current rank. Peak rank is preserved so players can keep playing after a high rank without risking their season-end reward tier.

## Season-End Rewards

Season archival rewards use `peak_level_id`, not current `level_id`.

| Peak Rank | Reward |
|---|---|
| Bronze | 50 spore |
| Silver | 150 spore, 5 mycelium |
| Gold | 350 spore, 15 mycelium |
| Diamond | 800 spore, 40 mycelium |

Archive preview:

```sh
npm run game:season:archive
```

Archive and grant rewards once:

```sh
npm run game:season:archive -- --write
```

The archive writes `player_season_archives` rows and uses the active mushroom for mycelium rewards.

## Player-Facing UI

The UI should expose:

- prep HUD: current run rank points and projected abandon outcome.
- abandon confirmation: clear warning that confirming applies a rank penalty.
- run complete: current rank, run delta, point breakdown, peak rank, and progress to next rank.
- home/profile: current rank, peak rank, progress, and the short rule hint that first 7 wins count and season rewards use peak rank.

## Analytics And Debugging

Inspect current player-season state:

```sh
npm run game:season:inspect
```

Summarize tuning signals:

```sh
npm run game:season:analytics
```

The analytics script reports:

- finished runs
- average points per run
- negative-run rate
- abandon rate
- client rank-ups and demotions
- peak rank distribution
- opponent-kind distribution
- repeated real-opponent pairs

Client rank events are posted to `/api/client-events` and persisted in `client_events`.

## Recalculation

When the formula or thresholds change, recalculate stored run and progress rows from historical run records.

Preview:

```sh
npm run game:season:recalculate
```

Write:

```sh
npm run game:season:recalculate -- --write
```

This updates `player_season_runs.points`, current totals, and peak fields.

## Tuning Checklist

Before changing thresholds or point values, check:

- average runs to Silver, Gold, and Diamond
- abandon frequency before and after the confirmation dialog
- demotion frequency near Silver/Gold/Diamond thresholds
- percent of runs with negative points
- whether Diamond is reachable through normal play before season end
- whether repeated real-opponent pairs or ghost/bot-heavy play distort progression

Prefer tuning thresholds first, then penalties, then the core formula. Keep the visible rule simple unless analytics shows clear abuse.
