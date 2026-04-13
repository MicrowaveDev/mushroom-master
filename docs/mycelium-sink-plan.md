# Mycelium Sink — Design Plan

**Status:** Draft. Awaiting product decision on which option(s) to ship.
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

### Option 3 — Starter preset variants

**The pitch:** Reaching a mushroom's level 5 / 10 / 15 (via Option 1)
unlocks alternate 2-item starter presets for that mushroom. Player
picks the active variant on the character screen. The active variant
is what `getStarterPreset()` returns, feeding `startGameRun` and the
ghost generator.

Example for Thalla (level-gated):
- **Level 0 (default):** Spore Lash + Spore Needle — control-leaning.
- **Level 5 unlock:** Spore Lash + Haste Wisp — speed/control hybrid.
- **Level 10 unlock:** Thunder Gill + Spore Needle — damage pivot.

**Pros**
- **Adds build variety without inflating the artifact pool.** Each
  mushroom becomes 3 mini-classes by mid-game.
- Natural tie-in with Option 1 (levels are the gating currency).
- Per-mushroom naturally — encourages mushroom loyalty.

**Cons**
- **Content work.** 5 mushrooms × 2 alternate presets = 10 new items
  to balance. Each alternate preset must cost ≤2 coins to match
  `[Req 4-N]` budget ceiling.
- **`[Req 3-A]`–`[Req 3-E]` rewrite.** The "2-item signature preset"
  rule needs to become "an active 2-item preset chosen from unlocked
  variants".
- **Ghost impact.** Ghost opponents also get starter presets
  (`[Req 3-E]`, `[Req 7-C]`) — the game needs to pick which variant
  ghosts use. Probably roll it from the `gameRunId` seed for
  determinism.

**Effort**
- Design: 10 alternate preset builds + playtest. ~4 hours.
- Backend: `STARTER_PRESET_VARIANTS` table, selection logic, req
  rewrite. ~2 hours.
- Frontend: character-screen variant picker. ~2 hours.
- Tests: variant unlock gates, ghost uses active variant, starter
  fuzzer catches variant leaks. ~2 hours.

**Total: ~10 hours.** Only valuable if Option 1 ships first (depends on levels).

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

### Option 6 — Portrait variants

**The pitch:** Each mushroom has 2–3 alternate portraits purchasable
with mycelium. The active portrait is shown everywhere the mushroom
appears: character card, home screen, replay bubbles. The base
portrait costs nothing; variants are bought once and persist.

| Variant | Cost (mycelium) |
|---|---|
| Default | — (always unlocked) |
| Variant 1 | 500 |
| Variant 2 | 1500 |

Assets live in `web/src/assets/portraits/{mushroom}/`:
- `default.png` — base portrait (ships with the game)
- `variant-1.png`, `variant-2.png` — alternate art provided by designer

**Pros**
- **Zero balance impact.** Purely cosmetic — no combat, no ghost math.
- **Per-mushroom naturally.** Thalla's portraits stay on Thalla.
- **High perceived value.** New art feels more earned than a stat tick.
- **Late-game sink.** 1500 mycelium per mushroom × 5 mushrooms = 7500
  mycelium to collect everything. Complements Option 1 and 5 as the
  ultimate mastery flex.

**Cons**
- **Blocked on art assets.** System can ship before art; portraits drop
  in as files and Vite picks them up without a deploy (static assets).
- **One new schema column.** `player_mushrooms.active_portrait TEXT
  NOT NULL DEFAULT 'default'` — small migration, same pattern as
  existing columns.

**Effort**
- Backend: `active_portrait` column migration, purchase endpoint
  (`POST /api/mushroom/:id/portrait`), serve active portrait in
  `getPlayerState`. ~1.5 hours.
- Frontend: portrait picker on character screen, portrait resolved
  dynamically in replay bubble via `replayPortraitConfigByMushroom`.
  ~2 hours.
