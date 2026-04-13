# Mycelium Sink — Design Plan

**Status:** Options 1, 3, 5, 6 implemented (2026-04-13). Option 2 deferred. Options 4 optional.
**Scope:** Turn `mycelium` (currently an earning-only number) into a
currency players actively spend. Propose 5 options ranked by fit, then
recommend a first-cycle pair.

---

## Why this doc exists

`mycelium` is a **per-mushroom** currency stored in
`player_mushrooms.mycelium` and awarded alongside `spore` after every
round ([Req 9-A]) and at run completion ([Req 9-B]). The earning side
works. **There is no spending sink today**, which means the number
accumulates without meaning. Players who ask "what does mycelium do?"
cannot be answered by the docs — a spec gap worth closing.

This doc exists to list concrete options, rank them against the
existing data model and balance constraints, and propose a first
iteration.

**Current state as of 2026-04-13:**
- Schema: `player_mushrooms(player_id, mushroom_id, mycelium, level, wins, losses, draws)` — per-mushroom row already exists.
- `level` column exists but is **computed on read** from `mycelium` via `computeLevel()` in [app/server/lib/utils.js](../app/server/lib/utils.js). No persistent level gates anything today.
- Wiki pages exist for each mushroom ([wiki/](../wiki/)) but are always fully visible.
- No existing UI renders mycelium beyond a per-mushroom number on the Home screen.

---

## Design constraints

Any sink must respect:

1. **Balance stability.** `[Req 7-D]` ghost scaling uses
   `playerSpent` (artifact purchases) as the budget seed. Adding a
   sink that affects ghost budget math would require re-tuning the
   whole curve. **Sinks must not touch the ghost budget formula.**
2. **Per-mushroom scope.** Mycelium is earned per-mushroom; sinks
   should reward playing a specific mushroom, not the whole roster.
3. **No new database tables if possible.** Reusing `player_mushrooms`
   rows and the existing `level`/`mycelium` columns is preferred.
4. **Spec traceability.** Whatever ships needs a `[Req 14-X]` section
   in `docs/game-requirements.md` with testable invariants.
5. **Test cost.** Backend unit tests per formula + one scenario test
   per flow. E2E only if the sink has UI affordances.

---

## Options

### Option 1 — Mushroom levels + tier rating (cosmetic only)

**The pitch:** The progression curve uses existing data. Level is
computed from cumulative mycelium and displayed as a named tier badge
on the character card. No stat bonuses — levels are purely a mastery
signal and a gate for Options 5 and 6.

Levels group into five tiers:

| Tier | Levels | Mycelium range (approx) | Badge |
|---|---|---|---|
| Spore | 1–4 | 0–350 | grey |
| Mycel | 5–9 | 350–1 200 | green |
| Root | 10–14 | 1 200–2 500 | brown |
| Cap | 15–19 | 2 500–4 000 | gold |
| Eternal | 20 | 4 000+ | white |

At ~15 mycelium per round win, level 20 takes roughly 267 round wins
(~30–40 focused runs) — a genuine mastery arc without combat power.

**Pros**
- **Zero balance risk.** Levels affect nothing in combat or ghost math.
  No balance re-run needed.
- **Zero schema changes.** `player_mushrooms.mycelium` and `level`
  already exist; `computeLevel()` already computes from mycelium.
- **Clean gate currency.** Option 5 (wiki unlocks) and Option 6
  (portrait variants) reference the same mycelium number — no new
  gating field needed.
- Visible payoff: tier badge + progress bar on the home screen.
  Level-up is a cosmetic event, not a power spike.

**Cons**
- No mechanical reward for reaching a new level — players motivated
  purely by power may not feel the progression. Offset by Options 5
  and 6 filling that reward space with lore and portraits.

**Effort**
- Backend: `MYCELIUM_LEVEL_CURVE` and `getTier(level)` helper in
  `game-data.js`; expose `level` and `tier` in `getPlayerState`. ~1h.
