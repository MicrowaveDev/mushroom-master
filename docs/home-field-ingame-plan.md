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
- [Phaser ObjectLayer docs](https://docs.phaser.io/api-documentation/class/tilemaps-objectlayer)
- [Phaser Tilemap docs](https://docs.phaser.io/api-documentation/3.88.2/class/tilemaps-tilemap)
- [Phaser Animation docs](https://docs.phaser.io/phaser/concepts/animations)
- [PixiJS ResizePlugin docs](https://pixijs.com/8.x/guides/components/application/resize-plugin)
- [PixiJS Assets docs](https://pixijs.com/8.x/guides/components/assets)
- [PixiJS performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
- [Tiled custom properties docs](https://doc.mapeditor.org/manual/custom-properties/)
- [Tiled layers docs](https://doc.mapeditor.org/en/stable/manual/layers/)

Relevant takeaways:

- Use `requestAnimationFrame` for character movement and camera interpolation. Browser-timed animation is smoother and more battery-friendly than manual timers for moving game objects.
- Use Pointer Events for click/tap movement. Pointer Events provide one input model for mouse, touch, and pen, which is exactly what desktop + Telegram Mini App needs.
- Canvas/Pixi/Phaser all work, but the project should pick the lightest viable renderer for the current phase while keeping the map and asset contract engine-ready:
  - **DOM/CSS scene**: best prototype fit. Easy integration with Vue, accessible buttons over hotspots, simple transforms, no new heavy dependency. Good for proving composition and top-door layout, but not the long-term target if animated tilemaps/effects become core.
  - **Canvas 2D**: useful if tile count grows or DOM layering gets costly, but every frame must be redrawn and accessibility must be rebuilt around the canvas.
  - **PixiJS**: best if we need many sprites, particles, lighting, or richer animated tiles; its resize support is built for responsive canvas containers.
  - **Phaser**: best if this becomes a real mini-game layer with animated tilemaps, collision, camera follow, transitions, and more map logic. Its camera model maps well to a larger explorable world.
- For v1, use **DOM/CSS with a tiny game-loop controller only as a proof stage**. Keep the map data-driven so the production renderer can become PixiJS or Phaser without rewriting the layout contract.
- If animated tilemaps/effects are confirmed as production scope, promote the renderer decision earlier: **Phaser for tilemap/gameplay-heavy hub**, **PixiJS for art/effects-heavy hub with simpler collision**.
- For responsive behavior, treat the field as a fixed **world coordinate system** with a viewport camera, not as arbitrary responsive HTML. Render by converting world coordinates to screen coordinates using scale + camera offset.
- For mobile, avoid requiring scroll to discover exits. The initial camera must frame the lower chibi and both upper exits.
- For desktop, do not simply stretch the whole field. Preserve the same composition and reveal extra side scenery or side drawers.
- Phaser's Tiled object-layer model is a strong fit because Arena/Journey exits, spawn points, collision zones, camera anchors, signs, and effect emitters are naturally object-layer data.
- Phaser's frame animation model fits chibi idle/walk states and ambient prop loops, as long as generated spritesheets declare exact frame dimensions.
- Tiled custom properties can later author `action`, `labelKey`, `disabled`, `requires`, `ambient`, and `collision` data directly in the map. Mirror that shape in JSON now.
- PixiJS is still a good lighter option if the home hub becomes mostly an animated illustration. Phaser is the better default if walking, triggers, collision, camera behavior, and future Journey gameplay matter.

Updated recommendation after research:

- **Use DOM or Node-canvas previews only for contact sheets, map previews, and a small UX proof.**
- **Use Phaser for the production renderer once animated tilemaps/effects and walkable exits are in scope.**
- Keep metadata Tiled-compatible from the first agent pass so the project can hand-author JSON now and migrate to Tiled later.

## Game UX Research Conclusions

The home field should optimize for three moments:

1. **First frame clarity**: on load, the player sees their selected chibi, Arena, Journey, and the field identity without scrolling.
2. **Immediate agency**: the first tap/click either moves the character or activates a clear entrance.
3. **Fast battle intent**: Arena is the dominant destination. Journey is visible enough to tease expansion, but not equal in interaction weight while it is under construction.

Practical UX rules:

- Use click/tap-to-move as the primary control. It is more Telegram/mobile-friendly than virtual joysticks for this small hub.
- Support keyboard movement on desktop, but do not design the UX around keyboard.
- Make Arena reachable in one short move from spawn. The user should not need to wander before battle.
- Keep Journey slightly secondary: visible on the destination row, visually marked as under construction, and non-blocking.
- Use in-world labels/signs for Arena/Journey, plus invisible semantic DOM buttons over hotspots for accessibility and reliable tapping.
- Add a "return to entrances" affordance before expanding the map beyond the initial viewport.
- Keep home UI overlays minimal. Profile/resources/language/settings can live in compact corners or drawers, not in the walking lane.
- Animate only what helps the scene feel alive or helps navigation:
  - Arena portal shimmer;
  - path pulse toward Arena;
  - low-density spore motes;
  - chibi idle/walk;
  - Journey construction rustle.
- Avoid high-frequency ambient motion. It will feel noisy in Telegram and can hurt battery/performance.
- Respect reduced motion by freezing ambient loops and keeping only direct movement feedback.

Efficient production UX target:

```text
Initial viewport
  top-left: Journey gate, disabled/under-construction
  top-right or top-center-right: Arena arch, warm and active
  lower-middle: selected chibi spawn
  center path: subtle grass/mycelium route from chibi to Arena
  corners: compact app buttons, not dashboard cards
```

The best v1 is not a large explorable map. It is a polished, tiny hub where every pixel supports "this is my character, this is where I battle, more world is coming."

## Recommended HTML5 Architecture

V1 review renderer: DOM/CSS or Node-canvas preview with data-driven world coordinates.

Production renderer recommendation: Phaser, unless the first animated prototype proves the hub will stay purely decorative.

Core pieces:

```text
HomeScreen.js
  └─ HomeFieldScene.js
       ├─ HomeFieldRenderer.js      # world-to-screen positioning helpers
       ├─ HomeFieldController.js    # movement, pointer input, keyboard input
       ├─ home-field-map.json       # terrain, props, collision, exits
       └─ home-field-assets.json    # asset paths, dimensions, anchors
```

Recommended production engine target:

```text
HomeScreen.js
  └─ HomeFieldCanvasScene.js
       ├─ renderer/phaser-or-pixi-app.js
       ├─ renderer/home-field-camera.js
       ├─ renderer/home-field-input.js
       ├─ renderer/home-field-effects.js
       ├─ home-field-map.json
       └─ home-field-assets.json
```

Do not encode scene rules directly in Vue templates. Vue owns app state, overlays, modal actions, and navigation; the field renderer owns world sprites, camera, animation, and collision. This boundary keeps the future engine swap realistic.

Phaser-specific production shape:

```text
HomeFieldPhaserScene
  preload()
    load atlases/spritesheets from home-field-assets.json
    load map JSON from home-field-map.json or Tiled export
  create()
    create tile layers
    create object layers for exits, signs, collision, spawn, effects
    create chibi sprite and idle/walk animations
    create camera bounds, follow target, deadzone/safe-frame rules
    register DOM overlay buttons for Arena/Journey hotspots
  update(time, delta)
    move chibi toward target
    play/stop walk animation
    resolve collision
    update proximity/activation state
```

Use Phaser object layers for:

- `spawn`;
- `hotspots`;
- `collision`;
- `signs`;
- `cameraAnchors`;
- `effectEmitters`.

Use tile layers for:

- base grass;
- paths;
- decorative ground variation;
- optional foreground/edge tiles.

Use sprite/object layers for:

- Arena arch;
- Journey gate;
- mushrooms, lanterns, props;
- chibi;
- ambient effects.

Rendering model:

- Scene root uses `position: relative; overflow: hidden;`.
- Terrain uses a precomposed or repeated visual layer for prototype, but map metadata still describes tile layers.
- Props/exits/chibi are absolutely positioned with `transform: translate3d(...) scale(...)` in the prototype.
- Z-order is computed from world `y` coordinate so foreground mushrooms can overlap the chibi correctly.
- Exit hotspots are real `<button>` elements positioned over the visual entrance area.
- UI overlays are outside the world layer, with `pointer-events` controlled carefully so overlays do not block field taps except on controls.
- Animated props must be represented as named animation states in `home-field-assets.json`, even if the first prototype displays only their first frame.

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

- Phaser's camera and tilemap systems are a great match if the hub becomes a true explorable area.
- The first production risk is visual direction + responsive framing, not pathfinding or physics, so a DOM proof can still be useful.
- Do not let the DOM proof become permanent if we commit to animated grass, water/spores, particles, multi-frame chibi walking, or larger tilemaps.
- Decision gate: after the static scene and first asset sheet, choose between:
  - **DOM prototype only** for a tiny hub with minimal animation;
  - **PixiJS production renderer** for animated sprites, particles, lighting, and moderate map logic;
  - **Phaser production renderer** for tilemap-native collision, camera, scene transitions, and future hub gameplay.

## Animated Tilemap And Effects Direction

Assume the future hub should support animation. Even if v1 ships static, assets and metadata should be authored as if animation will arrive.

Animated tilemap candidates:

- grass shimmer / wind sway;
- spore motes drifting over the field;
- glowing mycelium veins pulsing along the Arena path;
- mushroom caps breathing subtly;
- lantern flicker near Arena;
- Journey gate construction rope/vines rustling;
- portal-like shimmer inside the Arena arch;
- small ambient critter/spore puffs, if they do not distract from navigation.

Animation asset formats:

- Terrain animation: spritesheet strips or atlas frames, not GIF.
- Effects: transparent PNG spritesheets or atlas frames.
- Chibi: directional idle + walk spritesheets.
- Metadata declares `frameWidth`, `frameHeight`, `fps`, `loop`, and named states.

Example asset metadata:

```json
{
  "id": "arena_arch",
  "type": "exit",
  "src": "/home-field/exits/arena_mushroom_arch.png",
  "anchor": { "x": 0.5, "y": 0.82 },
  "animations": {
    "idle": {
      "src": "/home-field/exits/arena_mushroom_arch_idle.png",
      "frameWidth": 512,
      "frameHeight": 512,
      "frames": 8,
      "fps": 8,
      "loop": true
    }
  }
}
```

Map metadata should stay close to tilemap conventions:

- tile size;
- tile layers;
- object layers;
- collision layer;
- hotspot layer;
- spawn points;
- effect emitters;
- camera safe frames.

This shape can be exported from Tiled later or hand-authored at first.

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
  effects/
  atlases/
  metadata/
```

Tile format:

- PNG with transparent background where relevant.
- Terrain tiles: `256x256`.
- Prop tiles: `256x256` or `512x512`, transparent.
- Chibi sprites: start with `512x512` source poses, then process into app-facing `256x256` or spritesheet frames.
- Animated tiles/effects: spritesheet strips or packed atlases with metadata; avoid GIF/video for core map animation.
- Keep source/raw generation under ignored `.agent/home-field-workspace/`.

Terrain tiles for v1:

| File | Purpose | Collision | Animation |
|---|---|---|---|
| `terrain/grass_base_01.png` | Default grass tile | walkable | optional `grass_base_01_idle.png` |
| `terrain/grass_base_02.png` | Variation for natural repetition | walkable | optional |
| `terrain/grass_flowers_01.png` | Clover/spore flower accent | walkable | optional flower sway |
| `terrain/path_dirt_straight.png` | Main path segment | walkable | static |
| `terrain/path_dirt_curve.png` | Curved path near exits | walkable | static |
| `terrain/path_spore_glow.png` | Highlight path to Arena | walkable | pulsing glow |
| `terrain/path_destination_row.png` | Top entrance row path connecting Arena and Journey | walkable | subtle spore drift |
| `terrain/edge_roots_01.png` | Organic border | blocked | root pulse optional |
| `terrain/edge_moss_rocks_01.png` | Border filler | blocked | static |

Regular mushroom props:

| File | Purpose | Collision | Animation |
|---|---|---|---|
| `props/mushroom_cluster_small_amber.png` | Foreground detail | blocked or partial | cap breathing optional |
| `props/mushroom_cluster_small_violet.png` | Color contrast | blocked or partial | spore sparkle optional |
| `props/mushroom_cluster_tall_green.png` | Forest depth | blocked | sway optional |
| `props/mushroom_cap_red_spotted.png` | Familiar mushroom landmark | blocked | static |
| `props/mycelium_lantern_amber.png` | Lighting near Arena | blocked | lantern flicker |
| `props/spore_puff_idle.png` | Small ambient detail | walkable | looping puff |
| `props/fallen_branch_mycelium.png` | Organic obstacle | blocked | mycelium pulse optional |
| `props/signpost_blank.png` | Base sign for localized labels | blocked | static |
| `props/return_marker_spore_compass.png` | Optional visual for returning to entrance row | walkable | pulse |

Exit objects:

| File | Purpose | Collision / Hotspot | Animation |
|---|---|---|---|
| `exits/arena_mushroom_arch.png` | Top-row Arena entrance | blocked visual, trigger in front | portal shimmer / lantern flicker |
| `exits/arena_banner_ru.png` | RU title sign | no collision | static |
| `exits/arena_banner_en.png` | EN title sign | no collision | static |
| `exits/journey_gate_under_construction.png` | Top-row Journey entrance | blocked visual, trigger in front | vine/rope rustle |
| `exits/journey_sign_ru.png` | RU "Journey soon" sign | no collision | static |
| `exits/journey_sign_en.png` | EN "Journey soon" sign | no collision | static |

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

Effect sprites:

| File | Purpose |
|---|---|
| `effects/spore_motes_loop.png` | Transparent looping particle-like overlay |
| `effects/arena_portal_shimmer.png` | Arena arch shimmer |
| `effects/mycelium_path_pulse.png` | Path glow pulse toward Arena |
| `effects/journey_blocked_rustle.png` | Journey under-construction ambient motion |

Metadata:

```text
metadata/home-field-map.json
metadata/home-field-assets.json
```

`home-field-map.json` should describe:

- map size
- terrain layer
- animated tile layer references
- prop placements
- collision rectangles
- hotspot rectangles
- spawn point
- effect emitters
- fallback labels

## Agent Implementation Flow

This section is written as the executable workflow for future agents. Follow it in order unless the user explicitly narrows the task.

### Efficient Agent Flow Shape

The most efficient flow is a vertical slice, not a broad asset dump. Each agent/task should produce a reviewable artifact that proves the next stage is worth doing.

Recommended sequence:

1. **UX Mapper Agent**
   - Owns `home-field-map.json` and map preview.
   - Places spawn, Arena, Journey, path, camera safe frames, collision, and hotspots.
   - Produces `.agent/home-field-workspace/review/map-preview.png`.
   - Acceptance gate: first frame shows chibi + Arena + Journey on mobile and desktop.

2. **Asset Metadata Agent**
   - Owns `home-field-assets.json` and `home-field-prompts.json`.
   - Defines asset IDs, output paths, dimensions, animation states, prompt keys, and validation requirements.
   - Produces a missing-asset queue from metadata.
   - Acceptance gate: validation can fail clearly with actionable missing asset IDs.

3. **Art Generation Agent**
   - Uses imagegen only after metadata exists.
   - Generates the minimum proof batch, not the whole scene.
   - Stores raw outputs in `.agent/home-field-workspace/raw/`.
   - Acceptance gate: contact sheet proves style, transparency, scale, and tile seams.

4. **Asset Processing Agent**
   - Crops, pads, optimizes, and spritesheets generated images.
   - Writes only approved app-facing assets to `web/public/home-field/**`.
   - Produces processing manifests and animation strip sheets.
   - Acceptance gate: dimensions, alpha, frame counts, and metadata all validate.

5. **Renderer Spike Agent**
   - Renders the same map metadata in the target renderer.
   - If animated effects remain in scope, prefer Phaser for this spike.
   - Produces mobile and desktop screenshots plus a short note on FPS/responsiveness.
   - Acceptance gate: user can tap/click to move, activate Arena, and see Journey disabled.

6. **Game UX QA Agent**
   - Adds focused E2E and screenshot coverage.
   - Checks no-scroll initial frame, hotspot usability, reduced motion, language persistence, and battle-start compatibility.
   - Acceptance gate: tests cover home-to-arena and under-construction Journey without relying on visual-only assertions.

Agent batching rule:

- One batch should contain at most one new risk category:
  - map/layout risk;
  - art style risk;
  - animation risk;
  - renderer/performance risk;
  - integration/test risk.
- If a batch mixes all of them, review becomes slow and mistakes hide inside "big progress."

### Agent Flow Source Of Truth

Before editing code or generating images, read:

1. This document.
2. `docs/design-requirements.md` for Mycelium visual canon and character identity.
3. `docs/user-flows.md` before adding E2E/screenshot coverage.
4. `AGENTS.md` for repo workflow and verification rules.

Do not start by editing `HomeScreen.js`. The first implementation stage is the asset/metadata pipeline.

### Agent-Owned File Sets

The home-field work owns these paths:

```text
docs/home-field-ingame-plan.md
web/public/home-field/
app/shared/home-field/
app/scripts/next-home-field-image-prompts.js
app/scripts/produce-home-field-assets.js
app/scripts/generate-home-field-contact-sheet.js
app/scripts/validate-home-field-assets.js
.agent/home-field-workspace/              # local ignored workspace
```

Do not mix home-field generated assets into artifact, season, achievement, or social-preview workspaces.

Recommended production metadata paths:

```text
app/shared/home-field/home-field-assets.json
app/shared/home-field/home-field-map.json
app/shared/home-field/home-field-prompts.json
```

Recommended public asset paths:

```text
web/public/home-field/terrain/
web/public/home-field/props/
web/public/home-field/exits/
web/public/home-field/characters/
web/public/home-field/effects/
web/public/home-field/atlases/
```

Recommended local workspace:

```text
.agent/home-field-workspace/
  raw/
  processed/
  review/
  manifests/
```

Add this workspace to `.gitignore` before generating raw images.

### Step 1 — Define Metadata Schema

Create `app/shared/home-field/home-field-assets.json` first. It should be the durable source for every generated asset, prompt, dimensions, collision intent, animation contract, and output path.

Minimum asset schema:

```json
{
  "version": 1,
  "tileSize": 256,
  "assets": [
    {
      "id": "grass_base_01",
      "type": "terrain",
      "role": "base_grass",
      "promptKey": "terrain_grass_base_01",
      "sourcePath": ".agent/home-field-workspace/raw/grass_base_01.source.png",
      "outputPath": "web/public/home-field/terrain/grass_base_01.png",
      "publicPath": "/home-field/terrain/grass_base_01.png",
      "width": 256,
      "height": 256,
      "anchor": { "x": 0.5, "y": 0.5 },
      "collision": "walkable",
      "animation": null,
      "status": "missing"
    }
  ]
}
```

For animated assets:

```json
{
  "id": "arena_portal_shimmer",
  "type": "effect",
  "role": "arena_entrance_shimmer",
  "outputPath": "web/public/home-field/effects/arena_portal_shimmer.png",
  "publicPath": "/home-field/effects/arena_portal_shimmer.png",
  "width": 512,
  "height": 512,
  "anchor": { "x": 0.5, "y": 0.75 },
  "animation": {
    "frameWidth": 512,
    "frameHeight": 512,
    "frames": 8,
    "fps": 8,
    "loop": true,
    "state": "idle"
  },
  "status": "missing"
}
```

Create `app/shared/home-field/home-field-map.json` second. It should place assets in world coordinates and define layers:

```json
{
  "version": 1,
  "world": { "width": 1600, "height": 1000, "tileSize": 256 },
  "spawn": { "x": 800, "y": 740, "facing": "up" },
  "camera": {
    "initialTarget": { "x": 800, "y": 480 },
    "keepVisible": ["arena", "journey", "player"],
    "mobileSafeFrame": { "x": 0.04, "y": 0.08, "w": 0.92, "h": 0.78 }
  },
  "layers": [
    {
      "id": "terrain",
      "type": "tileLayer",
      "z": 0,
      "tiles": [
        { "assetId": "grass_base_01", "x": 0, "y": 0 }
      ]
    },
    {
      "id": "objects",
      "type": "objectLayer",
      "z": 10,
      "objects": [
        { "id": "arena", "assetId": "arena_mushroom_arch", "x": 1080, "y": 210, "hotspotId": "arena" }
      ]
    },
    {
      "id": "effects",
      "type": "effectLayer",
      "z": 20,
      "effects": [
        { "assetId": "arena_portal_shimmer", "x": 1080, "y": 210, "state": "idle" }
      ]
    }
  ],
  "collision": [
    { "id": "topForest", "x": 0, "y": 0, "w": 1600, "h": 80 }
  ],
  "hotspots": [
    { "id": "arena", "action": "arena", "x": 900, "y": 120, "w": 360, "h": 230, "labelKey": "homeArenaExit" },
    { "id": "journey", "action": "journey", "x": 250, "y": 120, "w": 360, "h": 230, "labelKey": "homeJourneyExit" }
  ]
}
```

Keep the map JSON numeric and renderer-agnostic. Do not store CSS class names, Vue component names, or localized strings in map metadata.

### Step 2 — Prompt Queue Script

Add `app/scripts/next-home-field-image-prompts.js`.

Responsibilities:

- Read `app/shared/home-field/home-field-assets.json`.
- Print the next missing assets whose `outputPath` does not exist or whose `status` is `missing`.
- Include:
  - id;
  - output path;
  - raw source path;
  - prompt text;
  - transparent-background requirement;
  - animation requirement, if any;
  - validation expectations.
- Default batch size: 5.
- Support `--all`, `--type terrain|prop|exit|character|effect`, and `--id id_a,id_b`.

Expected command:

```bash
node app/scripts/next-home-field-image-prompts.js --type terrain --limit 5
```

Recommended package alias:

```json
"game:home-field:next": "node app/scripts/next-home-field-image-prompts.js"
```

### Step 3 — Generate Raw Images

Use imagegen for raw bitmap outputs.

Rules:

- Save raw images exactly at the `sourcePath`.
- Do not save raw images under `web/public`.
- For transparent assets, request transparent PNG when possible. If the generator returns a flat background, process it locally before app-facing output.
- For terrain tiles, request seamless edges, but still validate tile seams manually on contact sheet.
- For animated effects, generate either:
  - a spritesheet directly; or
  - 4-8 raw frame candidates named `{asset_id}.frame_00.source.png`, then compose locally.

Agent raw naming:

```text
.agent/home-field-workspace/raw/{asset_id}.source.png
.agent/home-field-workspace/raw/{asset_id}.frame_00.source.png
.agent/home-field-workspace/raw/{asset_id}.frame_01.source.png
```

### Step 4 — Produce App-Facing Assets

Add `app/scripts/produce-home-field-assets.js`.

Responsibilities:

- Read selected asset IDs from args.
- Load raw source(s).
- Crop/pad to required canvas size.
- Remove chroma-key/background for transparent props/effects if needed.
- Preserve transparency.
- Write final PNG to `outputPath`.
- For animated assets:
  - compose frames into a horizontal spritesheet or atlas;
  - verify `width === frameWidth * frames` for strip spritesheets;
  - update or validate the animation metadata.
- Write a processing manifest:

```text
.agent/home-field-workspace/manifests/produce-{timestamp}.json
```

Recommended package alias:

```json
"game:home-field:produce": "node app/scripts/produce-home-field-assets.js"
```

### Step 5 — Validate Assets And Metadata

Add `app/scripts/validate-home-field-assets.js`.

Validation should fail when:

- `outputPath` is missing for any required asset.
- PNG dimensions do not match metadata.
- Transparent props/effects have no alpha channel or no transparent padding.
- Terrain tile dimensions are not exactly `tileSize x tileSize`.
- Animated spritesheet dimensions do not match `frameWidth * frames` and `frameHeight`.
- `fps` is missing or outside a sane range (suggested `1..24` for ambient loops).
- `home-field-map.json` references unknown `assetId`s.
- Collision/hotspot rectangles are outside the world bounds.
- Spawn point is inside collision.
- Arena, Journey, and player spawn cannot all fit inside `camera.mobileSafeFrame` on initial render.

Expected command:

```bash
node app/scripts/validate-home-field-assets.js
```

Recommended package alias:

```json
"game:home-field:validate": "node app/scripts/validate-home-field-assets.js"
```

### Step 6 — Generate Review Contact Sheets

Add `app/scripts/generate-home-field-contact-sheet.js`.

Review outputs:

```text
.agent/home-field-workspace/review/contact-sheet.png
.agent/home-field-workspace/review/contact-sheet.manifest.json
.agent/home-field-workspace/review/map-preview.png
.agent/home-field-workspace/review/animation-strip-sheet.png
```

Contact sheet must show:

- each terrain tile repeated at least `3x3` so seam problems are visible;
- each prop/exits asset on neutral, grass, and dark backgrounds;
- each chibi at expected in-game display size and 2x size;
- each animated asset as frame strip plus first-frame in context;
- asset ID and dimensions.

Map preview must render:

- proposed full field layout;
- top-row Arena and Journey entrances;
- lower-middle chibi spawn;
- collision rectangles as translucent overlays;
- hotspot rectangles as labeled overlays;
- mobile safe frame.

Recommended package alias:

```json
"game:home-field:sheet": "node app/scripts/generate-home-field-contact-sheet.js"
```

### Step 7 — Agent Review Loop

For each asset batch:

1. Run `npm run game:home-field:next`.
2. Generate raw images with imagegen.
3. Run `npm run game:home-field:produce -- id_a id_b`.
4. Run `npm run game:home-field:validate`.
5. Run `npm run game:home-field:sheet`.
6. Open and inspect:
   - `.agent/home-field-workspace/review/contact-sheet.png`
   - `.agent/home-field-workspace/review/map-preview.png`
   - `.agent/home-field-workspace/review/animation-strip-sheet.png`
7. If an asset fails visually, regenerate raw source rather than patching with CSS.
8. Commit only:
   - scripts;
   - metadata;
   - approved `web/public/home-field/**` production assets;
   - docs.
9. Do not commit `.agent/home-field-workspace/**`.

### Step 8 — Minimum First Agent Batch

The first implementation agent should produce only this proof set:

| ID | Type | Required |
|---|---|---|
| `grass_base_01` | terrain | yes |
| `grass_base_02` | terrain | yes |
| `path_destination_row` | terrain | yes |
| `mushroom_cluster_small_amber` | prop | yes |
| `mycelium_lantern_amber` | prop | yes |
| `arena_mushroom_arch` | exit | yes |
| `journey_gate_under_construction` | exit | yes |
| `spore_motes_loop` | effect | yes, animated proof |
| `{active_mushroom}_chibi_idle_up` | character | yes |

Do not generate all character chibis in the first pass. Validate the style with one active/default mushroom first.

### Step 9 — Renderer Spike

After the first asset proof passes review, create a minimal renderer spike in one of two ways:

- DOM prototype:
  - render map preview in Vue;
  - play only one animated effect via CSS background-position or JS frame switching;
  - keep hotspots as DOM buttons.
- PixiJS/Phaser spike:
  - render the same `home-field-map.json`;
  - place Arena/Journey/chibi from metadata;
  - play `spore_motes_loop`;
  - keep DOM overlay buttons aligned with canvas hotspots.

Default to Phaser for this spike if the user still wants animated tilemaps/effects. Use PixiJS only if the spike is intentionally focused on painterly sprite composition and ambient effects with very simple movement/collision.

Completion condition:

- Screenshot proves Arena, Journey, and chibi are all visible on mobile and desktop.
- One animated effect plays.
- No production home dashboard migration yet.

### Step 10 — Agent Final Handoff Checklist

Before handoff, report:

- generated asset IDs;
- production output paths;
- raw workspace paths;
- contact sheet path;
- map preview path;
- animation sheet path;
- validation command results;
- whether renderer remains DOM prototype or should move to PixiJS/Phaser next.

If anything is not generated, say exactly which asset IDs remain `missing`.

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

## Pre-Implementation Decisions

Set these decisions before writing the scene code. They are small on paper but expensive to change after assets, metadata, and tests exist.

### Renderer Decision

Default to **Phaser** for implementation if any of these remain true:

- chibi has directional idle/walk sprites;
- Arena/Journey are collision/hotspot objects;
- ambient effects are animated spritesheets;
- map can grow later into Journey/home activities.

Use DOM only for contact sheets, map preview, or a very short-lived composition proof. Do not build a large DOM game layer and then migrate it.

### Data Contract Freeze

Freeze these contracts before generating more than the first proof batch:

- asset IDs are stable and lower_snake_case;
- all public asset paths start with `/home-field/`;
- map uses pixel world coordinates, not percentages, in production metadata;
- normalized coordinates are allowed only in docs/proposals;
- every interactive object has an `id`, `action`, `labelKey`, and rectangle/polygon hotspot;
- every animated asset has a still fallback frame.

Changing coordinate systems mid-implementation is one of the highest-risk mistakes. Use pixel coordinates in JSON and let the renderer scale camera/viewport.

### Asset Budget

Set budgets so the hub does not become heavy in Telegram:

- Initial required download for home-field art: target under 1.5 MB compressed.
- Single terrain tile: target under 80 KB.
- Single prop/exit PNG: target under 250 KB.
- Animated ambient spritesheet: target under 350 KB each.
- First production batch: no more than 2 ambient animated loops visible at once.
- Lazy-load Journey-only detail after the first frame if it is decorative.

If a generated image is beautiful but too large, process it before shipping. Do not hide oversized assets behind cache assumptions.

### Viewport And Safe Areas

Implementation must test these viewport classes:

- Telegram-like mobile portrait: `390x844`;
- small mobile portrait: `360x740`;
- mobile landscape or short viewport: `844x390`;
- desktop: `1440x900`;
- wide desktop: `1920x1080`.

Initial camera must keep these visible:

- selected chibi body and nameplate;
- Arena hotspot;
- Journey hotspot;
- language/settings/menu controls;
- no bottom browser/Telegram safe-area overlap with primary action UI.

Use CSS `env(safe-area-inset-*)` for overlay placement. Do not put the Arena/Journey activation affordance behind the iOS/Telegram bottom gesture area.

### State Machine

Before UI work, define the home-field state machine:

```text
loadingAssets
  -> readyIdle
  -> moving
  -> nearHotspot
  -> activatingArena
  -> journeyModal
  -> drawerOpen
  -> errorFallback
```

Rules:

- `activatingArena` reuses existing start/resume guards and must debounce duplicate taps.
- `drawerOpen` pauses tap-to-move behind the drawer.
- `journeyModal` does not change game state.
- `errorFallback` shows the old reliable dashboard start/resume path if Phaser or assets fail.

### Accessibility And Fallback

Canvas cannot be the only interface:

- Arena and Journey must have real DOM buttons aligned to hotspots.
- Keyboard focus order must reach Arena, Journey, character switcher, menu/settings, and language.
- Screen-reader labels must use locale strings.
- Reduced motion must stop ambient effects and camera drift.
- If WebGL/canvas initialization fails, show a static field preview or old home start card, not a blank page.

### Localization

The hub must not regress the language issues already seen in production:

- locale comes from the same source as the rest of the app;
- no hardcoded English inside map metadata;
- map stores only `labelKey`;
- Journey modal, Arena label, tooltips, and fallback errors are all localized;
- language switching updates overlay text without recreating the Phaser scene unless required.

### Telemetry And Debugging

Add lightweight client logs/metrics for:

- home field initialized;
- renderer fallback used;
- asset load failure;
- Arena hotspot activated;
- Journey hotspot activated;
- time from home visible to Arena activation;
- duplicate activation blocked.

Keep logs privacy-safe. Do not store raw movement paths unless there is a specific product need.

### Rollout

Ship behind a config flag first:

```text
HOME_FIELD_ENABLED=true
HOME_FIELD_RENDERER=phaser
HOME_FIELD_FORCE_FALLBACK=false
```

Production rollout order:

1. deploy assets/metadata/scripts only;
2. enable static preview for internal testing;
3. enable Phaser hub for a small production slice;
4. keep fallback dashboard path for at least one release;
5. remove old primary home only after home-to-arena telemetry is healthy.

## Implementation Phases

### Phase 1 — Plan And Asset Direction

- Add this plan.
- Create asset prompt worksheet under the same doc.
- Decide camera style and map dimensions.
- Decide renderer, coordinate system, asset budget, and rollout flag names from **Pre-Implementation Decisions**.
- Pick initial art generation batch:
  - 8 terrain tiles
  - 8 props
  - 2 exits
  - 1 chibi for active default character as proof of style

Completion condition:

- Plan approved and first asset list locked.
- Renderer and metadata coordinate system are locked before scene code begins.

### Phase 2 — Asset Generation Pipeline

Follow **Agent Implementation Flow** Step 1 through Step 8. Do not build the home-field UI until the first contact sheet and map preview exist.

- Add scripts:
  - `app/scripts/next-home-field-image-prompts.js`
  - `app/scripts/produce-home-field-assets.js`
  - `app/scripts/generate-home-field-contact-sheet.js`
  - `app/scripts/validate-home-field-assets.js`
- Add package aliases:
  - `game:home-field:next`
  - `game:home-field:produce`
  - `game:home-field:sheet`
  - `game:home-field:validate`
- Generate the minimum proof batch first, then expand only after review.
- Generate static base assets first, but reserve metadata fields for animation frames and effect emitters from the start.
- For animated assets, produce still preview contact sheets plus an animation manifest; do not rely on GIFs as production runtime assets.
- Workspace:
  - raw: `.agent/home-field-workspace/raw/`
  - processed: `.agent/home-field-workspace/processed/`
  - review: `.agent/home-field-workspace/review/`
- Production assets:
  - `web/public/home-field/...`

Completion condition:

- Contact sheet shows all v1 field assets.
- Map preview shows final intended placement, collisions, hotspots, and mobile safe frame.
- Animation metadata validates for any asset that declares frames.
- Assets load as `<img>` without broken image warnings.

### Phase 3 — Static Hub Scene

- Create `HomeFieldScene` component.
- Render terrain background, props, top-row Arena exit, top-row Journey exit, selected chibi standing in lower-middle spawn.
- Use the same map/object metadata shape planned for the animated renderer.
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

### Phase 4.5 — Renderer Decision Gate

Decide whether to keep the DOM renderer or move to PixiJS/Phaser before investing in rich animation.

Choose **PixiJS** if:

- the hub needs animated props, particle-like spores, lighting overlays, and smooth sprite batching;
- collision remains simple rectangles/polygons;
- Vue should keep most state and UI ownership.

Choose **Phaser** if:

- the hub needs true animated tilemaps, object layers, collision layers, path/camera tooling, map transitions, or multiple explorable areas;
- we expect Journey to become a real exploration mode;
- future field gameplay may include interactable NPCs, pickups, tasks, or scripted events.

Decision inputs:

- first contact sheet quality;
- number of animated objects visible at once;
- whether map should be authored in Tiled-style layers;
- performance on Telegram Mini App mobile viewport;
- cost of keeping accessible buttons over the canvas.

Completion condition:

- Renderer choice documented in this plan or a follow-up ADR.
- If PixiJS/Phaser is chosen, add package/dependency and a minimal renderer spike before migrating the whole home screen.

### Phase 5 — Animated Tilemap And Effects Pass

- Add frame-based animation support for:
  - chibi idle/walk;
  - Arena shimmer/flicker;
  - Journey rustle;
  - path/mycelium pulse;
  - subtle field spores.
- Respect reduced motion:
  - disable background loops;
  - keep only essential chibi movement feedback;
  - avoid flashing/pulsing loops.
- Add performance budget:
  - target 60fps on desktop;
  - acceptable 30fps on mid mobile;
  - no layout thrash in frame loop;
  - no unbounded particle counts.

Completion condition:

- Animated scene remains responsive on mobile.
- Reduced-motion mode is calm and still navigable.
- Initial viewport still shows both top entrances and the selected chibi.

### Phase 6 — Dashboard Migration

- Move existing roster/run history/leaderboard/friends widgets into:
  - compact field overlays;
  - bottom drawer;
  - side drawer on desktop.
- Remove duplicated "Start Game" card once Arena interaction is reliable.

Completion condition:

- Home no longer reads as a dashboard, but all old home functions remain reachable.

### Phase 7 — Tests And Production Hardening

- Update `docs/user-flows.md` Flow B Step 1 to describe the field hub.
- Add metadata validation coverage:
  - schema/version required;
  - all asset IDs unique;
  - all `assetId` references exist;
  - all hotspots have localized `labelKey`s;
  - all animation frame dimensions divide spritesheet dimensions;
  - all collision/hotspot rectangles are inside world bounds.
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
- Add animation/performance checks:
  - frame loop pauses when scene unmounts;
  - no duplicate animation loops after route changes;
  - reduced-motion disables ambient effects;
  - canvas/DOM scene does not exceed expected node/sprite count.
- Add fallback checks:
  - forced fallback flag shows the old reliable start/resume path;
  - simulated asset-load failure does not blank the home screen;
  - duplicate Arena activation does not create two runs.

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
- DOM rendering can get expensive if every grass tile is a DOM node. For prototype, use a precomposed/repeating terrain layer and reserve DOM nodes for interactive props, exits, and the chibi.
- Animated tilemaps/effects can make a DOM prototype feel brittle. Treat DOM as a composition proof, not as the guaranteed production renderer.
- Canvas/engine accessibility needs extra care: keep real DOM buttons for Arena/Journey and overlays even if the world itself becomes canvas-rendered.

## Recommended Next Step

Start with a short implementation-prep task before generating art:

1. Add metadata schemas and validation script stubs.
2. Add `.agent/home-field-workspace/` to `.gitignore`.
3. Add `HOME_FIELD_ENABLED`, `HOME_FIELD_RENDERER`, and fallback config plumbing.
4. Create a map preview script that can render rectangles/placeholders before final art exists.
5. Lock the first map's pixel world size and initial camera safe frame.
6. Then generate one grass base tile.
7. Generate one mushroom cluster prop.
8. Generate Arena arch.
9. Generate Journey under-construction gate.
10. Generate one selected-character chibi idle-down sprite.
11. Generate one tiny animated-effect proof, preferably Arena shimmer or spore motes.
12. Build a contact sheet and an animation manifest for review before coding movement.

This keeps the riskiest part, visual direction, visible early before we rewrite the home UI.