- Tests: purchase gate (can't afford, already owned), portrait
  change reflects in subsequent `refreshBootstrap`. ~1 hour.

**Total: ~4.5 hours.** Blocked on art delivery — implement the system
now, drop assets in when ready. The portrait folders already exist at
`web/public/portraits/{thalla,lomie,axilin,kirt,morga,dalamar}/`.

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

**Ship Option 1 + Option 5 as one cycle. Add Option 6 once portrait
art arrives.**

Rationale:

1. **Total budget is ~7.75 hours** for Options 1+5 — realistic for a
   single PR.
2. **Option 1 (levels + tier rating)** gives the immediate payoff
   loop with zero balance risk: every mycelium reward advances a
   visible tier, level-ups are a cosmetic event, no ghost math is
   touched.
3. **Option 5 (wiki unlocks)** gives the late-game lore reward.
   Mycelium thresholds line up with the level tiers naturally (e.g.
   tier Root unlocks at ~1 200 mycelium; lore tier 2 unlocks at
   1 000 mycelium).
4. **Option 6 (portrait variants)** is the prestige layer. The
   backend + frontend (~4.5h) can ship independently of the art;
   portraits drop in as static files. The portrait folders are already
   scaffolded at `web/public/portraits/{mushroom}/`.
5. **All three options have zero balance impact.** No stat bonuses,
   no ghost scaling, no combat formula changes. No balance re-run
   needed.
6. **Options 1 and 5 need no schema changes.** `player_mushrooms.
   mycelium` and `level` already exist. Option 6 adds one column
   (`active_portrait`).

**Schedule Option 2 (skill ranks) for a later cycle, alone.** It's
the biggest balance project and deserves its own plan doc, its own
PR, and its own balance pass. Don't share a release with anything
else.

**Consider Option 3 (preset variants) only after Option 1 ships** —
it depends on levels as the gating currency, and needs content work
that's lower priority than the core loop.

**Option 4 (affinity promotion) is a small cherry-on-top** that could
land in a follow-up PR alongside Option 5 if wiki unlocks alone feel
too thin as a late-game sink.

---

## Proposed first-cycle plan (Options 1 + 5)

### Requirements

New section in [docs/game-requirements.md](./game-requirements.md):

```
## 14. Mushroom Progression

- **14-A.** Each mushroom has a level (1–20) computed from its
  cumulative mycelium via `MYCELIUM_LEVEL_CURVE` in
  `app/server/game-data.js`. Level has no effect on combat stats.
- **14-B.** Levels map to one of five cosmetic tiers via `getTier()`:
    Spore (1–4) → Mycel (5–9) → Root (10–14) → Cap (15–19) → Eternal (20).
  Tier is displayed as a badge on the home screen mushroom card and
  the character select screen.
- **14-C.** Level is per-mushroom. Playing Thalla does not level Axilin.
- **14-D.** Wiki entries are gated by cumulative mycelium. Tiers:
    - 0 mycelium: portrait + name
    - 100 mycelium: passive description
    - 1000 mycelium: active description + stat lore
    - 3000 mycelium: full backstory
  Thresholds live in `WIKI_TIER_THRESHOLDS`. Locked sections render
  as an "unlock at N mycelium" placeholder.
```

### Backend changes

- `app/server/game-data.js`: add `MYCELIUM_LEVEL_CURVE` array,
  `computeLevel(mycelium)` export, `getTier(level)` helper, and
  `WIKI_TIER_THRESHOLDS` constant.
- `app/server/wiki.js`: gate `getWikiEntry()` on a `mycelium` param;
  return redacted sections below the threshold.
- `getPlayerState` / bootstrap: include `level` and `tier` per
  mushroom row (computed from existing `mycelium` column).

### Frontend changes

- Home screen mushroom card: tier badge + progress bar to next level.
- Wiki detail screen: locked sections show lock icon + "unlock at N
  mycelium" copy.
- Round-result screen: level-up toast when mycelium award crosses a
  level threshold (compare level before vs. after reward).

### Tests

Backend:
- `getTier(level)` unit test — all 20 levels, every tier boundary.
- `getWikiEntry` gating: 99/100 boundary, 999/1000, 2999/3000.

E2E (solo-run.spec.js):
- Fresh player: wiki section locked at 0 mycelium.
- After earning ≥100 mycelium: passive section unlocked.

### Data model

No schema changes. `player_mushrooms.mycelium` and `level` already
exist. Level is computed-on-read; tier is derived from level.

### Migration / deploy

None. Tier badges appear immediately on deploy for all players based
on their existing mycelium totals — retroactive display is the intent.

---

## Out of scope for the first cycle

- Skill ranks (Option 2) — plan doc required first, separate PR.
- Preset variants (Option 3) — revisit after Option 1 ships.
- Affinity promotion (Option 4) — optional follow-up.
- Prestige / level reset — wait until the curve is battle-tested.

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

| Option | Effort | Balance risk | Recommended? |
|---|---|---|---|
| 1. Mushroom levels + tier rating | ~3.75h | None | ✅ First cycle |
| 2. Skill ranks | ~11h | High | Schedule alone, later |
| 3. Preset variants | ~10h | Medium | Only after Option 1 |
| 4. Affinity promotion | ~4h | None | Optional follow-up |
| 5. Wiki unlocks | ~4h | None | ✅ First cycle |
| 6. Portrait variants | ~4.5h | None | ✅ When art is ready |

**First cycle: Options 1 + 5 = ~7.75 hours real work.**
**Option 6: +4.5h, blocked on portrait art delivery.**