- Frontend: tier badge + progress bar on home screen mushroom card;
  level-up toast on round-result screen. ~2h.
- Tests: `getTier()` unit test — every boundary; level reflected in
  bootstrap after mycelium is awarded. ~45min.

**Total: ~3.75 hours.**

---

### Option 2 — Active skill ranks

**The pitch:** Each mushroom's active skill has 3–5 purchased ranks
that incrementally improve it. Example for Thalla's Spore Lash:

| Rank | Cost (mycelium, not cumulative) | Effect |
|---|---|---|
| 0 | — | +5% stun (base) |
| 1 | 100 | +6% stun |
| 2 | 250 | +7% stun |
| 3 | 500 | +8% stun, +1 damage |

Ranks are **per-mushroom** and persist across runs. The active skill
logic in `battle-engine.resolveAction` reads the rank from a new
`player_mushrooms.skill_rank` column.

**Pros**
- Characters feel meaningfully different at high investment. Gives a
  reason to specialize.
- Stronger identity differentiation than Option 1 (stat bonuses are
  generic; skill ranks touch each mushroom's unique passive/active).

**Cons**
- **Biggest balance project.** Every rank change shifts the
  mushroom's combat curve, which feeds into `[Req 7-D]` ghost
  scaling. Maxing Morga's Flash Cap stun from +10% to +15% is
  non-trivial.
- **Needs new column.** `player_mushrooms.skill_rank INT NOT NULL DEFAULT 0`.
  Small but requires a migration.
- **Requirement doc work.** Each mushroom needs its own `[Req 14-X]`
  for how ranks interact with existing passive/active text.
- **Test fan-out.** Backend tests per rank per mushroom = 5 × 4 = 20+
  new assertions.

**Effort**
- Backend: schema migration, rank lookup in `deriveCombatant`, per-rank
  formulas, 5 new requirement sections. ~4 hours.
- Frontend: rank upgrade UI on character screen. ~3 hours.
- Tests: per-rank unit tests + scenario test for "buy rank mid-run"
  edge case. ~3 hours.
- Balance re-run: full E2E to verify ghost budget feels still fair. ~1 hour.

**Total: ~11 hours.** Should ship alone, not stacked with anything else.

---

### Option 3 — Starter preset variants ✅ implemented

**The pitch:** Reaching a mushroom's level 5 / 10 unlocks alternate
2-item starter presets for that mushroom. Player picks the active
variant from the ✎ picker on the home screen mushroom card. The active
variant is what `getStarterPreset(mushroomId, presetId)` returns,
feeding `startGameRun` and `createChallengeRun`.

Actual presets shipped per mushroom:
- **Thalla:** Standard (L0), Control — Spore Lash + Glimmer Cap (L5), Aggro — Spore Lash + Sporeblade (L10)
- **Lomie:** Standard (L0), Quick — Settling Guard + Haste Wisp (L5), Hybrid — Settling Guard + Moss Ring (L10)
- **Axilin:** Standard (L0), Speedy — Ferment Phial + Haste Wisp (L5), Tough — Ferment Phial + Moss Ring (L10)
- **Kirt:** Standard (L0), Aggressive — Measured Strike + Spore Needle (L5), Control — Measured Strike + Shock Puff (L10)
- **Morga:** Standard (L0), Burst — Flash Cap + Spore Needle (L5), Lockdown — Flash Cap + Glimmer Cap (L10)
- **Dalamar:** Standard (L0), Defensive — Entropy Shard + Bark Plate (L5), Balanced — Entropy Shard + Moss Ring (L10)

All alternate slots use price-1 items so `getStarterPresetCost()` stays
at 2 for every variant — `[Req 4-N]` budget ceiling unchanged.

Ghosts continue to receive their mushroom's **default** preset regardless
of which variant a player has active — no ghost balance change.

**Implementation:**
- `STARTER_PRESET_VARIANTS` constant in `game-data.js`; `getStarterPreset(id, presetId='default')` updated.
- `active_preset TEXT NOT NULL DEFAULT 'default'` column on `player_mushrooms` (auto-ALTERed on start).
- `startGameRun` and `createChallengeRun` read `active_preset` from `player_mushrooms` before seeding.
- `PUT /api/mushroom/:id/preset` — validates level, persists choice.
- Home screen ✎ picker shows preset pills; locked presets display level requirement.

**Total: implemented.**

---

### Option 4 — Mushroom affinity promotion (build influence)

**The pitch:** Spend mycelium to promote an artifact family from
`medium` affinity to `strong` for a specific mushroom. Doesn't change
combat stats — only changes the shop weighting in
`createBotLoadout()` / `generateShopOffer()` (per `[Req 7-F]`:
`strong = 5×, medium = 3×, weak = 1×`).

Example: Lomie has `strong: ['armor']`. Spending 500 mycelium could
promote `medium: ['stun']` → `strong`, so stun artifacts appear more
often in her shop.

**Pros**
- **No combat balance impact.** Promotions change frequency, not
  power level. Ghost budget formula is untouched.
- **Late-run customization** — interacts with the existing shop RNG.
- **Small schema change.** A new column or JSON blob on
  `player_mushrooms` for per-mushroom affinity overrides.

**Cons**
- **Hard to make feel impactful.** A slightly higher shop roll rate
  is a subtle reward; players may not notice it.
- Doesn't satisfy the "give me a concrete upgrade" instinct that
  Options 1 and 2 answer directly.

**Effort**
- Backend: override column, affinity-lookup change in
  `generateShopOffer`, `createBotLoadout`. ~2 hours.
- Frontend: promotion UI on character screen. ~1 hour.
- Tests: shop roll frequency probe (fuzz existing one). ~1 hour.

**Total: ~4 hours.** Cheap but low perceived value — best as a
secondary sink alongside Option 1.

---

### Option 5 — Lore / wiki unlocks

**The pitch:** Each mushroom's wiki entry has tiered lore sections
gated behind mycelium thresholds.

| Threshold | Unlocks |
|---|---|
| 0 | Name + portrait |
| 100 | Passive description |
| 500 | Active description + stat lore |
| 2000 | Full backstory + concept art |

**Pure flavor**. Zero balance impact. Cheap to implement because the
wiki content already exists — this just gates visibility in the
frontend.

**Pros**
- **Zero balance risk.** Cannot affect combat or ghost math.
- **Rewards late-game investment.** Level-cap players still have
  something to grind toward at 2000+ mycelium per mushroom.
- **Cheap.** The wiki already renders markdown; the gate is a
  `v-if="mycelium >= threshold"` on each section.
- **Rewards mushroom mastery with story**, which is thematically
  strong for a lore-archive project.

**Cons**
- Doesn't satisfy players who want mechanical power.
- Needs thoughtful section-splitting of existing lore into tiers so
  each unlock feels earned, not arbitrary.

**Effort**
- Content: split existing wiki entries into 4 tiers per mushroom. ~2 hours.
- Backend: per-section gate in `getWikiEntry()`. ~30 min.
- Frontend: locked-state rendering + "unlock at N" tooltip. ~1 hour.
- Tests: gate enforcement at each threshold. ~30 min.

**Total: ~4 hours.**

---

### Option 6 — Portrait variants ✅ implemented

**The pitch:** Each mushroom has 2–3 alternate portraits unlocked by
mycelium threshold (not spent — threshold-based, same model as wiki
unlocks). The active portrait is shown on the home screen character
card. The base portrait is always free.

Actual variants shipped per mushroom:
- **Thalla:** default (0), 1.jpg (500 mycelium), 2.jpg (1500 mycelium)
- **Lomie:** default (0), 1.jpg (500 mycelium), 2.jpg (1500 mycelium)
- **Axilin:** default (0), 1.jpg (500 mycelium)
- **Kirt:** default (0), 1.jpg (500 mycelium)
- **Morga:** default only (1 variant — more art to be added)
- **Dalamar:** default (0), photo.jpg (500 mycelium)

Portrait assets at `web/public/portraits/{mushroomId}/` — Vite serves
them as static files; new art drops in without a build change.

**Implementation:**
- `PORTRAIT_VARIANTS` constant in `game-data.js` with path, cost, name per variant.
- `active_portrait TEXT NOT NULL DEFAULT 'default'` column on `player_mushrooms` (auto-ALTERed on start).
- `progression` in `getPlayerState` includes `activePortraitUrl`, `portraits[]` (each with `unlocked: mycelium >= cost`).
- `PUT /api/mushroom/:id/portrait` — validates mycelium, persists choice.
- Home screen ✎ picker shows portrait swatches with lock overlay for unearned variants.

**User flow — changing a portrait:**

```
Player opens Home screen
  │
  ├─ Mushroom card has only 1 portrait variant (e.g. Morga)
  │    └─ ✎ button is not shown. No action available.
  │
  └─ Mushroom card has 2+ portrait variants
       └─ ✎ button visible on the card
            │
            ▼
       Player clicks ✎
       Card expands to show portrait swatch row
            │
            ├─ Swatch is ACTIVE (current portrait)
            │    └─ Green border, no action needed. Already selected.
            │
            ├─ Swatch is UNLOCKED (mycelium >= variant.cost)
            │    └─ Full opacity. Player clicks swatch.
            │         │
            │         ▼
            │    PUT /api/mushroom/:id/portrait { portraitId }
            │         │
            │         ├─ 200 OK → refreshBootstrap()
            │         │    active_portrait updated in DB
            │         │    home screen card shows new portrait immediately
            │         │
            │         └─ 403 (race: mycelium dropped between render and PUT)
            │              └─ no state change; UI re-renders on next bootstrap
            │
            └─ Swatch is LOCKED (mycelium < variant.cost)
                 └─ 45% opacity, 🔒 overlay, tooltip "Unlocks at N mycelium"
                      └─ Click is ignored (no event emitted)
```

**Unlock conditions (server-enforced):**

| Check | Rule | Error |
|---|---|---|
| Mushroom exists | `mushroomId` must be a key in `PORTRAIT_VARIANTS` | 404 |
| Portrait exists | `portraitId` must be in that mushroom's variant list | 400 |
| Mycelium threshold | `player_mushrooms.mycelium >= variant.cost` for that player+mushroom row | 403 |

Mycelium is **not deducted** — the threshold is a cumulative gate, not
a purchase. Reaching 500 mycelium on Thalla permanently unlocks Variant
1; spending it elsewhere has no effect.

**Total: implemented.**

---

## Options considered and rejected

### Run modifiers / relics
Adds an entire new system parallel to artifacts. Would need its own
balance pass, new requirement section, UI surface, etc. Too big
relative to the problem.

### Mycelium → spore conversion
Defeats the per-mushroom scoping. Mycelium becomes fungible which
removes the "play this mushroom to earn its mycelium" loyalty loop.

### Trading mycelium between players
Opens a moderation surface (goldfarming, begging). No thanks.

---

## Recommendation

**Options 1, 3, 5, and 6 are all shipped.** The mycelium sink is fully
functional: levels, tier badges, wiki gating, portrait variants, and
preset variants are live.

Retrospective:

1. **All four options have zero balance impact.** No stat bonuses, no
   ghost scaling, no combat formula changes — no balance re-run needed.
2. **Option 1 (levels + tier rating)** delivered the payoff loop: every
   mycelium reward advances a visible tier badge + progress bar, and a
   level-up toast fires on round-result when a threshold is crossed.
3. **Option 5 (wiki unlocks)** added the lore reward layer. Mycelium
   thresholds (0/100/1000/3000) align naturally with tier boundaries.
4. **Option 6 (portrait variants)** is the prestige layer. Art was
   delivered to `web/public/portraits/` and the picker is live on the
   home screen. More portraits can be dropped in without a deploy.
5. **Option 3 (preset variants)** gave build variety per mushroom —
   3 variants per mushroom at level 0/5/10, all costing 2 coins total
   so the budget validator is unchanged.
6. **Schema additions:** `player_mushrooms.active_portrait` and
   `player_mushrooms.active_preset` (both TEXT, DEFAULT 'default',
   auto-ALTERed by Sequelize sync on deploy).

**Schedule Option 2 (skill ranks) for a later cycle, alone.** It's
the biggest balance project and deserves its own plan doc, its own
PR, and its own balance pass. Don't share a release with anything else.

**Option 4 (affinity promotion) remains optional** — a small follow-up
if a secondary shop-weighting sink is wanted later.

---

## Implementation summary

### What shipped (Options 1, 3, 5, 6)

**Backend:**
- `MYCELIUM_LEVEL_CURVE`, `computeLevel()`, `getTier()`, `WIKI_TIER_THRESHOLDS` in `game-data.js`.
- `PORTRAIT_VARIANTS` and `STARTER_PRESET_VARIANTS` in `game-data.js`.
- `getStarterPreset(mushroomId, presetId='default')` is variant-aware; `getStarterPresetCost` unchanged.
- `getWikiEntry()` gates sections by mycelium; character wiki route passes player mycelium.
- `getPlayerState` progression includes `level`, `tier`, `currentLevelMycelium`, `nextLevelMycelium`, `activePortrait`, `activePortraitUrl`, `portraits[]`, `activePreset`, `presets[]`.
- `PUT /api/mushroom/:id/portrait` — mycelium gate, persists `active_portrait`.
- `PUT /api/mushroom/:id/preset` — level gate, persists `active_preset`.
- `startGameRun` and `createChallengeRun` read `active_preset` before seeding starter items.
- `resolveRound` computes `levelBefore`/`levelAfter` and returns them in `lastRound`.

**Frontend:**
- Home screen: tier badge, progress bar, level-up toast on round-result.
- Home screen: ✎ customize button per mushroom card; expands portrait swatches + preset pills.
- Portrait swatches show lock overlay + tooltip for locked variants.
- Preset pills show level requirement for locked variants.
- Wiki detail: locked sections render lock icon + "Unlocks at N mycelium".
- `switchPortrait` / `switchPreset` handlers call API and refresh bootstrap.

**Schema additions** (auto-ALTERed by Sequelize sync):
- `player_mushrooms.active_portrait TEXT NOT NULL DEFAULT 'default'`
- `player_mushrooms.active_preset TEXT NOT NULL DEFAULT 'default'`

**Tests — covered:** `tests/game/mushroom-progression.test.js` — 22 tests covering level curve boundaries, all tier boundaries, wiki gating at all thresholds, and bootstrap `tier` field. (Options 1 + 5 only.)

**Tests — outstanding (Options 3 + 6):**

The following scenarios have no test coverage yet. All are backend-testable without a browser.

*Option 6 — Portrait variants*

| # | What to assert | How |
|---|---|---|
| P1 | `PORTRAIT_VARIANTS` shape: every mushroom has an entry; first variant is always `default` with `cost: 0` | unit — import and assert |
| P2 | Bootstrap `portraits[]` has correct `unlocked` flag based on player's mycelium | service — set mycelium in DB, call `getPlayerState`, check `portraits[n].unlocked` |
| P3 | Bootstrap `activePortraitUrl` reflects `active_portrait` column | service — set `active_portrait` in DB, call `getPlayerState`, check URL |
| P4 | `PUT /api/mushroom/:id/portrait` happy path: mycelium threshold met → 200, `active_portrait` persisted | API — seed mycelium ≥ cost, PUT, re-fetch bootstrap |
| P5 | `PUT /api/mushroom/:id/portrait` gate: mycelium below threshold → 403, no DB change | API — seed mycelium < cost, PUT, assert 403 + column unchanged |
| P6 | `PUT /api/mushroom/:id/portrait` unknown portrait id → 400 | API |
| P7 | `PUT /api/mushroom/:id/portrait` unknown mushroom id → 404 | API |

*Option 3 — Preset variants*

| # | What to assert | How |
|---|---|---|
| V1 | `STARTER_PRESET_VARIANTS` shape: every mushroom has 3 variants; first is always `default` with `requiredLevel: 0` | unit |
| V2 | `getStarterPreset(mushroomId, presetId)` returns the correct item pair for each named variant | unit — call for each mushroom × each variant |
| V3 | `getStarterPreset(mushroomId, 'nonexistent')` falls back to `default` without throwing | unit |
| V4 | Bootstrap `presets[]` has correct `unlocked` flag based on level | service — set mycelium to L5 threshold, call `getPlayerState`, check `presets[1].unlocked` |
| V5 | Bootstrap `activePreset` reflects `active_preset` column | service — set `active_preset` in DB, call `getPlayerState` |
| V6 | `startGameRun` seeds the **active** preset's items, not always default | integration — set `active_preset` to a non-default variant, start run, assert round-1 loadout contains the variant's item IDs |
| V7 | `PUT /api/mushroom/:id/preset` happy path: level met → 200, `active_preset` persisted | API |
| V8 | `PUT /api/mushroom/:id/preset` gate: level too low → 403, no DB change | API |
| V9 | `PUT /api/mushroom/:id/preset` unknown preset id → 400 | API |
| V10 | `PUT /api/mushroom/:id/preset` unknown mushroom id → 404 | API |

*Level-up signal (Option 1 gap)*

| # | What to assert | How |
|---|---|---|
| L1 | `resolveRound` response includes `lastRound.levelBefore` and `lastRound.levelAfter`; `levelAfter > levelBefore` when mycelium award crosses a level threshold | integration — set player to mycelium just below a threshold, resolve, assert |

V6 and L1 can extend the existing `solo-run-scenario.test.js`. P4/P5/V7/V8 require an HTTP server fixture (same pattern as `tests/game/auth.test.js` if it spins up the app, otherwise inline service calls with the route handler extracted).

---

## Out of scope / deferred

- Skill ranks (Option 2) — plan doc required first, separate PR. High balance risk.
- Affinity promotion (Option 4) — optional cherry-on-top for a later cycle.
- Prestige / level reset — wait until curve is battle-tested.
- Morga portrait variants — only `default.png` exists; more art to be added when ready.

---

## Open questions for product

1. **Level cap.** 20 is arbitrary. Should the curve go higher (e.g.
   50) with diminishing per-level bonuses, or should level 20 be the
   true ceiling and the 2000-mycelium wiki unlock be the "over-cap"
   goal?

2. **Ghost level scaling.** The recommendation is "ghosts use base
   stats only". An alternative is "ghosts match the player's level"
   which would keep the difficulty constant but eliminate the
   power-progression feeling. The recommended approach (ghosts don't
   scale) is simpler and gives the player a clearer sense of growth.

3. **Level-down on abandon?** Currently `[Req 10-D]` says solo
   abandon keeps per-round rating changes applied. Should mycelium
   earned during an abandoned run stick? Default: yes (same as
   rating), since the mushroom still "played" those rounds.

4. **Per-mushroom or roster-wide leaderboard.** Not an open question
   for this cycle, but worth noting: the leaderboard is currently
   player-global. Levels are per-mushroom, which may make a
   per-mushroom leaderboard interesting ("top 10 Thallas") as a
   follow-up.

---

## Sizing summary

| Option | Balance risk | Status |
|---|---|---|
| 1. Mushroom levels + tier rating | None | ✅ Shipped |
| 2. Skill ranks | High | Deferred — separate PR |
| 3. Preset variants | None | ✅ Shipped |
| 4. Affinity promotion | None | Optional follow-up |
| 5. Wiki unlocks | None | ✅ Shipped |
| 6. Portrait variants | None | ✅ Shipped |
