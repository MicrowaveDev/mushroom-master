# Battle Animation Feedback Plan

Reading guide: this is a planning document for the replay/battle feedback layer. Current gameplay contracts remain in [game-requirements.md](game-requirements.md), especially Req 6-K and Req 13-E/13-G. If this plan ships into implementation, move durable UI contracts into the requirements doc and keep this file as the design record.

## Source Of Truth

Original request: the battle replay currently feels inconsistent because the opponent portrait shows animation while the player portrait does not. Develop this feature into a complete, proportionate game experience where players understand what is happening in battle from animations, including possible item/status effects such as green poison, white freeze, and stun spirals.

Stated criteria and constraints:

- Battle portrait animations must be consistent for the player and the opponent.
- Animations should explain battle events, not merely decorate the screen.
- Status/item effects should have readable visual identities.
- The feature should improve the whole game experience without becoming overwhelming.
- The output for this task is a researched design/implementation plan.

Success conditions:

- Every important replay event has a predictable motion treatment: acting, hit, blocked/armored, stun applied, stun skip, defeat, and future status effects.
- The same event produces the same class of feedback on either side of the duel.
- Players can tell actor, target, damage, stun, and artifact contribution without reading every log entry.
- Reduced-motion users still receive clear non-animated state changes.
- The plan maps to the current code paths in `ReplayDuel`, `FighterCard`, `useReplay`, and `battle-engine`.

Open ambiguity:

- The game currently has stun as a combat status. Poison, freeze, burn, shock, or similar effects should not be animated as real battle states until the battle engine emits explicit event metadata for them.
- The current report says the opponent portrait animated but the player portrait did not. That may be a real side-specific bug, a timing issue where the player was not the current target/actor, or a readability issue caused by centered feedback. The first implementation step should verify this with a deterministic replay screenshot/video.

## Research Notes

Good combat feedback is a language, not a pile of effects. The recurring guidance across game UX and animation references is:

- Readability first: animation should communicate intent and outcome clearly, with clean staging and silhouettes. See Magic Media's animation fundamentals on readability, timing, anticipation, and follow-through: <https://magicmedia.studio/news-insights/animation-fundamentals/>.
- Feedback should be layered by importance. Normal hits need small confirmation; rare or decisive events can earn more emphasis. StraySpark's game UI feedback guide frames this as avoiding both missing feedback and excessive noise: <https://www.strayspark.studio/blog/game-ui-ux-design-principles>.
- UI animation timing should usually stay short. General game UI guidance points to roughly 200-400ms for UI motion, with faster feedback for tiny impacts and restraint for repeated events: <https://generalistprogrammer.com/game-ui-ux-design>.
- Combat feel depends on clear cause and effect: wind-up, contact, recovery, then state result. Even for an auto-battler, the replay needs that sequence so the player trusts what happened.
- Status effects in RPG/combat games are often represented by persistent icons plus short application effects, sometimes with turn counters. The useful pattern here is not copying another game's exact UI; it is combining a momentary "applied now" animation with a quiet persistent "currently affected" marker.

## Current State

The current replay already has a small feedback layer:

- `ReplayDuel.fighterEffectClass(side)` adds:
  - `fighter--acting-now` to the actor.
  - `fighter--hit` to the target.
  - `fighter--stunned` to the target when an action stuns.
  - `fighter--skip` when a stunned combatant skips a turn.
- `styles.css` animates acting lift, hit shake, stun flash, and damage pop.
- `duel-effect-pop` shows damage and `STUN`, but it is centered between the loadouts rather than anchored to the affected portrait.
- Replay events only expose one true status outcome today: `stunned`.
- Artifact attribution exists for damage, stun chance, and armor, but it is explanatory metadata, not a status-effect system.
- Reduced motion is already supported at both CSS and JS layers.

Main gap: feedback is technically present on both sides, but the player experience is not yet a complete readable system. It lacks side-anchored effect labels, persistent status markers, item-family color language, and deterministic visual tests proving both portraits animate under equivalent conditions.

## Animation Principles For This Game

Use three intensity tiers:

| Tier | Use For | Duration | Visual Budget |
|---|---|---:|---|
| Micro | Acting, normal hit, HP change | 180-320ms | One transform or one flash, no particles |
| Standard | Stun apply, blocked hit, passive trigger, item contribution | 350-650ms | One portrait effect plus one small badge/pop |
| Special | Defeat, final battle result, level/rank reward reveal | 700-1200ms | Larger reveal, but only after combat has stopped |

Core rules:

