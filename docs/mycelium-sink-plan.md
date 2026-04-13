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

### Option 1 — Mushroom levels (stat bonuses)

**The pitch:** The progression curve uses existing data. Reaching
level `N` grants a permanent small stat bonus to that mushroom's base
stats. Curve example:

| Level | Mycelium (cumulative) | Bonus |
|---|---|---|
| 1 | 0 | — |
| 2 | 50 | +1 HP |
| 3 | 120 | +1 ATK |
| 4 | 220 | +1 SPD |
| 5 | 360 | +1 DEF |
| 6 | 540 | +1 HP |
| ... | ... | rotate HP → ATK → SPD → DEF |
| 20 | ~4000 | +5 to each base stat (cap) |

At ~15 mycelium per round win (`runRewardTable.win.mycelium = 15`),
level 20 takes roughly 267 round wins. That's ~30–40 full runs
focused on one mushroom — a reasonable "mastery" arc.

**Pros**
- 100% reuses existing schema. `player_mushrooms.mycelium` is already
  written; `computeLevel()` already exists. **No new tables, no new
  endpoints** — just a level-to-bonus lookup applied in
  `battle-engine.deriveCombatant`.
- Visible payoff: home screen shows level + progress bar. Every
  mycelium reward notification feels meaningful.
- Ties into existing reward math: the completion bonus tiers
  (`[Req 9-B]`) already reward full runs, so levels reward repetition.

**Cons**
- **Balance risk.** Stat bonuses affect ghost budget math indirectly —
  a level-20 Lomie is ~20 HP tankier than a level-1 Lomie, which
  changes the natural step-cap vs. death ratio. Mitigation: cap at
  +5 per stat and re-run the scenario tests; the bonuses are small
  relative to artifact contributions (e.g. truffle_bulwark = +7
  armor by itself).
- **Rich-get-richer.** A player with a maxed mushroom has an edge
  over one who just unlocked it. Mitigated by it being per-mushroom —
  a maxed Thalla doesn't help when playing Axilin.

**Effort**
- Backend: curve table in `game-data.js`, lookup call in
  `deriveCombatant`, new `[Req 14-A]` section. ~1 hour.
- Frontend: home screen level bar + popup on level-up. ~2 hours.
- Tests: unit test for curve table, scenario test for level-up
  applies to next battle. ~1 hour.
- Balance re-run: run `battle-engine.test.js` with +5 stats and
  verify no new step_cap regressions. ~30 min.

**Total: ~5 hours.**

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
`web/src/assets/portraits/{thalla,lomie,axilin,kirt,morga}/`.

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

1. **Total budget is ~9 hours** for Options 1+5 — realistic for a
   single PR.
2. **Option 1 (levels)** gives the immediate payoff loop: every
   round's mycelium reward means something, the home screen shows
   visible progress, level-ups are a tangible event.
3. **Option 5 (wiki unlocks)** gives the late-game reward for players
   who maxed level 20: their mycelium keeps accumulating toward the
   2000-point lore tier. Zero balance risk so it can ship *next to*
   Option 1 without complicating the balance re-run.
4. **Option 6 (portrait variants)** is the prestige cosmetic layer on
   top of the progression system. The backend + frontend (~4.5h) can
   ship independently of the art; portraits drop in as static files
   whenever they're ready. The portrait folders are already scaffolded
   at `web/src/assets/portraits/{mushroom}/`.
5. **None of these options touch ghost budget math directly.** Option
   1's stat bonuses are capped at +5 per stat (less than one
   artifact's bonus) and balance can be verified by running the
   existing `battle-engine.test.js` suite with level-20 stat presets.
6. **Options 1 and 5 reuse existing schema.** No migrations, no new
   tables. `player_mushrooms.mycelium` and `level` already exist.
   Option 6 adds one column (`active_portrait`).

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
  cumulative mycelium. The curve is defined in
  `MYCELIUM_LEVEL_CURVE` in `app/server/game-data.js`.
- **14-B.** Reaching a level grants a permanent stat bonus to that
  mushroom's base stats. Bonuses cycle HP → ATK → SPD → DEF; level
  20 is capped at +5 per stat.
- **14-C.** Stat bonuses are additive to the base stats before
  artifacts contribute. Ghost opponents do NOT receive the player's
  level bonus — ghosts use base stats only (balance: avoids compound
  scaling in `[Req 7-D]`).
- **14-D.** Level is per-mushroom. Playing Thalla does not level
  Axilin.
- **14-E.** Wiki entries are tiered by cumulative mycelium. Tiers:
  - 0 mycelium: portrait + name
  - 100 mycelium: passive description
  - 500 mycelium: active description + stat lore
  - 2000 mycelium: full backstory
  Tier thresholds live in `WIKI_TIER_THRESHOLDS`. Locked sections
  render as a "unlock at N mycelium" placeholder.
```

### Backend changes

- `app/server/game-data.js`: add `MYCELIUM_LEVEL_CURVE` array and
  `getLevelBonus(level)` helper.
- `app/server/services/battle-engine.js`: in `deriveCombatant`, add
  level bonus to base stats before artifact summary, **only for the
  player side, not the ghost side**.
- `app/server/wiki.js`: add `tier` gating to `getWikiEntry()`; accept
  a `mushroomMycelium` param and return a redacted entry below the
  threshold.

### Frontend changes

- Home screen mushroom card: add a level badge + progress bar to
  next level.
- Wiki detail screen: render redacted sections with a lock icon + "at
  N mycelium" copy.
- Level-up toast on the round-result screen when a round push crosses
  a level threshold.

### Tests

Backend:
- `getLevelBonus(level)` unit test — every tier.
- `deriveCombatant` scenario test: level-10 Thalla has +3 HP/+3 ATK/... etc (exact per curve).
- `getWikiEntry` tier gating: 99/100 boundary, 499/500, 1999/2000.
- Ghost does NOT benefit from player level: at player level 20, ghost
  snapshot still uses base stats (covers `[Req 14-C]`).

E2E (solo-run.spec.js):
- Earn enough mycelium to cross level 2, verify home screen level
  badge updates after next `refreshBootstrap`.
- Verify locked wiki section is visible on a fresh player.

### Data model

No schema changes. `player_mushrooms.mycelium` and `level` already
exist. `level` remains computed-on-read via `computeLevel()`; the
new curve table adds persistent meaning to it.

### Migration / deploy

None. Level bonuses apply immediately on deploy since `level` is
computed from existing `mycelium` values. Players with long
histories will "unlock" bonuses retroactively — this is a feature,
not a bug (rewards existing investment).

---

## Out of scope for the first cycle

- Skill ranks (Option 2) — plan doc required first, separate PR.
- Preset variants (Option 3) — revisit after Option 1 ships and we
  can see how level caps feel in practice.
- Affinity promotion (Option 4) — optional follow-up.
- Cosmetic skins — needs art pipeline.
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
| 1. Mushroom levels | ~5h | Low (cap at +5) | ✅ First cycle |
| 2. Skill ranks | ~11h | High | Schedule alone, later |
| 3. Preset variants | ~10h | Medium | Only after Option 1 |
| 4. Affinity promotion | ~4h | None | Optional follow-up |
| 5. Wiki unlocks | ~4h | None | ✅ First cycle |
| 6. Portrait variants | ~4.5h | None | ✅ When art is ready |

**First cycle: Options 1 + 5 = ~9 hours real work.**
**Option 6: +4.5h, blocked on portrait art delivery.**
