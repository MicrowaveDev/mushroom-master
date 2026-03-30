# Telegram Mushroom Auto-Battler Plan

## Source of Truth

### Original request

Make a plan for a future game and save it as a markdown file. The idea is a Telegram bot with a Web App where mushrooms fight each other in an auto-battler. The Web App should also include a wiki. The entry point should start when someone mentions the bot username so the bot posts a game Web App. Users choose their characters, those choices are saved for them, battles grant experience, leveling up can unlock skills, and the battle presentation should be text-driven with avatar animation and highlighting, similar in feel to Backpack Battles. The plan should include frontend and backend implementation and describe all screens that should be implemented.

### User requirements

- The product is a Telegram bot plus Telegram Web App.
- The game is an auto-battler featuring mushroom characters.
- The Web App must include a wiki.
- The entry point starts from mentioning the bot username.
- Users choose their character and that choice is saved for them.
- Battles grant `mycelium`.
- Level-ups can exist, but there are no skill choices in v1.
- Battles should be presented through text actions plus avatar animation and highlighting.
- The plan must cover frontend and backend implementation.
- The plan must list all screens.
- The output must be saved as an `.md` file in the repo.
- Currency is `spore`.
- All launch characters are available from the start.
- Losses still grant `mycelium`, but 10 times less than wins.
- Progression is per-character for each player.
- Battles are `1v1`, not team-based.
- Before battle, the user chooses artifacts to put into a container, inspired by Backpack Battles.
- Artifact effects in v1 are limited to armor, damage, and stun chance.
- There are no status effects in v1.
- Everything described in the wiki is canon.
- Only admins can change the wiki.
- Admin access is controlled by a config allowlist of Telegram usernames.
- Admin wiki edits happen through repo content, not through direct in-app editing.
- Wiki pages should be built from structured markdown files stored in the repo.
- The game needs friends, shareable replays, and leaderboard support.
- Friends are added through short internal friend codes made of 6 numbers.
- Admin tooling should be planned in the backlog.
- The project needs tests that run several combinations with the ChatGPT OpenAI API and display results in a separate local page for testing and inspection.
- Battle starts must be rate-limited to no more than 10 per person per day.
- The app is Russian-first, with an English toggle.
- Avatars initially come from Telegram avatars.
- Only 5 mushrooms ship in v1.
- Custom avatar uploads belong in the backlog.
- SVG-first rendering and simple animation effects are acceptable for launch.
- Monetization belongs in the backlog.

### Constraints discovered during research

- Telegram Mini Apps can be launched in several ways, but `web_app` buttons on inline and reply keyboards are limited to private chats between the user and the bot. For group-triggered entry, the bot should reply with a deep link into the Mini App or guide the user into the bot's private chat, then continue onboarding there.
- Telegram Mini Apps should validate `Telegram.WebApp.initData` on the backend before trusting the user identity or session context.
- Telegram supports main Mini App links and direct Mini App links with `startapp` parameters, which makes it possible to open different entry states from a bot reply.

### Success conditions

- The product direction is specific enough for implementation without making major product decisions during coding.
- The plan defines the bot entry flow, gameplay loop, progression, artifact system, wiki, frontend screens, backend services, data model, validation, and delivery phases.
- The plan clearly separates user requirements, assumptions, and implementation choices.
- The plan is structured so an agent or multiple sub-agents can implement it in ordered stages without inventing missing workflow decisions.

### Open assumptions

- The first version uses asynchronous PvP or ghost battles, not synchronous real-time multiplayer.
- The artifact container is intentionally simple in v1 and does not yet implement full Backpack Battles style spatial optimization.
- The wiki will be built by structuring and adapting the repository's existing markdown lore sources into wiki-ready folders and pages.
- The visual direction for the Web App follows the repo's future light pastel mushroom theme.

## Agent Execution Notes

This document is intended to be executable by agents, not only readable by humans.

Execution rules:

- implement in ordered phases
- validate after each phase before continuing
- keep backlog items out of active implementation unless explicitly promoted
- use sub-agents only for bounded work with disjoint write scopes
- do not let one agent opportunistically implement multiple future phases
- do not treat unspecified future systems as implied scope

### Do not implement in v1 unless explicitly promoted

- status effects
- branching skill choices
- deep skill trees
- custom avatar uploads
- monetization
- complex item rarity systems
- artifact rotation
- advanced packing puzzles
- real-time multiplayer
- broad admin dashboards beyond what is required for wiki control or local test tooling

### First slice contracts

The first implementation slice must prove:

1. mention bot
2. open Mini App
3. authenticate Telegram user
4. choose one mushroom
5. place exactly 3 artifacts in a `4x4` grid
6. save loadout
7. start one async battle
8. watch replay
9. receive `spore` and per-character `mycelium`
10. open wiki

Nothing outside that chain is required for the first playable milestone.

## Research Notes

### Telegram Mini App behavior

- Telegram's official Mini App docs support main Mini Apps, direct links, menu buttons, attachment menu launches, and inline/reply button launches.
- The Mini App can read `start_param` and `tgWebAppStartParam`, which is useful for deep-linking users into onboarding, battle invites, or wiki pages.
- Backend validation of `initData` is required before creating authenticated game sessions.

Primary sources:

- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Deep Links](https://core.telegram.org/api/links)

### Auto-battler patterns worth borrowing

- `Backpack Battles` is especially relevant for pre-battle build expression, where small equipment choices create large combat differences.
- `Backpack Battles` also shows the value of readable, satisfying auto-resolved combat playback.
- `Super Auto Pets` shows the value of short rounds, persistent progression, asynchronous fights, and low-friction replayability.

Primary references:

- [Backpack Battles on Steam](https://store.steampowered.com/app/2427700/Backpack_Battles/)
- [Super Auto Pets on Steam](https://store.steampowered.com/app/1714040/Super_Auto_Pets/)

## Product Direction

### Core fantasy

Players choose one mushroom champion from the canon lore roster, equip a small artifact container, and watch that mushroom fight another mushroom in short, dramatic, text-narrated auto-battles inside Telegram.

### Recommended v1 game loop

1. User mentions the bot in a group or channel discussion where the bot is present.
2. Bot replies with a short pitch and a deep link into the Mini App.
3. User opens the Mini App in Telegram.
4. User completes first-time onboarding and chooses an initial mushroom from the five launch characters.
5. User equips a simple artifact container.
6. User enters an async PvP battle.
7. The backend resolves the battle asynchronously and returns a battle replay payload.
8. The Web App plays the battle through turn-by-turn action text, avatar animation, artifact flashes, hit/highlight states, and result summary.
9. User receives `spore`, per-character `mycelium`, leaderboard movement, and replay-sharing options.
10. User returns to character selection, artifact setup, social features, progression, or the wiki.

### Recommended initial modes

- `Async PvP Ghost Battles`
  - primary v1 mode
  - users fight randomly selected stored snapshots of other players' character + artifact loadouts
  - no real-time session complexity
- `Friends Battles`
  - direct asynchronous rivalry loop
  - strong fit for Telegram social distribution
- `Ranked Season`
  - later phase after balance and retention are stable

### Why this shape fits the request

- It preserves the requested Telegram-first entry flow.
- It supports saved character choice and persistent progression.
- It keeps the battle design close to the requested Backpack Battles inspiration through artifact choices.
- It avoids unnecessary v1 complexity like multi-unit teams, status systems, or branching skill trees.

## Game Design Spec

### Battle format

- Battle format is `1v1`.
- Each side fields:
  - 1 mushroom champion
  - 1 artifact container
- Battle type is automatic round-based combat.
- Turn order is derived from speed or initiative.
- Each mushroom has:
  - health
  - attack
  - speed
  - defense
  - role tag such as tank, striker, controller, or support
  - 1 passive
  - 1 active skill
- Character base attributes are fixed by design data.
- In v1, combat attributes can be changed only by setting artifacts in the container.
- Leveling and progression do not directly change combat attributes in v1 unless that change is represented by an artifact-based loadout rule added later.
- Artifacts modify only:
  - armor
  - damage
  - stun chance
- There are no status effects in v1.
- There are no manual skill choices in v1.
- Battle result is described as an ordered action log:
  - turn start
  - acting mushroom
  - chosen action
  - target resolution
  - damage and armor interaction
  - stun roll outcome
  - passive trigger
  - round end
  - winner, draw, and rewards

### Artifact container

- The artifact container is the primary strategy surface in v1.
- Players choose artifacts before battle.
- All launch artifacts are available from the start.
- The container is the only player-controlled source of combat-stat modification in v1.
- Recommended v1 implementation:
  - `4x4` grid container
  - grouped artifact library
  - place exactly 3 artifacts into the available slots
  - simple artifact shapes, no rotation in v1
  - exactly one saved loadout per player in v1

### Backpack Battles inspiration, simplified for v1

Research conclusion:

- Yes, the plan is intentionally borrowing from `Backpack Battles`, but in a simpler first version.
- The key pattern worth copying is not the full inventory puzzle immediately.
- The key pattern is:
  - pre-battle build decisions
  - small item choices with visible combat payoff
  - auto-resolved battles that are satisfying to watch

Recommended v1 simplification:

- keep a container metaphor
- use a small `4x4` spatial grid
- use only three artifact effect families:
  - armor
  - damage
  - stun chance
- keep artifact count small and fully available from the start
- allow only 3 artifacts equipped at once
- make battles deterministic enough to debug and balance

Do not add in v1:

- grid rotation
- complex packing puzzles
- item rarity trees
- status-effect chains
- large proc ecosystems
- complex item-combo grammars

Put those into backlog instead after the simple artifact loop proves fun.

#### Minimal launch artifact list

Shape rules for v1:

- each artifact has a fixed footprint on the `4x4` grid
- artifacts cannot overlap
- artifacts cannot rotate
- a valid loadout must contain exactly 3 placed artifacts
- if a placement does not fit, it cannot be saved

Recommended launch shapes:

- `1x1`
- `1x2`
- `2x1`
- `2x2`

##### Damage artifacts

- `Spore Needle`
  - effect: `+2 damage`
  - shape: `1x1`
- `Amber Fang`
  - effect: `+4 damage`, `-1 armor`
  - shape: `1x2`
- `Glass Cap`
  - effect: `+5 damage`, `-2 armor`
  - shape: `2x1`

##### Armor artifacts

- `Bark Plate`
  - effect: `+2 armor`
  - shape: `1x1`
- `Mycelium Wrap`
  - effect: `+3 armor`
  - shape: `2x1`
- `Root Shell`
  - effect: `+5 armor`, `-1 speed`
  - shape: `2x2`

##### Stun chance artifacts

- `Shock Puff`
  - effect: `+8% stun chance`
  - shape: `1x1`
- `Static Spore Sac`
  - effect: `+14% stun chance`, `-1 damage`
  - shape: `1x2`
- `Thunder Gill`
  - effect: `+20% stun chance`, `-1 armor`
  - shape: `2x1`

Backlog expansion:

- more artifact families
- rarity
- combo rules
- geometry-based container layout closer to Backpack Battles
- elemental or status interactions

#### Mini-spec: artifact value table

Use these exact values as the first balance baseline for implementation.
They are not permanent truths: agents should verify them through automated matchup tests and adjust them if the results show clear imbalance.

| Artifact | Type | Shape | Bonus | Drawback |
|---------|------|-------|--------|----------|
| `Spore Needle` | damage | `1x1` | `+2 damage` | none |
| `Amber Fang` | damage | `1x2` | `+4 damage` | `-1 armor` |
| `Glass Cap` | damage | `2x1` | `+5 damage` | `-2 armor` |
| `Bark Plate` | armor | `1x1` | `+2 armor` | none |
| `Mycelium Wrap` | armor | `2x1` | `+3 armor` | none |
| `Root Shell` | armor | `2x2` | `+5 armor` | `-1 speed` |
| `Shock Puff` | stun | `1x1` | `+8% stun chance` | none |
| `Static Spore Sac` | stun | `1x2` | `+14% stun chance` | `-1 damage` |
| `Thunder Gill` | stun | `2x1` | `+20% stun chance` | `-1 armor` |

Artifact stacking rules for v1:

- all artifact bonuses stack additively
- all artifact drawbacks stack additively
- stun chance from multiple artifacts stacks additively
- final stun chance is capped at `35%` in v1
- duplicate artifacts are not allowed in v1
- duplicate artifacts may be reconsidered only as a future backlog feature
- players have only one saved loadout in v1
- multiple saved loadouts belong in backlog

Recommended balance read:

- damage builds should feel high-risk and fast
- armor builds should feel stable but slower
- stun builds should create tempo swings without causing lockout-heavy frustration
- hybrid builds should often be the safest first-learning option

### Progression

- User account is bound to Telegram user ID after validated Mini App auth.
- Each player profile stores:
  - access to all five launch mushrooms
  - selected active mushroom
  - selected artifact loadout
  - per-character level and `mycelium` for that player
  - `spore` balance
  - battle history and replay history
  - friend graph and leaderboard position
  - internal friend code (`6` numeric digits)
- Mycelium rules:
  - win grants full `mycelium`
  - loss grants one tenth of the win `mycelium` value
- `Spore` is awarded for participation and victory.
- Levels exist in v1 as per-character mastery progression.
- There are no manual skill choices in v1.
- Level milestones do not unlock anything in v1.
- Levels are tracked and displayed only as progression state in v1.
- Character passive and active skills are fixed content in v1 and do not unlock through leveling.
- Future cosmetic rewards may be attached to level milestones after v1.
- Future skill trees and branching unlocks belong in the backlog.

#### Friend-code rules

- every player gets exactly one internal friend code
- friend codes are exactly `6` numeric digits
- codes must be unique across active player profiles
- code generation must retry on collision
- players cannot add themselves using their own code
- duplicate friendship requests must resolve idempotently
- friend removal and blocking can stay backlog unless needed for moderation

### Mini-spec: combat math and reward defaults

These defaults are recommended for v1 so implementation can start without waiting on balance-system redesign.

#### Derived combat values

- `final_damage = base_attack + artifact_damage_bonus`
- `final_armor = base_defense + artifact_armor_bonus`
- `final_speed = base_speed + artifact_speed_modifier`
- `final_stun_chance = artifact_stun_bonus`

Rules:

- artifacts are the only source of combat-stat modification in v1
- if an artifact has a drawback, apply it directly in these derived values
- passive and active skills may change action flow, but not persistent base stat growth in v1

#### Damage resolution

- raw hit damage starts from `final_damage`
- mitigated damage formula:
  - `resolved_damage = max(1, final_damage - target_final_armor)`
- damage is then subtracted from current health
- no dodge, crit, lifesteal, or resist systems in v1 unless explicitly encoded in a character skill

#### Stun resolution

- stun can only come from artifacts in v1
- stun is checked only when the attacker lands a successful active hit
- roll once per qualifying hit
- if the roll succeeds:
  - the target loses its next action
  - stun does not stack
  - a stunned target can only miss one turn at a time
- if both sides would be stunned in sequence, resolve independently from the event order

#### Initiative and turn order

- higher `final_speed` acts first
- if speeds are equal:
  - compare base character speed
  - if still equal, use deterministic battle-seed order

#### Draw and round-cap rule

- battle cap: `12` rounds
- if one character is defeated, the other side wins immediately
- if both are alive at round cap:
  - compare remaining health percentage
  - if tied, compare total damage dealt
  - if still tied, result is `draw`

#### Reward defaults

- base win reward:
  - `10 spore`
  - `100 mycelium`
- base loss reward:
  - `3 spore`
  - `10 mycelium`
- base draw reward:
  - `5 spore`
  - `40 mycelium`

Rules:

- `mycelium` goes to the currently used mushroom only
- `spore` goes to the player account
- no streaks, rarity multipliers, or placement bonuses in v1

#### Leaderboard rating formula

Recommended v1 model:

- use a simple Elo-style rating system
- every player starts at `1000 rating`
- only battles where both players actively participate should affect both sides' rating and recorded competitive stats
- leaderboard scope is global-only in v1
- no season resets or seasonal reward tracks in v1

Formula:

- `expected_score = 1 / (1 + 10 ^ ((opponent_rating - player_rating) / 400))`
- `actual_score` is:
  - win = `1`
  - draw = `0.5`
  - loss = `0`
- `new_rating = old_rating + K * (actual_score - expected_score)`

Recommended `K` values:

- first `30` rated battles: `K = 40`
- after `30` rated battles: `K = 24`
- above `1600 rating`: `K = 16`

Leaderboard sorting:

1. rating descending
2. total wins descending
3. total losses ascending
4. earliest timestamp of reaching current rating

Why this is recommended for v1:

- easy to implement
- easy to explain
- stable enough for async `1v1`
- avoids over-designing ranked systems too early

Rated-result accounting rule for v1:

- if a friend opens the challenge link while online and explicitly accepts the battle, the battle is treated as a two-sided scored match
- in a two-sided scored match:
  - both players receive the battle result in leaderboard rating
  - both players receive the result in personal battle stats
  - both players receive their own battle rewards and progression gains
- if the opponent is offline, does not accept, or is represented only by a stored snapshot, the battle is treated as one-sided for progression and ranking purposes
- in a one-sided battle:
  - only the initiating player receives leaderboard impact, if leaderboard impact is enabled for that mode
  - only the initiating player receives personal stat updates
  - only the initiating player receives `spore` and per-character `mycelium`
  - the snapshot owner receives no leaderboard change, no personal-stat change, and no rewards
- ghost matchmaking is always one-sided in v1

#### Replay sharing shapes

Recommended v1 sharing model:

- primary share target is a replay deep link
- when shared into Telegram chats, wrap that deep link in a bot summary card
- inside the Mini App, use compact replay preview cards for history and results
- friend challenges use a separate challenge-card shape, not the replay card

##### 1. Replay deep link

Use for:

- default sharing everywhere
- opening a specific replay from history, results, or shared messages

Shape:

- Mini App deep link with replay ID
- opens directly to the replay screen

Why:

- simplest implementation
- works well across app and bot contexts
- keeps replay as the canonical share target

##### 2. Bot summary card

Use for:

- sharing a replay into Telegram chats
- posting a readable summary before the receiver opens the replay

Shape:

- attacker mushroom
- defender mushroom
- result
- short battle highlight line
- `Open Replay` CTA

Why:

- readable in chat
- preserves social virality inside Telegram
- still routes to the canonical replay deep link

##### 3. In-app replay preview card

Use for:

- battle history
- profile views
- leaderboard-related replay surfaces

Shape:

- two avatars
- result badge
- `spore` and `mycelium` summary
- timestamp
- `Watch` button
- optional `Share` button

Why:

- fast to scan
- lightweight UI inside the Mini App

##### 4. Friend challenge card

Use for:

- direct challenge flow between friends

Shape:

- challenger identity
- selected mushroom
- challenge CTA

Why:

- different intent from replay sharing
- cleaner mental model than reusing replay UI for challenges

Do not build in v1:

- image-only share cards
- GIF or video replay exports
- public replay pages outside Telegram
- many alternate share templates

#### Battle seed policy

Recommended v1 model:

- every battle gets one `battle_seed`
- the backend generates the seed at battle creation time
- the seed is stored with the battle record
- the client never generates or modifies the seed

Generation rule:

- use a cryptographically strong random `64-bit` or `128-bit` backend-generated value
- store it in a bigint-safe or string-safe format
- once created, never mutate it

Usage rule:

- all simulation randomness must derive only from:
  - `battle_seed`
  - deterministic event order
  - stable combatant ordering where needed
- use one deterministic RNG stream per battle
- consume RNG in a fixed order
- all stochastic checks such as stun rolls must consume from that same ordered stream

Replay rule:

- client replays stored battle events, not seed-based re-simulation
- the seed exists for simulation determinism, fixture reproduction, debugging, and auditability
- old replays must remain valid even if future battle logic changes

Testing and debug rule:

- fixture tests must be able to inject a known seed explicitly
- admin or debug tooling may expose the stored seed
- normal player-facing UI does not need to display it

#### Daily battle-limit rule

- each player may start up to `10` battles per UTC day
- the limit applies to:
  - ghost battles
  - friend battles
- completed and failed battle creations both count only after a battle record is successfully created
- when the user is capped, the UI must show:
  - current daily usage
  - next reset time
  - disabled `Start Battle` CTA

### Mini-spec: launch mushroom roster

These five mushrooms form the entire v1 playable roster. All five are available from the start.
These five mushrooms are the final canon launch picks for v1, not placeholders pending later lore alignment.

Stat scale for v1:

- health is tuned around `80-130`
- attack is tuned around `8-16`
- speed is tuned around `4-10`
- defense is tuned around `0-6`

#### 1. Thalla

- style tag: `control`
- base stats:
  - health: `100`
  - attack: `11`
  - speed: `7`
  - defense: `2`
- passive: `Spore Echo`
  - when Thalla successfully stuns an enemy, her next attack gains `+2` damage
- active skill: `Spore Lash`
  - deal normal attack damage and gain `+5%` additive stun chance for this attack only
- intended play pattern:
  - medium-speed control fighter
  - strongest with stun-focused or hybrid stun-damage builds
- recommended artifact affinities:
  - strong: stun chance
  - medium: damage
  - weak: pure armor

#### 2. Lomie

- style tag: `defensive`
- base stats:
  - health: `125`
  - attack: `9`
  - speed: `4`
  - defense: `5`
- passive: `Soft Wall`
  - the first hit Lomie receives each battle is reduced by an additional `3` damage after armor
- active skill: `Settling Guard`
  - gain `+2` temporary armor for the next incoming hit
- intended play pattern:
  - slow defensive anchor
  - strongest with armor-heavy builds and selective stun support
- recommended artifact affinities:
  - strong: armor
  - medium: stun chance
  - weak: glass-cannon damage

#### 3. Axilin

- style tag: `aggressive`
- base stats:
  - health: `90`
  - attack: `15`
  - speed: `8`
  - defense: `1`
- passive: `Volatile Brew`
  - every third successful hit deals `+3` bonus damage
- active skill: `Ferment Burst`
  - attack with `+2` bonus damage, then lose `1` defense for the rest of the battle
- intended play pattern:
  - explosive offense with fragile defenses
  - strongest with damage artifacts, acceptable with stun splash
- recommended artifact affinities:
  - strong: damage
  - medium: stun chance
  - weak: heavy armor stacking

#### 4. Kirt

- style tag: `balanced`
- base stats:
  - health: `105`
  - attack: `12`
  - speed: `6`
  - defense: `3`
- passive: `Measured Rhythm`
  - if Kirt was not stunned on the previous enemy turn, gain `+1` speed on his next action, up to once per round
- active skill: `Clean Strike`
  - deal damage that ignores `2` points of enemy armor
- intended play pattern:
  - stable all-rounder
  - strongest with mixed damage and armor setups
- recommended artifact affinities:
  - strong: mixed damage + armor
  - medium: stun chance
  - weak: none

#### 5. Morga

- style tag: `aggressive`
- base stats:
  - health: `85`
  - attack: `13`
  - speed: `10`
  - defense: `0`
- passive: `First Bloom`
  - Morga's first action each battle gains `+4` bonus damage
- active skill: `Flash Cap`
  - strike first if speeds are tied this round and gain `+10%` stun chance for this attack
- intended play pattern:
  - speed-first burst attacker
  - strongest with damage builds and stun pressure
- recommended artifact affinities:
  - strong: damage
  - strong: stun chance
  - weak: armor

#### Roster balance goals

- `Thalla` teaches control builds
- `Lomie` teaches armor and survival
- `Axilin` teaches all-in damage
- `Kirt` teaches balanced setups
- `Morga` teaches speed and opening pressure

#### v1 roster rules

- all mushroom base stats are fixed in content data
- artifact loadout is the only player-controlled way to modify combat attributes
- per-character `mycelium` progression tracks mastery and unlock pacing, not raw stat inflation in v1
- if roster balance drifts, tune base stats and artifact values first before adding new systems
- use automated matchup tests before making balance changes, and prefer the smallest targeted numeric adjustment that fixes the issue

### Meta structure

- `Character`
  - choose and inspect the active mushroom
- `Artifacts`
  - choose and save the artifact container
- `Battle`
  - start async PvP or friends battles
- `Progress`
  - inspect per-character `mycelium` and battle performance
- `Social`
  - friends, replays, leaderboard
- `Wiki`
  - browse canon lore, locations, and mechanics

### Battle presentation style

- Combat should feel readable and dramatic, not like a spreadsheet.
- Each action line should read like compact battle narration.
- Avatar cards should animate for:
  - acting
  - being hit
  - critical hit
  - shield or armor emphasis
  - stun impact
  - defeat
- Artifact triggers should have their own simple visual feedback.
- Highlighting should sync to the log.
- Speed controls should include:
  - `1x`
  - `2x`
  - `Skip to result`

### Rendering recommendation

- SVG-first rendering is a good idea for v1.
- It keeps assets light inside Telegram, supports easy recolors and glow effects, and makes simple animation cheaper to implement.
- Recommended v1 effects:
  - border glow on acting character
  - impact flash on hit
  - small explosion or spark over the artifact strip when an artifact triggers
  - grayscale or dim treatment on defeat
- Avoid heavy skeletal animation in v1.

### Tie handling

Recommended v1 rule:

- hard round cap such as 12 rounds
- if both mushrooms are still alive at the cap:
  - compare remaining health percentage
  - higher percentage wins
  - if equal, compare total dealt damage
  - if still equal, declare a draw

Why this works:

- easy to explain
- deterministic
- prevents endless stall battles

### Synergy ideas without a full trait system

Since the game is `1v1`, multi-unit trait synergy is not needed in v1. Better alternatives:

- `Style tags`
  - each mushroom is aggressive, defensive, or control-focused
  - used for recommendations and AI tuning
- `Artifact affinity`
  - some mushrooms slightly overperform with certain artifact classes
- `Arena modifiers`
  - some battle environments slightly favor armor, damage, or stun builds

Recommended v1:

- use style tags
- optionally add light artifact affinity
- keep full synergy systems in backlog

## Telegram Bot and Web App Flow

### Entry flow

Recommended implementation:

1. User mentions `@BotUsername` in a supported chat.
2. Bot detects the mention and replies with:
  - a short message
  - a `Play` CTA
  - a direct Mini App link with `startapp=entry_group`
3. If the user has not started the bot privately yet, the bot also includes a `Start in DM` fallback link.
4. Mini App opens and reads the `start_param`.
5. Backend validates `initData`.
6. Backend creates or resumes the player profile.
7. Mini App routes the user to:
  - onboarding if new
  - home or character screen if existing

### Important Telegram constraints

- Group mention should be treated as the discovery trigger, not as the full game runtime surface.
- The actual long-lived game UI should run in the Mini App opened from a direct link or the bot's main Mini App.
- Mention-based discovery depends on the bot actually receiving the mention event in that chat, so group privacy-mode behavior and bot permissions must be validated during implementation.
- If the app is opened outside Telegram and signed `initData` is missing, the browser flow should fall back to a one-time bot handoff instead of silently failing auth.
- The bot should also expose:
  - `/play`
  - `/wiki`
  - `/character`
  - `/battle`
  - a menu button that opens the Mini App

### Bot responsibilities

- handle mentions and commands
- generate deep links with `startapp` context
- support replay sharing
- expose leaderboard and friend-challenge shortcuts
- communicate battle-start rate limits clearly
- support friend add flow through internal friend codes

## Frontend Plan

### Frontend architecture

Recommended stack:

- Vue + JavaScript single-page app
- Telegram Mini App SDK or direct `window.Telegram.WebApp` integration
- lightweight animation using CSS transforms and SVG effects
- a lightweight fetch/state layer appropriate for Vue
- small global store for battle playback state and session UI
- responsive layout tuned for Telegram mobile first
- light pastel mushroom theme by default

### Main screens

#### 1. Launch / Auth Gate

Purpose:

- bootstrap Telegram context
- validate Mini App session
- preload profile and static game data

UI:

- splash art
- loading state
- auth failure / retry state

Backend calls:

- `POST /api/auth/telegram`
- `GET /api/bootstrap`

#### 2. First-Time Onboarding

Purpose:

- explain the game briefly
- explain the 1v1 artifact-based loop
- guide the user into first character selection

UI:

- welcome card
- concise explanation of character + artifact flow
- launch roster preview
- continue CTA

#### 3. Home Hub

Purpose:

- central navigation into battle, character, artifacts, social, progress, and wiki

UI:

- player summary
- active mushroom preview
- artifact loadout preview
- battle-limit usage display
- reward notice
- primary CTAs:
  - `Battle`
  - `Character`
  - `Artifacts`
  - `Social`
  - `Wiki`
  - `Progress`

#### 4. Character Selection

Purpose:

- choose and save the active mushroom

UI:

- selected character spotlight
- five-mushroom roster grid
- stats summary
- lore teaser
- style-tag panel
- save button

#### 5. Artifact Loadout Builder

Purpose:

- choose and save the artifact container
- preview strategic tradeoffs

UI:

- container slots
- artifact library grouped by effect type
- selected artifacts summary
- quick compare panel
- save button

Key interactions:

- drag and drop artifacts into the `4x4` grid
- tap an artifact, then tap target cells to place it
- tap placed artifact to remove it
- invalid placements must be blocked immediately

#### 6. Mushroom Detail

Purpose:

- show one mushroom in depth

UI:

- avatar
- lore snippet
- stats
- passive
- active skill
- progression summary
- recommended artifact pairings

#### 7. Character Progress Screen

Purpose:

- show per-character progression state

UI:

- current level
- `mycelium` bar
- battle record for that character
- milestone track

#### 8. Battle Preparation

Purpose:

- confirm mode and loadout before battle

UI:

- selected mode card
- selected mushroom summary
- artifact container summary
- enemy preview for ghost battle or friend battle
- expected reward summary in `spore` and `mycelium`
- daily battle count display
- `Start Battle` CTA

#### 9. Matchmaking / Battle Loading

Purpose:

- create async battle or fetch replay payload

UI:

- loading animation
- lore or mechanic tips
- retry state

#### 10. Battle Replay Screen

Purpose:

- play the fight as the main spectacle surface

UI:

- left and right avatar lanes
- HP bars
- artifact strips
- central action log
- active turn highlight
- speed controls
- pause / resume
- result overlay

Important UX behavior:

- autoplay with synchronized log
- after fight completes, replay review should work by scrolling the battle log like a chat rather than using a timeline scrubber
- as the user scrolls through the log, the visual battle state should update to the corresponding event block
- reduced-motion mode

#### 11. Battle Results Screen

Purpose:

- summarize outcome and rewards

UI:

- victory / defeat / draw banner
- `spore` gained
- `mycelium` gained
- per-character `mycelium` bar
- leaderboard movement
- next actions:
  - `Fight Again`
  - `Change Artifacts`
  - `Share Replay`
  - `Open Wiki`

#### 12. Battle History / Replays

Purpose:

- revisit previous fights

UI:

- replay list
- filters by result and mode
- replay CTA

#### 13. Friends

Purpose:

- support friend graph and direct challenges

UI:

- friend list
- add friend by internal friend code
- recent activity
- challenge CTA

#### 14. Leaderboard

Purpose:

- show competitive ranking

UI:

- global leaderboard
- player placement card
- top-used mushroom snapshot

#### 15. Wiki Home

Purpose:

- hub for canon lore and mechanics

UI:

- featured characters
- featured world locations
- mechanics glossary
- search

#### 16. Wiki Character Page

Purpose:

- show lore plus gameplay data for a mushroom

UI:

- avatar
- lore section
- stat summary
- passive and active skill
- related locations or factions

#### 17. Wiki Faction / Location Page

Purpose:

- connect current archive lore to game world structure

UI:

- narrative overview
- linked mushrooms
- notable mechanics or themes

#### 18. Profile / Progress Screen

Purpose:

- show player progression and social identity

UI:

- player summary
- selected mushroom summary
- per-character progression overview
- achievements or milestones

V1 note:

- do not show season record or seasonal progression in v1

#### 19. Inbox / Notifications

Purpose:

- show completed battles, share events, and social alerts

UI:

- grouped notification cards
- claim or open CTA where relevant

V1 status:

- backlog only
- do not implement inbox or notification delivery in v1

#### 20. Settings

Purpose:

- configure UX preferences

UI:

- battle speed default
- reduced motion
- sound toggle
- language toggle RU / EN
- support / feedback link

#### 21. Local AI Test Lab

Purpose:

- support local testing of battle-description quality using OpenAI API combinations

UI:

- battle fixture selector
- prompt variant selector
- model selector
- run button
- side-by-side results table
- latency / token / cost summary
- export or copy result actions

Scope:

- disabled in production builds for v1
- enabled only in local development builds for v1

### Frontend implementation slices

#### App shell and Telegram integration

- initialize Telegram Web App SDK
- call `expand()` early for height usage
- map theme params into CSS variables while preserving the product's light pastel direction
- read and route from `start_param`
- expose Russian-first UI with a visible English toggle

#### Data fetching and caching

- bootstrap payload should return:
  - user profile
  - selected active mushroom
  - selected artifact loadout
  - five launch mushrooms
  - pending rewards
  - wiki navigation summary
- use optimistic UI only for character save, artifact save, and settings

#### Battle replay engine

- backend returns a deterministic battle event list
- frontend derives animation state from that event list
- event schema should support:
  - frame order
  - actor and target IDs
  - action kind
  - numeric deltas
  - artifact trigger events
  - narration text
- replay renderer should stay isolated from wiki and profile surfaces

#### Wiki presentation

- reuse current lore assets where possible
- separate authored lore content from gameplay metadata
- render canon portraits, short lore, related entities, and game stats together

## Backend Plan

### Backend architecture

Recommended stack:

- extend the existing Node.js codebase with a dedicated game service layer
- expose HTTP APIs for the Mini App
- keep Telegram bot handlers and game APIs in the same repo initially
- use PostgreSQL for player state and battle state
- add Redis or a queue only if async volume requires it

### Core backend modules

#### 1. Telegram bot gateway

Responsibilities:

- process mentions and commands
- issue launch links
- send private follow-up messages
- support replay-share messages

#### 2. Telegram auth module

Responsibilities:

- validate Telegram `initData` when present
- handle Telegram browser fallback through one-time auth-code linking when `initData` is absent
- create or resume the same app session format regardless of auth entry path
- map Telegram user ID to player profile

Required auth model:

- v1 primary auth is Telegram-based
- all successful auth entry patterns must end in the same session model for protected API access
- protected APIs should accept the shared session token through `X-Session-Key` or `Authorization: Bearer ...`
- auth provider choice must not change downstream authorization or request handling
- if future providers are added, they must create the same app session shape rather than introducing provider-specific protected-route behavior

Implementation example: shared auth middleware

```js
async function authMiddleware(req, res, next) {
  const sessionKey =
    req.header('x-session-key') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (!sessionKey) return next();

  const session = await Session.findOne({
    where: { sessionKey },
    include: ['user']
  });

  if (!session || session.expiresAt < new Date()) return next();

  req.user = session.user;
  req.session = session;
  req.authenticated = true;
  next();
}
```

Implementation example: session response contract

```json
{
  "success": true,
  "data": {
    "sessionKey": "sess_abc123",
    "user": {
      "id": "player_42",
      "telegramId": "123456789",
      "telegramUsername": "mushroom_user",
      "name": "Mushroom User",
      "lang": "ru"
    }
  }
}
```

#### 3. Player profile service

Responsibilities:

- account creation
- settings
- social identity
- progression summary

#### 4. Character and artifact loadout service

Responsibilities:

- expose the five launch mushrooms
- validate active character selection
- validate artifact loadout composition
- save active character
- save artifact container

#### 5. Battle orchestration service

Responsibilities:

- accept battle start requests
- snapshot both sides
- run deterministic combat simulation
- persist battle events and result
- award `mycelium` and `spore`
- enforce battle-start rate limits

#### 6. Matchmaking service

Responsibilities:

- async PvP ghost selection
- friend challenge routing
- accepted live-friend battle creation
- future ranked pairing

#### 7. Progression service

Responsibilities:

- per-character `mycelium` gain
- level thresholds
- milestone unlock tracking
- reward bookkeeping

#### 8. Wiki content service

Responsibilities:

- expose character, faction, location, and glossary content
- build and read structured wiki markdown folders from the repo's existing markdown lore sources
- merge adapted lore markdown with gameplay metadata
- resolve admin authorization from configured Telegram usernames

#### 9. Social and leaderboard service

Responsibilities:

- friendships
- challenge records
- leaderboard ranking and snapshots
- replay sharing metadata
- friend-code generation and resolution

#### 10. AI battle-description test service

Responsibilities:

- run local prompt/test combinations against OpenAI APIs
- store structured comparison results
- support fixture-based narration experiments
- stay separate from production battle resolution
- stay disabled in production builds for v1

### API surface

Recommended initial endpoints:

- `POST /api/auth/telegram`
- `POST /api/auth/telegram/code`
- `POST /api/auth/telegram/verify-code`
- `GET /api/bootstrap`
- `GET /api/profile`
- `GET /api/characters`
- `PUT /api/active-character`
- `GET /api/artifacts`
- `PUT /api/artifact-loadout`
- `GET /api/mushrooms/:id`
- `POST /api/battles`
- `GET /api/battles/:id`
- `GET /api/battles/history`
- `GET /api/friends`
- `POST /api/friends/add-by-code`
- `POST /api/friends/challenges`
- `POST /api/friends/challenges/:id/accept`
- `POST /api/friends/challenges/:id/decline`
- `GET /api/friends/challenges/:id`
- `GET /api/leaderboard`
- `GET /api/wiki/home`
- `GET /api/wiki/characters/:slug`
- `GET /api/wiki/locations/:slug`
- `GET /api/wiki/factions/:slug`
- `POST /api/settings`
- `POST /api/local-tests/battle-narration`

Endpoint examples:

```http
POST /api/auth/telegram
Content-Type: application/json

{
  "initData": "<telegram initData string>"
}
```

```http
POST /api/auth/telegram/code
```

```json
{
  "success": true,
  "data": {
    "privateCode": "4d8f6d6f-7e41-4a5d-a7ce-5f0f4d8af111",
    "publicCode": "9f21ab44",
    "botUsername": "mushroom_game_bot",
    "expiresInSeconds": 600
  }
}
```

```http
POST /api/auth/telegram/verify-code
Content-Type: application/json

{
  "privateCode": "4d8f6d6f-7e41-4a5d-a7ce-5f0f4d8af111"
}
```

### Data model

Recommended core tables:

- `players`
- `player_settings`
- `sessions`
- `mushrooms`
- `artifacts`
- `mushroom_skills`
- `player_mushrooms`
- `player_active_character`
- `player_artifact_loadouts`
- `player_artifact_loadout_items`
- `friendships`
- `friend_codes`
- `battle_requests`
- `battles`
- `battle_snapshots`
- `battle_events`
- `battle_rewards`
- `wiki_entry_index`
- `daily_rate_limits`
- `leaderboard_snapshots`
- `local_test_runs`

Table intent notes:

- `sessions` is the shared authenticated app-session store used by every login provider or entry pattern.
- `player_artifact_loadouts` stores the saved container-level build record for a player.
- `player_artifact_loadout_items` stores the artifact placements that make up that saved build.
- `battle_snapshots` stores the server-authored immutable combat snapshot for each side at battle creation time so old replays remain reproducible even if player loadouts later change.
- `wiki_entry_index` stores only derived lookup metadata or cached render data if needed; canonical wiki content still lives in structured markdown files in the repo.
- if repo-file reads are fast enough, `wiki_entry_index` can be omitted entirely in the first implementation.

Artifact-loadout storage model:

- store the build as artifact placements, not as 16 persisted grid cells
- treat artifact placements as the canonical saved loadout state
- derive occupancy, validation, and stat totals from those placements plus canonical artifact definitions
- do not treat computed combat totals as the source of truth in the database

Recommended relational shape:

- `player_artifact_loadouts`
  - `id`
  - `player_id`
  - `mushroom_id`
  - `grid_width`
  - `grid_height`
  - `is_active`
  - `created_at`
  - `updated_at`
- `player_artifact_loadout_items`
  - `id`
  - `loadout_id`
  - `artifact_id`
  - `x`
  - `y`
  - `width`
  - `height`
  - `sort_order`

Validation rules for saved loadouts:

- exactly `3` artifacts must be stored for a valid v1 loadout
- duplicate artifacts are not allowed
- all placements must remain within the `4x4` grid bounds
- placements must not overlap
- stored `width` and `height` must match the canonical artifact definition used by the game data

Persistence example:

```json
{
  "loadout": {
    "playerId": "player_42",
    "mushroomId": "thalla",
    "gridWidth": 4,
    "gridHeight": 4,
    "isActive": true
  },
  "items": [
    { "artifactId": "spore_needle", "x": 0, "y": 0, "width": 1, "height": 1 },
    { "artifactId": "root_shell", "x": 1, "y": 0, "width": 2, "height": 2 },
    { "artifactId": "shock_puff", "x": 3, "y": 1, "width": 1, "height": 1 }
  ]
}
```

Implementation note:

- compute total damage, armor, speed, and stun modifiers from canonical artifact data at battle snapshot time
- if cached totals are added later for convenience, they must remain derived data rather than the canonical saved build

Auth-code storage notes:

- browser Telegram fallback needs a short-lived auth-code store with:
  - `private_code`
  - `public_code`
  - provider
  - expiration time
  - linked user ID
  - used timestamp or flag
- `private_code` stays in the browser polling flow
- `public_code` is the value sent through the Telegram bot deep link
- code verification must be one-time-use and expire automatically

Implementation example: auth-code row

```json
{
  "provider": "telegram",
  "privateCode": "4d8f6d6f-7e41-4a5d-a7ce-5f0f4d8af111",
  "publicCode": "9f21ab44",
  "userId": null,
  "used": false,
  "expiresAt": "2026-03-30T12:10:00.000Z"
}
```

### Battle engine design

Recommended principles:

- deterministic server-side simulation
- no battle authority in the client
- store event logs as the source of truth for replays
- separate battle text generation from mechanical resolution
- support artifact-trigger logic as a first-class mechanic

Suggested simulation stages:

1. Snapshot both loadouts.
2. Apply artifact-derived stat and trigger modifiers.
3. Roll initiative.
4. Execute round loop.
5. Resolve passive triggers and stun outcomes.
6. Resolve death and end-of-round effects.
7. Stop on win, draw, or round cap.
8. Persist event log and rewards.

Required battle-creation safety rules:

- battle creation must snapshot the initiating player's selected mushroom and artifact loadout before simulation begins
- v1 ghost matchmaking should choose an opponent snapshot randomly rather than using rating-aware or social-aware selection
- ghost matchmaking must snapshot the opponent state used for the battle so later player changes do not rewrite old match inputs
- friend challenges should not become two-sided scored matches unless the invited friend explicitly opens the link and accepts
- reward persistence and daily-limit counting should happen in one transaction or equivalent atomic unit
- battle-start requests should support an idempotency key so client retries do not create duplicate battles or double rewards

V1 ghost-matchmaking rule:

- select uniformly from an eligible pool of stored player snapshots
- exclude the requesting player's own snapshot
- if the eligible pool is too small, allow repeated opponents rather than blocking battle creation
- keep weighted matchmaking, rating bands, and social-priority matching in backlog

V1 friend-challenge rule:

- challenger creates a challenge link tied to the challenger's current selected mushroom and artifact loadout snapshot
- if the invited friend opens the link while online, the app should show an accept screen before battle creation
- only after acceptance should the backend create a two-sided scored battle using both players' current accepted snapshots
- if the invited friend never accepts, the challenge may expire or remain pending based on product choice, but it must not silently score the invited friend
- if the initiator instead fights an offline opponent snapshot, treat it as a one-sided battle

### Wiki pipeline

Recommended reuse of current repo assets:

- character manifests
- curated lore exports
- generated lore artifacts as evidence, not as direct public-editing surfaces
- existing markdown lore sources as the raw material for structured wiki folders
- structured markdown files as the final wiki-page source

Required separation:

- authored wiki entries
- generated lore evidence
- gameplay stats and balance metadata

All wiki content is canon, and write access should be admin-only.
Recommended admin auth model:

- store allowed Telegram usernames in config
- when a Mini App session is authenticated, compare the Telegram username from validated user data against the allowlist
- only allow admin-controlled wiki source updates in the repo workflow when the username is present in that config
- keep this simple in v1; broader role systems belong in backlog

Recommended wiki content workflow:

- start from the existing repo markdown lore sources
- convert or reorganize those sources into structured wiki folders such as character, faction, location, and glossary content
- adjust and normalize the markdown so it reads well as wiki pages rather than raw archive notes
- admins edit canon wiki source content in the repo
- the app reads those structured markdown files from the repo and renders them as wiki pages
- do not build a direct in-app wiki editor for v1
- do not require a separate in-app publish step for v1 unless caching later demands it
- if admin tooling is added later, treat it as repo-workflow assistance or validation, not as a second canonical wiki-edit surface

Recommended v1 wiki folder shape:

- `wiki/characters/<slug>/page.md`
- `wiki/factions/<slug>/page.md`
- `wiki/locations/<slug>/page.md`
- `wiki/glossary/<slug>/page.md`
- optional co-located metadata files only if needed for navigation, ordering, or related-entry linking

### Shared session and authz layer

Recommended contract:

- regardless of whether the user authenticated through Telegram Mini App `initData` or the Telegram browser fallback, the backend should create the same session record shape
- authenticated frontend code should store and reuse one session token format
- auth middleware should populate the same `req.user` / authenticated-request context for all providers
- protected route code should not need to know which login provider created the session

Non-goal for v1:

- automatic account merging across different identity providers is not required
- if future providers such as Google OAuth are added, explicit account linking should be designed separately rather than merging users implicitly

Implementation example: Telegram Mini App auth

Frontend:

```js
async function loginWithTelegramWebApp() {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) throw new Error('Missing Telegram initData');

  const res = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Telegram auth failed');

  localStorage.setItem('sessionKey', json.data.sessionKey);
  return json.data;
}
```

Backend:

```js
import crypto from 'crypto';

function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculated = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  return calculated === hash;
}

app.post('/api/auth/telegram', async (req, res) => {
  const { initData } = req.body;

  if (!verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid Telegram signature'
    });
  }

  const params = new URLSearchParams(initData);
  const tgUser = JSON.parse(decodeURIComponent(params.get('user')));

  const user = await upsertUserByTelegramId({
    telegramId: String(tgUser.id),
    telegramUsername: tgUser.username || null,
    name:
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
      `Telegram User ${tgUser.id}`,
    lang: tgUser.language_code?.startsWith('ru') ? 'ru' : 'en'
  });

  const session = await createSession(user.id, req);

  res.json({
    success: true,
    data: { sessionKey: session.sessionKey, user }
  });
});
```

Implementation example: Telegram browser fallback

Frontend:

```js
async function startTelegramBotFallback() {
  const createRes = await fetch('/api/auth/telegram/code', { method: 'POST' });
  const createJson = await createRes.json();

  if (!createJson.success) {
    throw new Error(createJson.error || 'Could not create Telegram auth code');
  }

  const { privateCode, publicCode, botUsername } = createJson.data;
  const botUrl = `https://t.me/${botUsername}?start=auth-${publicCode}`;
  window.open(botUrl, '_blank');

  const startedAt = Date.now();

  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const verifyRes = await fetch('/api/auth/telegram/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privateCode })
    });

    const verifyJson = await verifyRes.json();

    if (verifyJson.success && verifyJson.data?.sessionKey) {
      localStorage.setItem('sessionKey', verifyJson.data.sessionKey);
      return verifyJson.data;
    }

    if (!verifyJson.success && verifyJson.needsBotAuth === false) {
      throw new Error(verifyJson.error || 'Telegram auth failed');
    }
  }

  throw new Error('Telegram auth timed out');
}
```

Bot handler:

```js
bot.onText(/\/start auth-([a-z0-9]+)/i, async (msg, match) => {
  const publicCode = match[1];

  const authCode = await AuthCode.findOne({
    where: {
      publicCode,
      provider: 'telegram',
      used: false
    }
  });

  if (!authCode || authCode.expiresAt < new Date()) return;

  const telegramId = String(msg.from.id);

  const user = await upsertUserByTelegramId({
    telegramId,
    telegramUsername: msg.from.username || null,
    name: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '),
    lang: msg.from.language_code?.startsWith('ru') ? 'ru' : 'en'
  });

  authCode.userId = user.id;
  await authCode.save();

  await bot.sendMessage(
    msg.chat.id,
    'Authentication confirmed. Return to the site.'
  );
});
```

Verification endpoint shape:

```js
app.post('/api/auth/telegram/verify-code', async (req, res) => {
  const { privateCode } = req.body;

  const authCode = await AuthCode.findOne({
    where: { privateCode, provider: 'telegram' }
  });

  if (!authCode || authCode.expiresAt < new Date() || authCode.used) {
    return res.status(400).json({
      success: false,
      needsBotAuth: false,
      error: 'Code expired or invalid'
    });
  }

  if (!authCode.userId) {
    return res.json({
      success: false,
      needsBotAuth: true
    });
  }

  const session = await createSession(authCode.userId, req);
  authCode.used = true;
  await authCode.save();

  res.json({
    success: true,
    data: { sessionKey: session.sessionKey }
  });
});
```

## Delivery Phases

### Phase 1: Foundations

- add Telegram game bot entry flow
- add Mini App shell
- implement Telegram auth validation
- implement Telegram browser fallback auth through bot-code handoff
- create player profile, active-character, and artifact-loadout persistence
- ship read-only wiki browsing from existing lore content
- ship Russian-first text with English toggle
- ship the five launch mushrooms

Phase 1 ownership:

- backend platform agent owns auth, bootstrap, persistence schema
- frontend shell agent owns app bootstrap, auth gate, app shell, language toggle

Phase 1 completion condition:

- Telegram-authenticated user can open the Mini App and receive a valid bootstrap payload
- browser-opened user without Telegram `initData` can complete bot-code fallback and receive the same session format
- app shell renders with no placeholder-only flows
- five launch mushrooms and artifact definitions are returned from backend data sources

### Phase 1 validation gate

- validate Telegram `initData` flow end to end
- validate browser fallback auth-code flow end to end
- validate bootstrap API shape
- validate RU / EN toggle persistence
- validate DB schema creation and reads

### Phase 2: First playable loop

- implement deterministic battle engine
- implement artifact loadout selection
- implement async PvP ghost battles
- implement battle replay screen
- implement `spore` and per-character `mycelium` progression
- implement battle results
- implement daily battle rate limit of 10 starts per player
- implement leaderboard basics

Phase 2 ownership:

- combat backend agent owns battle engine, reward logic, rate limit, replay event schema
- frontend setup agent owns character selection, artifact grid, battle prep, result surface

Phase 2 completion condition:

- user can select a mushroom, place exactly 3 artifacts in the `4x4` grid, save the loadout, and start a valid battle
- backend resolves battles deterministically from fixture inputs
- result rewards persist correctly

### Phase 2 validation gate

- validate artifact placement rules
- validate no-overlap and no-rotation rules
- validate deterministic battle fixture outputs
- validate reward formulas for win, loss, and draw
- validate daily rate-limit enforcement

### Phase 3: Social loop

- add friends list and friend challenges
- add battle history and replay list
- add replay sharing
- improve leaderboard logic
- ship Local AI Test Lab for narration experiments
  - local builds only, disabled in production

Phase 3 ownership:

- social backend agent owns friends, challenge records, leaderboard services
- frontend social agent owns friends, leaderboard, battle history, replay share UI
- validation/tooling agent owns Local AI Test Lab wiring and fixture-driven comparison flows

Phase 3 completion condition:

- user can add a friend by internal friend code, issue a challenge, have the invited friend accept it from the link, replay the resulting battle, and view leaderboard placement

### Phase 3 validation gate

- validate friend challenge creation
- validate accept-from-link flow for online invited friend
- validate that accepted friend battles score both players
- validate that ghost and offline-opponent battles do not score the opponent
- validate replay retrieval by ID
- validate leaderboard ordering and placement card
- validate share-link behavior

### Phase 4: Live operations

- add admin wiki workflow support if needed
- add balance tools
- add moderation and player-support tools
- add optional seasonal progression in a future phase
- add economy tuning

Phase 4 ownership:

- admin tooling agent owns admin-only routes and pages
- content operations agent owns wiki publish flow and moderation support flows

Phase 4 completion condition:

- admins can update canon wiki source markdown in the repo and the app renders those structured markdown pages correctly
- support tooling exists for inspecting battle outcomes and player issues

### Phase 4 validation gate

- validate admin-only access control
- validate wiki source/read separation
- validate that wiki pages are rendered from structured repo markdown
- validate audit visibility for key support actions

## Sub-agent Delegation Plan

Use sub-agents only when implementation is active and only with disjoint write scopes.

### Agent A: Backend platform

- may read:
  - repo-wide backend files
  - config and data model docs
- may write:
  - backend service files
  - schema or migration files
  - config updates needed for server APIs
- must not edit:
  - frontend UI files
  - product-plan markdown except when explicitly assigned
- exact completion condition:
  - auth, bootstrap, persistence, and base API contracts are implemented and validated

### Agent B: Combat backend

- may read:
  - backend platform code
  - combat spec sections in this document
- may write:
  - battle engine modules
  - reward logic
  - event-log schema
  - rate-limit logic
- must not edit:
  - frontend replay UI
  - social modules not needed by battle creation
- exact completion condition:
  - deterministic battle simulation passes fixture validation and persists replay events

### Agent C: Frontend shell and setup

- may read:
  - frontend app shell
  - API contracts
  - design guidance
- may write:
  - auth gate
  - home hub
  - character selection
  - artifact loadout builder
  - settings and language toggle
- must not edit:
  - battle engine backend
  - backend auth logic
- exact completion condition:
  - user can enter the app, choose character, configure artifacts, and save setup

### Agent D: Frontend replay, social, and wiki

- may read:
  - battle event schema
  - frontend navigation and shared components
- may write:
  - battle replay UI
  - results UI
  - friends UI
  - leaderboard UI
  - wiki surfaces
- must not edit:
  - battle engine formulas
  - persistence schema
- exact completion condition:
  - replay, social, and wiki screens render against real backend data

### Agent E: Validation and local AI test tooling

- may read:
  - battle fixtures
  - API contracts
  - OpenAI-related local tooling
- may write:
  - tests
  - fixtures
  - Local AI Test Lab page and local-only API wiring
- must not edit:
  - production battle logic except where required to expose stable test hooks
- exact completion condition:
  - core phases have executable validation and local narration-comparison tooling

## Validation Gates

Validate after each meaningful stage, not only at the end.

UI review rule:

- all key screens must be covered by Playwright screenshot tests
- screenshot artifacts must be inspectable by an agent after the test run
- agents should review those screenshots and fix visible UI/UX issues before reporting the phase complete

### Gate 1: platform ready

- Telegram auth succeeds
- bootstrap returns five mushrooms, artifacts, and player state
- RU / EN toggle works
- screenshot coverage exists for launch/auth and home-entry states

### Gate 2: setup ready

- active mushroom persists
- exactly 3 artifacts can be placed and saved
- invalid placements are blocked
- screenshot coverage exists for character selection and artifact loadout builder

### Gate 3: battle ready

- deterministic fixtures produce stable event logs
- rewards and `mycelium` rules match spec
- daily battle cap works
- screenshot coverage exists for battle prep, replay, and results states

### Gate 4: replay ready

- replay UI reflects stored event logs
- damage, stun, and result states display correctly
- reduced-motion mode still works

### Gate 5: social and wiki ready

- friend-code add flow works
- friend challenge flow works
- leaderboard renders correctly
- wiki pages read published canon data
- admin wiki-write access respects the configured Telegram-username allowlist
- screenshot coverage exists for friends, leaderboard, wiki home, and wiki detail pages

### Gate 6: local test tooling ready

- Local AI Test Lab runs prompt comparisons
- results stay isolated from production battle data
- cost and latency display correctly
- production builds do not expose the Local AI Test Lab

## Validation and Testing Plan

### Frontend tests

- Telegram auth bootstrap flow
- first-time onboarding routing
- active character save and restore
- artifact loadout save and restore
- battle replay playback correctness from fixture event logs
- reduced-motion battle rendering
- wiki navigation and search
- RU / EN toggle behavior
- leaderboard and friend challenge UI states
- Local AI Test Lab result rendering
- Playwright screenshot tests for all key screens

Required screenshot-covered screens:

- Launch / Auth Gate
- First-Time Onboarding
- Home Hub
- Character Selection
- Artifact Loadout Builder
- Mushroom Detail
- Character Progress Screen
- Battle Preparation
- Battle Replay Screen
- Battle Results Screen
- Battle History / Replays
- Friends
- Leaderboard
- Wiki Home
- Wiki Character Page
- Wiki Faction / Location Page
- Profile / Progress Screen
- Settings
- Local AI Test Lab

Screenshot review instructions:

- run Playwright screenshot tests after meaningful UI changes
- inspect screenshot output as part of agent review
- if screenshots show spacing, hierarchy, clipping, overflow, contrast, responsiveness, or state-communication problems, fix those before reporting completion
- keep screenshot baselines or captured artifacts organized by screen and state so later agents can compare regressions quickly

### Backend tests

- `initData` validation
- Telegram bot-code auth creation, link, expiry, and one-time-use behavior
- player creation and session resume
- active-character validation rules
- artifact loadout validation rules
- deterministic battle simulation fixtures
- `mycelium` gain and level thresholds
- loss `mycelium` reduced to one tenth
- battle reward persistence
- daily rate-limit enforcement
- friend challenge flow
- accepted friend challenge scoring on both player records
- ghost battle result isolation from snapshot-owner stats and rewards
- wiki content reads
- admin-only wiki source-management actions
- local AI test endpoint behavior

### Balance autotest instructions

- add automated matchup sweeps across:
  - all 5 mushrooms
  - all valid no-duplicate 3-artifact loadouts, or a curated representative subset if exhaustive search is too expensive
  - multiple deterministic seeds per matchup
- record at minimum:
  - win rate by mushroom
  - win rate by artifact family
  - win rate by exact artifact loadout where practical
  - average battle length
  - draw rate
  - stun-trigger frequency
- use these autotests as the first balance-review tool before manual tuning
- if the results show a clear skew, agents should adjust the smallest possible numeric values first:
  - artifact bonuses and drawbacks
  - base mushroom stats
  - reward-neutral combat constants such as stun cap only if artifact and stat tuning are insufficient
- avoid adding new mechanics to solve a numeric imbalance in v1
- after each balance adjustment:
  - rerun the matchup autotests
  - compare before/after results
  - keep the change only if it improves balance without creating a larger skew elsewhere

### AI comparison tests

- run several OpenAI prompt combinations against the same battle fixtures
- compare narration quality, consistency, cost, and latency
- expose results on the Local AI Test Lab page
- keep prompt-test output separate from production battle logs
- verify the Local AI Test Lab is disabled in production builds

### End-to-end scenarios

1. Mention bot in group, open game, create profile, select a mushroom, save artifact loadout.
2. Open the app from a normal browser without Telegram `initData`, complete bot-code fallback auth, and confirm the returned session works on protected APIs.
3. Start async PvP battle, watch replay, receive `spore` and `mycelium`.
4. Lose a battle and confirm reduced `mycelium` payout.
5. Reopen app and confirm character selection, artifacts, and progression persist.
6. Open wiki from home and from battle result CTA.
7. Challenge a friend, have the invited friend open the link and accept, then confirm the resulting battle updates both players' leaderboard and personal stats.
8. Start a ghost or offline-opponent battle and confirm only the initiating player receives leaderboard, personal-stat, and reward updates.
9. Attempt an 11th daily battle start and confirm rate-limit behavior.
10. Run local AI narration comparison tests and inspect the results page.
11. Run Playwright screenshot coverage for key screens and review the captures for UI/UX issues.

## Key Risks and Mitigations

### Risk: Telegram entry expectations do not match Mini App limitations

Mitigation:

- treat mention as discovery
- use deep links and main Mini App routing for real gameplay
- keep commands and menu button as fallback entry points
- support browser fallback auth through one-time bot handoff when Telegram `initData` is unavailable

### Risk: Battle presentation feels flat

Mitigation:

- design the battle engine around event logs plus narration from the start
- prioritize avatar reactions, pacing, and artifact-trigger highlights
- use SVG-first visuals so polish can ship earlier

### Risk: Lore and game data drift apart

Mitigation:

- establish a curated wiki export layer between archive artifacts and published game wiki entries
- keep structured repo markdown as the canon wiki source

### Risk: username-based admin allowlist is operationally fragile

Mitigation:

- keep the v1 allowlist exactly as specified by Telegram username
- validate behavior for missing or changed usernames before relying on admin-only flows
- keep broader role or Telegram-ID-based authorization as a later hardening step, not a silent v1 scope expansion

### Risk: retries or concurrent requests create duplicate battles or rewards

Mitigation:

- require server-side idempotency on battle creation
- snapshot combatants before simulation
- persist reward grant and daily-limit consumption atomically

### Risk: v1 scope grows too fast

Mitigation:

- keep battles `1v1`
- limit launch roster to five mushrooms
- keep artifact effects to armor, damage, and stun chance
- postpone status effects, custom avatars, monetization, and deeper progression branches

### Risk: OpenAI-based test tooling leaks into production gameplay

Mitigation:

- keep local AI test routes and pages separate from live match APIs
- disable Local AI Test Lab in production builds for v1
- never let prompt-test outputs overwrite canonical replay logs

## Recommended Technical Defaults

- Frontend: Vue + JavaScript SPA
- Backend: Node.js + JavaScript HTTP service in the existing repo
- Database: PostgreSQL
- Auth: Telegram Mini App `initData` validation on every session bootstrap
- Match type: async PvP first
- Replay format: server-authored deterministic event log
- Theme: light pastel mushroom UI
- Rendering: SVG-first for avatars and lightweight battle effects

## Backlog

- status effects and richer combat mechanics
- branching skill choices and deeper per-character build trees
- expanded artifact catalog
- Backpack Battles style spatial artifact placement
- full trait synergy or faction interaction system
- custom avatar uploads instead of Telegram-avatar-only sourcing
- admin tooling for wiki source management, battle inspection, balance tuning, and player support
- monetization design and Telegram payment constraints review
- richer analytics and live-ops dashboards
- seasonal ladders and reward tracks
- arena modifiers and rotating battle rules
- spectator tools and public replay browsing
- anti-abuse enhancements beyond the daily battle cap
- localization expansion beyond Russian and English
- audio design and richer battle effects
- achievement system depth
- optional PvE campaign expansion
- broader artifact effect families beyond armor, damage, and stun chance
- more than five launch mushrooms
- infrastructure for custom authored art assets
- advanced balance simulation harness and automated matchup sweeps

## Implementation Summary

The best implementation path is to turn the current lore-and-Telegram repository into the content and platform base for a Telegram Mini App game. The bot handles discovery and deep-link launches, the Mini App handles onboarding, character choice, artifact loadouts, battles, social views, and wiki reading, and the backend owns identity, persistence, battle resolution, rewards, replay logs, and rate limits.

The recommended first shipping slice is: `mention bot -> open Mini App -> choose one mushroom -> equip a simple artifact loadout -> run async PvP battle -> watch animated text replay -> gain spore and per-character mycelium -> open wiki`. That slice proves the whole product loop while keeping scope controlled and compatible with Telegram's actual Mini App constraints.