- One event gets one primary cue and at most one secondary cue.
- Actor and target cues must be different. Actor = preparation/lunge/glow; target = impact/recoil/status.
- Never obscure the portrait face, HP meter, or speech bubble.
- Do not animate every artifact chip every hit. Highlight only the stat family that mattered for the active event.
- Persistent effects should be quieter than application effects.
- At 4x/8x replay speed, effects should shorten or collapse rather than overlap.
- In reduced motion, replace movement with static color rings, labels, icon badges, and instant HP updates.

## Proposed Battle Feedback Vocabulary

| Battle Event | Player Should Read | Animation | Static/Reduced-Motion Fallback |
|---|---|---|---|
| Battle start | These two fighters are facing each other | Both portraits fade/settle once; no repeated idle loop | Static VS/status text |
| Step start | New turn step | Tiny center tick or status text update only | Status text update |
| Actor attacks | Who is acting | Actor portrait leans/lifts 3-5px toward target, 220-300ms | Actor ring highlight |
| Target takes damage | Who was hit and how much | Target recoil 4-6px away from actor, brief warm hit flash, side-anchored damage pop | Damage pop beside target |
| Damage blocked/armor matters | Armor reduced damage | Small stone/amber shield shimmer on target edge; attribution chip shows armor | Armor badge/chip |
| Stun applied | Target will lose next action | Yellow/gold spiral or cap-ring orbit above target portrait, 500-650ms; target keeps a small stun badge | Stun badge with label |
| Stun skip | Character lost their action | Portrait dims/desaturates briefly; stun badge pops then disappears | "Stunned" skip label, badge removed |
| Passive trigger | Character-specific ability changed the next hit/state | Small character-colored pulse near actor portrait; text remains in speech/log | Passive chip near actor |
| Defeat | Combat outcome | Losing portrait settles/dims; winner gets short grounded lift, then result sheet | Outcome banner |

## Status And Item Effect Language

Only animate statuses that exist in event data. For future item effects, reserve a consistent visual grammar now:

| Effect Family | Color/Shape | Application Cue | Persistent Cue | Notes |
|---|---|---|---|---|
| Damage | Warm red/clay slash or burst | Quick target flash and `-N` pop | None | Common, keep smallest |
| Armor/block | Amber/stone shield facet | Shield shimmer from target edge | None unless a lasting armor buff exists | Use for blocked damage/armor attribution |
| Stun/control | Yellow-gold spiral, rotating cap ring | Spiral orbit/flash over target | Small spiral badge until skip resolves | Current real status |
| Poison/decay | Green spore motes, slow bubbling ring | Green motes rise from target edge | Green droplet/spore badge with turn count | Future only; needs battle event metadata |
| Freeze | White/ice-blue frost rim | Frost crawls across portrait edge, no full whiteout | Snowflake/frost badge with turn count | Future only; avoid making portraits unreadable |
| Burn | Orange ember flecks | Tiny ember burst at impact | Ember badge | Future only; should not conflict with damage red |
| Shock | Violet/blue jagged pulse | One angular spark arc | Spark badge | Future only; useful for stun-like items but visually distinct |
| Speed/haste | Teal wind streak near actor | Short forward smear on acting portrait | None or haste badge if persistent | Future or passive/attribute cue |
| Entropy/defense-down | Ash gray cracks/veil | Gray crack line on target frame | Down-arrow shield badge if lasting | Dalamar passive candidate |

Poison/freeze/stun should not all be full-screen filters. Keep them as portrait-edge overlays and badges so the replay remains about the fighters.

## Implementation Plan

### Phase 1: Parity And Anchoring

- Add deterministic replay visual coverage where the left side attacks, right side attacks, left side is stunned, and right side is stunned.
- Move damage/stun pops from the duel center to a side-aware target anchor, or add side-specific duplicates while keeping the center clear for status text.
- Keep existing `fighter--acting-now`, `fighter--hit`, `fighter--stunned`, and `fighter--skip`, but ensure CSS direction respects side:
  - left actor lunges right;
  - right actor lunges left;
  - left target recoils left;
  - right target recoils right.
- Acceptance: the same event on left and right has equivalent visual strength in screenshot/video review.

### Phase 2: Event Presentation Model

- Add a small frontend mapper, e.g. `web/src/replay/effects.js`, that converts replay events into visual effect descriptors:
  - `actorCue`
  - `targetCue`
  - `floatingLabels`
  - `statusBadges`
  - `attributionHighlights`
