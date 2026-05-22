# Home Field In-Game Hub Plan

## Source Of Truth

Original request:

> Make a home screen like a real in-game experience: a green grass field with mushroom-forest titles and regular-size mushrooms presented in it. The selected chibi character should walk in this green field. There are two exits: Arena / Mushroom Battles and Journey, with Journey under construction for now. Generate tiles for the objects to place in that area. User should be able to walk in the field with the chibi character and go to the Arena to start a battle. Write plan to md.

Stated criteria and constraints:

- Replace or evolve the current dashboard-like home screen into an in-game walkable hub.
- Scene is a green grass field with mushroom forest atmosphere.
- Selected mushroom character is represented as a chibi avatar in the field.
- Player can walk around the field.
- Arena exit starts or resumes the existing Mushroom Battles flow.
- Journey exit exists visually but is under construction.
- The plan must include tile/object generation for this area.
- This is planning work only for this step.

Success conditions:

- Home feels like a playable game space before the player enters battle prep.
- The player immediately understands: selected character, Arena entrance, Journey entrance, and current run state.
- Starting/resuming a run remains compatible with existing `start-run` / `resume-run` behavior and daily limit rules.
- The implementation can be tested on mobile Telegram Mini App viewport and desktop.
- Generated assets are structured enough to be reviewed, regenerated, cached, and shipped without ad hoc file sprawl.

Open ambiguity:

- Exact camera style is not final: top-down 2D, 3/4 isometric, or side-view diorama. This plan recommends **2.5D top-down / gentle isometric** because it supports walking, tile maps, readable exits on mobile, and the "home hub with doors" mental model.
- Chibi art can be derived from current portraits or generated as separate sprites. This plan recommends separate chibi sprites so movement and direction states are clean.
- Whether existing home dashboard panels remain visible on the same screen or move behind buttons/modals. This plan recommends a minimal overlay plus side/bottom drawer, keeping the field as the primary screen.

## Product Direction

The new home should become the player's "camp" in Mycelium: a small mushroom meadow where their active heroine is physically present. The current home screen already contains useful systems (active run, roster, leaderboard, friends, recipes, settings), but it reads like a web dashboard. The field hub should preserve those systems while making the first impression feel like a game.

The target feeling is close to **Cult of the Lamb's home location flow**: the player explores a safe hub space, moves toward distinct destination entrances, and enters battle through a clear doorway. Mushroom Battles should adapt that pattern to a web/Telegram Mini App scale:

- The destination entrances sit at the **top of the field** so they are immediately visible.
- The selected chibi starts in the **lower-middle** of the field so the player sees both their avatar and the two entrances on page entry.
- The Arena and Journey entrances remain reachable even if the player wanders around the field.
- The field is not just a decorative hero; it is the actual home navigation surface.

Recommended screen name stays `home` and component stays `HomeScreen.js` initially. The new implementation can replace the top-level home template with a hub scene while reusing existing computed data and emits. This avoids a route migration and keeps deep links, onboarding, and post-run navigation stable.

## HTML5 Research Findings

Sources reviewed:

- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN Canvas basic animations](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations)
- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [Phaser Camera docs](https://docs.phaser.io/phaser/concepts/cameras)
- [PixiJS ResizePlugin docs](https://pixijs.com/8.x/guides/components/application/resize-plugin)

Relevant takeaways:

- Use `requestAnimationFrame` for character movement and camera interpolation. Browser-timed animation is smoother and more battery-friendly than manual timers for moving game objects.
- Use Pointer Events for click/tap movement. Pointer Events provide one input model for mouse, touch, and pen, which is exactly what desktop + Telegram Mini App needs.
- Canvas/Pixi/Phaser all work, but the project should pick the lightest viable renderer:
  - **DOM/CSS scene**: best v1 fit. Easy integration with Vue, accessible buttons over hotspots, simple transforms, no new heavy dependency. Good for one compact field with limited animated props.
  - **Canvas 2D**: useful if tile count grows or DOM layering gets costly, but every frame must be redrawn and accessibility must be rebuilt around the canvas.
  - **PixiJS**: best if we need many sprites, particles, lighting, or richer animated tiles; its resize support is built for responsive canvas containers.
  - **Phaser**: best if this becomes a real mini-game layer with tilemaps, collision, camera follow, transitions, and more map logic. Its camera model maps well to a larger explorable world, but it is likely overkill for v1.
- For v1, use **DOM/CSS with a tiny game-loop controller**. Keep the map data-driven so we can move to PixiJS or Phaser later without rewriting the layout contract.
- For responsive behavior, treat the field as a fixed **world coordinate system** with a viewport camera, not as arbitrary responsive HTML. Render by converting world coordinates to screen coordinates using scale + camera offset.
- For mobile, avoid requiring scroll to discover exits. The initial camera must frame the lower chibi and both upper exits.
- For desktop, do not simply stretch the whole field. Preserve the same composition and reveal extra side scenery or side drawers.

## Recommended HTML5 Architecture

V1 renderer: DOM/CSS scene with data-driven world coordinates.

Core pieces:

```text
HomeScreen.js
  └─ HomeFieldScene.js
       ├─ HomeFieldRenderer.js      # world-to-screen positioning helpers
       ├─ HomeFieldController.js    # movement, pointer input, keyboard input
       ├─ home-field-map.json       # terrain, props, collision, exits
       └─ home-field-assets.json    # asset paths, dimensions, anchors
```

Rendering model:

- Scene root uses `position: relative; overflow: hidden;`.
- Terrain uses repeated tile layers or a precomposed background image for v1.
- Props/exits/chibi are absolutely positioned with `transform: translate3d(...) scale(...)`.
- Z-order is computed from world `y` coordinate so foreground mushrooms can overlap the chibi correctly.
- Exit hotspots are real `<button>` elements positioned over the visual entrance area.
- UI overlays are outside the world layer, with `pointer-events` controlled carefully so overlays do not block field taps except on controls.

Game loop:

- Store world position in normalized or pixel world coordinates.
- On pointerdown/tap, convert viewport position to world target.
- Each animation frame moves the chibi toward target at fixed world speed using delta time.
- Stop at collision boundaries and near hotspots.
- Pause or reduce animation when document is hidden.

Input:

- Pointer Events:
  - `pointerdown` on field for tap/click-to-move.
  - `touch-action: none` only on the scene area, not globally.
  - Keep exit buttons tappable; tapping an exit should not also move the player behind it.
- Keyboard:
  - WASD / arrow keys for desktop.
  - Escape closes active modal/drawer.
  - Enter/Space activates focused Arena/Journey buttons.

Why not start with Phaser:

- Phaser's camera and tilemap systems are a great match if the hub becomes a true explorable area, but adding it now creates a second app runtime inside Vue.
- The first production risk is visual direction + responsive framing, not pathfinding or physics.
- A DOM-first implementation can still use the same map JSON, collision rectangles, and asset IDs a future Phaser/Pixi version would use.

## Visual Concept

Scene:

- Lush green grass clearing inside a fungal forest.
- Soft clearing in the lower-middle for the selected chibi's spawn.
- Mushroom clusters and root paths around the edge.
- Two readable exits:
  - **Arena / Mushroom Battles**: warm-lit mushroom arch, battle banners, spore lanterns, placed at the top-right or top-center-right.
  - **Journey**: mossy path or wooden sign with construction rope, dim lantern, "soon" marker, placed at the top-left or top-center-left.
- Title/signage should be in-world: carved mushroom signs, spore-lit plaques, not giant UI cards.
- Character starts below the exits in the lower-middle third, never hidden by panels.
- The top field line should read as "destination row"; the lower field should read as "player space".

Canon constraints from `docs/design-requirements.md`:

- World must read as Mycelium: organic, fungal-biological, spore-saturated, slightly bioluminescent.
- Palette can be greener than battle screens, but should include violet, amber, bone, and fungal neutrals to avoid generic lawn-game visuals.
- Mushroom details should feel alive and integrated, not decorative stock mushrooms.
- Chibi ears must remain elf ears when visible.

## Recommended Camera And Controls

Camera:

- 2.5D field with an initial camera that frames the two top entrances and the lower chibi spawn.
- No free camera for v1; camera follows the character only when they move far enough from the starting composition.
- Field can be larger than viewport, but the initial viewport must show both exits and the chibi on mobile.
- Use a soft vertical camera bias: the chibi is lower than center while both top entrances remain visible. If the user walks upward, the camera can pan slightly upward; if they walk back down, it returns to the default hero framing.

Movement:

- Desktop: arrow keys / WASD and click-to-move.
- Mobile: tap-to-move as primary. Optional virtual joystick only if tap-to-move feels imprecise.
- Telegram Mini App: avoid relying on keyboard; tap zones must be enough.
- Reduced motion: if `prefers-reduced-motion`, use instant character reposition or very short movement transitions.
- Add a "return to entrances" affordance if the map grows beyond one viewport. This can be a small compass/door icon that moves the character or camera back toward the top destination row.

Interaction:

- Exits have collision/activation zones.
- Tapping an exit sign opens a compact action modal.
- Walking into the Arena trigger opens Arena action state:
  - If active run for selected mushroom exists: "Continue Arena".
  - Else: "Enter Arena".
  - If daily limit reached: disabled with existing daily-limit text.
- Walking into Journey trigger opens "Journey is under construction" modal with optional teaser text, no dead click.

## Home Hub State Model

Client-only v1 state:

```js
homeHub: {
  playerX: 0.5,
  playerY: 0.72,
  cameraX: 0.5,
  cameraY: 0.5,
  facing: 'down',
  targetX: null,
  targetY: null,
  activeHotspot: null,
  cameraMode: 'home-default',
  introSeen: false
}
```

Persistence:

- V1 does **not** need new database tables.
- Store last hub position in localStorage only, keyed by player id and active mushroom id.
- Reset to center if selected mushroom changes.

Possible v2 database additions:

- `player_settings.home_hub_intro_seen`
- `player_settings.home_hub_last_mushroom_id`
- `player_settings.home_hub_cosmetic_flags`

Do not add DB persistence until the hub contains meaningful progression or unlocks.

## Tile And Object Asset Plan

Asset folder:

```text
web/public/home-field/
  terrain/
  props/
  exits/
  characters/
  metadata/
```

Tile format:

- PNG with transparent background where relevant.
- Terrain tiles: `256x256`.
- Prop tiles: `256x256` or `512x512`, transparent.
- Chibi sprites: start with `512x512` source poses, then process into app-facing `256x256` or spritesheet frames.
- Keep source/raw generation under ignored `.agent/home-field-workspace/`.

Terrain tiles for v1:

| File | Purpose | Collision |
|---|---|---|
| `terrain/grass_base_01.png` | Default grass tile | walkable |
| `terrain/grass_base_02.png` | Variation for natural repetition | walkable |
| `terrain/grass_flowers_01.png` | Clover/spore flower accent | walkable |
| `terrain/path_dirt_straight.png` | Main path segment | walkable |
| `terrain/path_dirt_curve.png` | Curved path near exits | walkable |
| `terrain/path_spore_glow.png` | Highlight path to Arena | walkable |
| `terrain/path_destination_row.png` | Top entrance row path connecting Arena and Journey | walkable |
| `terrain/edge_roots_01.png` | Organic border | blocked |
| `terrain/edge_moss_rocks_01.png` | Border filler | blocked |

Regular mushroom props:

| File | Purpose | Collision |
|---|---|---|
| `props/mushroom_cluster_small_amber.png` | Foreground detail | blocked or partial |
| `props/mushroom_cluster_small_violet.png` | Color contrast | blocked or partial |
| `props/mushroom_cluster_tall_green.png` | Forest depth | blocked |
| `props/mushroom_cap_red_spotted.png` | Familiar mushroom landmark | blocked |
| `props/mycelium_lantern_amber.png` | Lighting near Arena | blocked |
| `props/spore_puff_idle.png` | Small ambient detail | walkable |
| `props/fallen_branch_mycelium.png` | Organic obstacle | blocked |
| `props/signpost_blank.png` | Base sign for localized labels | blocked |
| `props/return_marker_spore_compass.png` | Optional visual for returning to entrance row | walkable |

Exit objects:

| File | Purpose | Collision / Hotspot |
|---|---|---|
| `exits/arena_mushroom_arch.png` | Top-row Arena entrance | blocked visual, trigger in front |
| `exits/arena_banner_ru.png` | RU title sign | no collision |
| `exits/arena_banner_en.png` | EN title sign | no collision |
| `exits/journey_gate_under_construction.png` | Top-row Journey entrance | blocked visual, trigger in front |
| `exits/journey_sign_ru.png` | RU "Journey soon" sign | no collision |
| `exits/journey_sign_en.png` | EN "Journey soon" sign | no collision |

Character sprites:

| File | Purpose |
|---|---|
| `characters/{mushroom_id}_chibi_idle_down.png` | Default standing |
| `characters/{mushroom_id}_chibi_idle_up.png` | Facing up |
| `characters/{mushroom_id}_chibi_idle_left.png` | Facing left |
| `characters/{mushroom_id}_chibi_idle_right.png` | Facing right |
| `characters/{mushroom_id}_chibi_walk_down.png` | Optional spritesheet |
| `characters/{mushroom_id}_chibi_walk_up.png` | Optional spritesheet |
| `characters/{mushroom_id}_chibi_walk_left.png` | Optional spritesheet |
| `characters/{mushroom_id}_chibi_walk_right.png` | Optional spritesheet |

Metadata:

```text
metadata/home-field-map.json
metadata/home-field-assets.json
```

`home-field-map.json` should describe:

- map size
- terrain layer
- prop placements
- collision rectangles
- hotspot rectangles
- spawn point
- fallback labels

## Image Generation Prompt Templates

Use imagegen for bitmap art, not SVG, because the home screen should feel like a game scene with painterly assets.

Terrain prompt:

```text
Create a seamless 2D game terrain tile for Mushroom Battles: lush green grass in a dark-fairytale fungal forest, soft moss, tiny glowing spores, subtle violet and amber fungal accents, top-down 2.5D RPG style, hand-painted but clean game-ready readability, no text, no UI, no characters, no hard sci-fi, no medieval stone floor. 256x256 square tile, seamless edges.
```

Mushroom prop prompt:

```text
Create a transparent-background 2D game prop for Mushroom Battles: [OBJECT], dark-fairytale fungal fantasy, organic Mycelium world, living mushroom texture, moss, spores, bioluminescent amber/violet accents, readable at small size, 2.5D top-down RPG prop angle, centered object, no text, no character, no UI, transparent PNG.
```

Arena exit prompt:

```text
Create a transparent-background 2D game entrance prop for Mushroom Battles: an Arena entrance made from two giant living mushrooms forming an arch, warm amber spore lanterns, small battle banners, fungal roots, dark-fairytale Mycelium style, inviting but combat-ready, 2.5D top-down RPG prop angle, no readable text, no characters, transparent PNG.
```

Journey under construction prompt:

```text
Create a transparent-background 2D game entrance prop for Mushroom Battles: a mossy path into a mushroom forest blocked by organic vine rope and small construction signs, whimsical but not modern, dark-fairytale Mycelium style, softly glowing spores, clearly reads as not available yet, 2.5D top-down RPG prop angle, no readable text, no characters, transparent PNG.
```

Chibi character prompt template:

```text
Create a transparent-background chibi game sprite for Mushroom Battles: [CHARACTER CANON SUMMARY], mushroom-elf heroine with visible elf ears if ears are shown, dark-fairytale fungal fantasy, cute chibi proportions but preserving signature silhouette and palette, 2.5D top-down RPG idle pose facing [DIRECTION], readable at 96px, clean outline, no text, no UI, transparent PNG.
```

Important: each character prompt must be built from `docs/design-requirements.md` and current game canon. Do not make human-only chibis with mushroom hats.

## UI Layout

Mobile first:

- Full-screen field fills the viewport below existing top nav or replaces nav with minimal overlay.
- Initial camera shows:
  - Arena entrance in the top row;
  - Journey entrance in the top row;
  - selected chibi below them in the lower-middle field.
- Bottom compact action area only appears when near hotspot or when tapping a menu icon.
- Existing social/friends/recipes/settings rail can remain as floating icon buttons, but must not cover the Arena/Journey exits.
- Active mushroom status appears as a small in-world nameplate or compact top-left pill:
  - portrait/chibi head
  - name
  - level
  - mycelium count

Desktop:

- Field should preserve the same top-entrance / lower-chibi composition instead of recentering the chibi vertically.
- Existing leaderboard/friends can become collapsible side panels.
- Do not return to a card dashboard as the primary composition.
- On wide desktop, reveal extra scenery on left/right rather than enlarging the chibi or pushing entrances too far apart.

Accessibility:

- Hotspots are real buttons or keyboard-focusable elements.
- Player can tab to Arena and Journey.
- Arena action has text label for screen readers.
- Journey disabled state explains "under construction".
- Movement is optional for access; tapping/clicking the exit button must be enough.
- A keyboard user can activate Arena/Journey without walking the chibi.

## Functional Integration

Arena:

- Reuse current `playSelectedMushroom()` logic:
  - if selected mushroom has active run, set `state.gameRun` and emit `resume-run`;
  - otherwise emit `start-run`, `'solo'`.
- Respect `state.startingRun`.
- Respect `state.bootstrap.battleLimit.used >= state.bootstrap.battleLimit.limit`.
- If no active mushroom exists, route to `characters`.

Journey:

- No backend call.
- Show modal/drawer:
  - EN: "Journey is under construction"
  - RU: "Путешествие в разработке"
- Optional future CTA: "Back to field".

Character selection:

- The field uses selected/active mushroom chibi.
- Existing roster picker should remain reachable from a compact "Change mushroom" icon or modal.
- Switching mushroom updates chibi and spawn position.

## Implementation Phases

### Phase 1 — Plan And Asset Direction

- Add this plan.
- Create asset prompt worksheet under the same doc.
- Decide camera style and map dimensions.
- Pick initial art generation batch:
  - 8 terrain tiles
  - 8 props
  - 2 exits
  - 1 chibi for active default character as proof of style

Completion condition:

- Plan approved and first asset list locked.

### Phase 2 — Asset Generation Pipeline

- Add scripts:
  - `app/scripts/next-home-field-image-prompts.js`
  - `app/scripts/generate-home-field-contact-sheet.js`
  - `app/scripts/validate-home-field-assets.js`
- Workspace:
  - raw: `.agent/home-field-workspace/raw/`
  - processed: `.agent/home-field-workspace/processed/`
  - review: `.agent/home-field-workspace/review/`
- Production assets:
  - `web/public/home-field/...`

Completion condition:

- Contact sheet shows all v1 field assets.
- Assets load as `<img>` without broken image warnings.

### Phase 3 — Static Hub Scene

- Create `HomeFieldScene` component.
- Render terrain background, props, top-row Arena exit, top-row Journey exit, selected chibi standing in lower-middle spawn.
- No walking yet; just click/tap exits.
- Keep existing home dashboard below or behind a drawer temporarily.

Completion condition:

- Mobile home above fold shows the field, selected chibi, Arena exit, Journey exit.
- Initial mobile and desktop screenshots show both top entrances and the chibi at once.
- Arena click starts/resumes run.
- Journey click shows under-construction modal.

### Phase 4 — Walkable Character

- Add tap-to-move and keyboard movement.
- Add collision rectangles from `home-field-map.json`.
- Add hotspot activation when near Arena/Journey.
- Add camera bias so the top destination row remains discoverable after movement.
- Add return-to-entrances affordance if the character can wander out of the default framed area.
- Add reduced-motion fallback.

Completion condition:

- User can walk selected chibi around field on mobile and desktop.
- User can enter Arena by walking to the Arena trigger.
- User can return to the top entrance row without guessing or scrolling.
- Character cannot walk through blocked mushrooms/edges.

### Phase 5 — Dashboard Migration

- Move existing roster/run history/leaderboard/friends widgets into:
  - compact field overlays;
  - bottom drawer;
  - side drawer on desktop.
- Remove duplicated "Start Game" card once Arena interaction is reliable.

Completion condition:

- Home no longer reads as a dashboard, but all old home functions remain reachable.

### Phase 6 — Tests And Production Hardening

- Update `docs/user-flows.md` Flow B Step 1 to describe the field hub.
- Add E2E coverage:
  - home field renders selected chibi;
  - Arena exit visible;
  - Journey exit visible and opens under-construction modal;
  - Arena click starts run;
  - old start/resume logic still works;
  - mobile and desktop screenshots.
- Add image-load assertions for every home-field asset.
- Add geometry assertions:
  - Arena and Journey hotspots are not overlapped by overlays;
  - on initial mobile and desktop render, Arena, Journey, and selected chibi are all visible in the viewport;
  - chibi starts inside walkable area;
  - no horizontal overflow on mobile.

Completion condition:

- `npm run game:test:screens`
- targeted e2e for home-to-arena flow
- `npm run game:build`

## First V1 Map Proposal

Coordinate system: normalized `0..1` for authoring, converted to pixels at render time.

```json
{
  "spawn": { "x": 0.5, "y": 0.74, "facing": "up" },
  "camera": {
    "initialTarget": { "x": 0.5, "y": 0.48 },
    "mobileSafeFrame": { "x": 0.04, "y": 0.08, "w": 0.92, "h": 0.78 },
    "keepVisible": ["arena", "journey", "player"]
  },
  "hotspots": [
    {
      "id": "arena",
      "labelKey": "homeArenaExit",
      "rect": { "x": 0.57, "y": 0.12, "w": 0.28, "h": 0.22 },
      "action": "arena"
    },
    {
      "id": "journey",
      "labelKey": "homeJourneyExit",
      "rect": { "x": 0.15, "y": 0.12, "w": 0.28, "h": 0.22 },
      "action": "journey"
    }
  ],
  "collision": [
    { "id": "topForest", "x": 0, "y": 0, "w": 1, "h": 0.08 },
    { "id": "leftMushrooms", "x": 0, "y": 0.18, "w": 0.12, "h": 0.7 },
    { "id": "rightMushrooms", "x": 0.88, "y": 0.18, "w": 0.12, "h": 0.7 }
  ]
}
```

## Risks

- Asset scope can balloon quickly. Keep v1 tiny: one field, two exits, one chibi style pass.
- Walking can become a game engine project. Use simple DOM/CSS transforms or a lightweight canvas only if DOM becomes awkward.
- Existing home data is dense. Do not cram all current dashboard info over the field; use drawers.
- Generated chibi sprites must preserve character identity and elf ears. Review against `docs/design-requirements.md`.
- Telegram mobile viewport is small. Critical exits and action labels must be visible without scrolling.
- If the map grows, users may lose the Arena entrance. Add a return-to-entrances affordance before expanding beyond one viewport.
- DOM rendering can get expensive if every grass tile is a DOM node. For v1, use a precomposed/repeating terrain layer and reserve DOM nodes for interactive props, exits, and the chibi.

## Recommended Next Step

Start with Phase 2 asset proof:

1. Generate one grass base tile.
2. Generate one mushroom cluster prop.
3. Generate Arena arch.
4. Generate Journey under-construction gate.
5. Generate one selected-character chibi idle-down sprite.
6. Build a contact sheet for review before coding movement.

This keeps the riskiest part, visual direction, visible early before we rewrite the home UI.