- Keep it backward-compatible with older events that do not have attribution/status metadata.
- Avoid scattering battle logic through Vue templates; components should render descriptors.
- Acceptance: unit tests can pass sample events into the mapper and assert the effect descriptors without mounting the whole replay screen.

### Phase 3: Status Badges And Persistent State

- Render compact status badges on each portrait frame, outside the face/head band and above the name overlay.
- For current gameplay, implement only stun:
  - show stun application on `action.stunned`;
  - keep stun badge visible while `activeReplayState[side].stunned` is true;
  - remove it after the `skip` event clears the flag.
- Use icon-like CSS shapes first; do not add bitmap assets until the language proves itself.
- Acceptance: replay screenshots show stun state before the skipped turn, and no badge after it resolves.

### Phase 4: Item/Artifact Effect Hooks

- Extend artifact attribution presentation from stat chips into optional visual family cues:
  - damage artifacts can tint the hit pop subtly;
  - stun artifacts can strengthen the stun-chance chip only when a stun is attempted/applied;
  - armor artifacts can trigger the block shimmer when `blockedDamage > 0`.
- Do not imply mechanics that did not happen. A poison-looking artifact should not show poison unless the battle event says poison was applied.
- Acceptance: artifact visuals explain contribution without visually overpowering the portraits.

### Phase 5: Future Status Event Contract

If poison, freeze, burn, shock, haste, or defense-down become real mechanics, update the battle event schema first. Suggested event fields:

```js
{
  type: 'action',
  actorSide: 'left',
  targetSide: 'right',
  damage: 4,
  statusApplied: [
    { id: 'poison', duration: 3, sourceArtifactId: 'toxic_spore_sac' }
  ],
  statusRemoved: [],
  ongoingEffects: {
    left: [],
    right: [{ id: 'poison', remaining: 3 }]
  }
}
```

For backward compatibility, `stunned: true` can be mapped to `statusApplied: [{ id: 'stun', duration: 1 }]` in the frontend until the backend emits the new shape.

### Phase 6: Polish, Settings, And Sound/Haptics Later

- Tie effect duration to replay speed. At 8x, prefer static labels and badge changes over long animations.
- Keep all battle effects under reduced-motion control.
- Later, coordinate with [sound-design-recommendations.md](sound-design-recommendations.md):
  - normal hit: very quiet tap/thump;
  - stun apply: soft control sparkle;
  - freeze/poison future effects: subtle one-shots only.
- Do not add sound before the visual language is stable.

## CSS/Component Direction

Recommended component shape:

- `ReplayDuel` owns event-to-side routing and passes each fighter a `visualEffects` object.
- `FighterCard` renders:
  - portrait image;
  - speech bubble;
  - HP/name overlay;
  - effect overlay layer;
  - status badge row.
- CSS uses custom properties for side direction:
  - `--fighter-direction: 1` for left-to-right actor movement;
  - `--fighter-direction: -1` for right-to-left actor movement.

Recommended classes:

- `fighter--acting`
- `fighter--targeted`
- `fighter--damage`
- `fighter--blocked`
- `fighter--status-stun`
- `fighter--status-poison`
- `fighter--status-freeze`
- `fighter--skip`
- `fighter-status-badge--stun`
- `fighter-effect-pop--damage`

Avoid long-running idle animations on portraits. This is a replay readability feature, not a breathing/live2D system.

## Verification Plan

- Unit tests:
  - event-to-effect mapper for action, stun, skip, blocked damage, legacy events, and reduced-motion mode.
  - direction/side mapping for left and right.
- Component tests:
  - `FighterCard` renders badge and label layers without requiring animation timers.
- Playwright/screenshot tests:
  - dual viewport replay screenshots for left hit, right hit, left stun, right stun, and replay speed controls.
  - geometry assertions that effect overlays do not cover HP, names, speech bubbles, or configured face/head bands.
- Manual review:
  - watch at 2x, 4x, and 8x.
  - verify after 10 repeated battles that normal hits feel informative, not noisy.
  - verify reduced-motion setting with system `prefers-reduced-motion`.

## Proposed First Ticket

Title: "Replay battle feedback parity and side-anchored status effects"

Scope:

- Add `web/src/replay/effects.js`.
- Add side-aware floating labels in `ReplayDuel`.
- Refactor current animation classes to use effect descriptors.
- Implement persistent stun badge only.
- Add tests/screenshots for both left and right stun/hit states.

Non-goals:

- No new combat mechanics.
- No poison/freeze effects until backend event data exists.
- No sound assets.
- No full-screen camera shake or constant portrait idle motion.

