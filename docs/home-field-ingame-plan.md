# Home Field In-Game Hub Plan

> **Reading guide.** This is the planning document for the Home Field hub. It records the locked decisions and the implementation path. When in doubt:
> - **What the system must do**: see the **Renderer Contract**, **Locked Decisions**, **Telegram Integration**, **Loading And State UX**, and **Locale Strategy** sections below — those are the authoritative contracts.
> - **Current asset-generation contract**: see `app/shared/home-field/README.md`, `docs/home-field-imagegen-requirements.md`, `docs/home-field-agent-flow.md`, `docs/home-field-scale-contract.md`, `docs/home-field-tileset-contract.md`, and `docs/home-field-chibi-candidate-contract.md`. Those newer files supersede older prompt-flow details in this plan.
> - **How we got here**: the **Research Findings**, **Game UX Research Conclusions**, and **Visual Concept** sections are background; treat them as design rationale, not as live contracts.
> - **What to build next**: the **Implementation Phases** and **Agent Implementation Flow** sections drive sequencing.
>
> When per-step "deferred" bullets appear, they are point-in-time snapshots. As contracts harden after Phase 0, extract them into a dedicated reference doc (`docs/home-field-contract.md`) and treat that as the live source of truth — this plan describes how we got there.

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

Locked decisions (resolved in Phase 0 before scene code or imagegen):

- **Camera style: 2.5D top-down / gentle isometric.** Supports walking, tile maps, readable exits on mobile, and the "home hub with doors" mental model. Other styles (true isometric, side-view diorama) are out of scope for v1.
- **Chibi art: separate generated sprites, not derived from existing portraits.** Movement and direction states must be clean.
- **Dashboard composition: minimal overlay plus side/bottom drawer.** Field is the primary screen; the legacy dashboard is migrated into drawers in Phase 5 and removed once Arena conversion telemetry is healthy.
- **Renderer: Phaser.** All three of the renderer-decision triggers (directional chibi, hotspot/collision objects, animated spritesheets) are confirmed requirements; locked in [`docs/adr/0001-home-field-renderer.md`](../docs/adr/0001-home-field-renderer.md) when the ADR lands. DOM/Node-canvas tools are limited to contact sheets and map previews and may not host a walkable hub.
- **Coordinate system: pixel world, tile-aligned.** World size is `1792 × 1024` (7 × 4 tiles of 256 px). Normalized `0..1` coordinates are docs/proposal-only.
- **Anchor convention: ground entities anchor at feet** (e.g. `{ x: 0.5, y: 0.95 }` for chibi/props), **floating effects anchor at visual center** (e.g. `{ x: 0.5, y: 0.5 }`).
- **In-world text: rendered, not baked.** No per-locale banner PNGs; the renderer draws `labelKey` text over an art-only signpost (`signpost_blank.png`, `arena_arch_art.png`, `journey_gate_art.png`).
- **Hub branch policy: direct-to-main.** Per `mushroom-master/AGENTS.md` the surface uses direct-to-main, not agent feature branches; commit completed work on `main` unless the user requests otherwise.

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
- For v1, **all walkable runtime code is Phaser** (locked above). DOM/Node-canvas is used only for review tooling (contact sheets, map previews, screenshot evidence).
- For responsive behavior, treat the field as a fixed **world coordinate system** (`1792 × 1024` pixels) with a viewport camera. Render by converting world coordinates to screen coordinates using scale + camera offset.
- For mobile, avoid requiring scroll to discover exits. The initial camera must frame the lower chibi and both upper exits inside the declared `mobileSafeFrame`.
- For desktop, do not simply stretch the whole field. Preserve the same composition and reveal extra side scenery or side drawers.
- Phaser's Tiled object-layer model is a strong fit because Arena/Journey exits, spawn points, collision zones, camera anchors, signs, and effect emitters are naturally object-layer data.
- Phaser's frame animation model fits chibi idle/walk states and ambient prop loops, as long as generated spritesheets declare exact frame dimensions.
- Tiled custom properties can later author `action`, `labelKey`, `disabled`, `requires`, `ambient`, and `collision` data directly in the map. Mirror that shape in JSON now so a Tiled `.tmx` source can drop in later without code changes.

Final renderer decision (locked):

- **Production renderer is Phaser.** All three decision triggers are required by the spec; carrying a PixiJS alternative through later phases only creates "which renderer is this code for?" ambiguity.
- **DOM/Node-canvas tools** are used only for: the asset contact sheet, the map preview, the per-character review crops, and screenshot evidence. They never host a walkable hub.
- **Asset metadata stays Tiled-compatible** from the first agent pass; the JSON shape can be hand-authored now and migrated to Tiled `.tmx` source later without code changes.
- The locked decision is recorded in [`docs/adr/0001-home-field-renderer.md`](../docs/adr/0001-home-field-renderer.md), landed in Phase 0.

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

The production renderer is **Phaser** (locked above). DOM/Node-canvas is reserved for non-runtime tooling only:
- contact sheets (`generate-home-field-contact-sheet.js`)
- map preview (`map-preview.png`)
- screenshot evidence in tests
- review crops

The runtime scene is never DOM-based; do not build a "DOM prototype" walkable hub.

Production shape (mirrors the existing `.js` `defineComponent` convention used by `web/src/pages/HomeScreen.js`):

```text
web/src/pages/HomeScreen.js                  # existing; renders <HomeFieldCanvasScene/> when HOME_FIELD_ENABLED
web/src/components/HomeFieldCanvasScene.js   # Vue 3 component that mounts Phaser via dynamic import + <Teleport>'d overlays
web/src/renderer/phaser-app.js               # boots Phaser.Game; lazy-loaded via dynamic import()
web/src/renderer/home-field-scene.js         # HomeFieldPhaserScene (preload/create/update)
web/src/renderer/home-field-camera.js
web/src/renderer/home-field-input.js
web/src/renderer/home-field-effects.js
web/src/renderer/home-field-state.js         # XState chart (see State Machine below)
app/shared/home-field/home-field-map.json
app/shared/home-field/home-field-assets.json
app/shared/home-field/home-field-prompts.json
app/shared/home-field/home-field-validator.js
```

Boundaries:

- Vue owns app state, overlays, modals, locale strings, navigation, and the DOM overlay buttons that mirror Arena/Journey hotspots.
- Phaser owns world sprites, animations, camera, collision, input, and effect emitters.
- Vue mounts/unmounts the Phaser scene; the scene listens for high-level events (`enableArena`, `dailyLimitReached`, `localeChanged`) and emits `arenaActivated`, `journeyActivated`, `errorFallback`.
- DOM overlay buttons (Arena, Journey, character switcher, settings) are real `<button>` elements positioned over canvas hotspots using `<Teleport>` so focus order stays sane.

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

- The Phaser canvas mounts inside a Vue wrapper with `position: relative; overflow: hidden; contain: strict;`. `contain: strict` isolates layout/paint of the canvas region from the rest of the app.
- The renderer loads one **packed atlas** (`home-field/atlases/main.json` + `main.png`) plus per-character chibi spritesheets — never a flood of individual `<img>` tags. Atlases are built with `free-tex-packer` (CLI), output committed under `web/public/home-field/atlases/`.
- Z-order rule: `sortKey = y + anchor.y * height`; ties broken by `id`. See the **Renderer Contract** section for the full spec.
- Exit hotspots are real `<button>` elements outside the canvas, positioned over canvas world points via a `worldToScreen()` helper. `pointer-events` is `none` on cosmetic overlays so canvas taps reach the scene.
- Animated props are declared as named animation states in `home-field-assets.json` with `stillFrameIndex` for the reduced-motion fallback. Renderer plays the loop normally, or freezes on `stillFrameIndex` when `prefers-reduced-motion` matches.
- For high-DPI screens, the canvas uses `resolution: window.devicePixelRatio` (clamped to ≤ 2 to bound memory) so 256px tiles stay crisp on Retina without doubling texture cost.

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

Why Phaser is locked from Phase 0 (not deferred to a later gate):

- Visual direction risk is addressed by Phase 2's **map preview** and **contact sheet** — both produced as still images via Node-canvas tooling, not by a DOM hub. The visual proof comes from those artifacts, not from a throwaway runtime renderer.
- Building a DOM walkable hub now and migrating later is the single largest source of churn in this kind of work: input handling, z-order, collision, animation, and accessibility all change shape between renderers.
- All three renderer-decision triggers (directional chibi, hotspot/collision objects, animated spritesheets) are confirmed v1 requirements.
- The first scene code that ships is the Phaser spike. The decision gate is satisfied; no second renderer is considered.

## Renderer Contract

This section is the authoritative contract for how the runtime renderer interprets metadata. Any agent implementing scene code, tests, or asset processing must follow it.

### Dependency And Bundle Strategy

- **Phaser version**: pin `phaser@3.88.x` in `package.json` (caret-free). Phaser breaks API on minor bumps; the validator and renderer contract assume 3.88.
- **Bundle**: Phaser is loaded via a **dynamic `import()`** inside `HomeFieldCanvasScene.js` so it ships in its own code-split chunk. The home-field route is the only entry point that fetches it; other screens are unaffected by the ~700 KB cost.
- **Import path**: `const Phaser = (await import('phaser')).default;` — uses the ESM entry; bundler should tree-shake unused modules. Confirm Vite/Webpack output has Phaser in a chunk named `home-field-renderer.*.js` after the first build.
- **Renderer type**: `type: Phaser.AUTO` — Phaser auto-selects WebGL, falls back to Canvas if WebGL init fails. On Canvas fallback, log `home_field_initialized.renderer = "canvas"` so we can monitor WebGL-failure rates per platform.
- **Atlas packer**: `free-tex-packer-core@0.4.x` (dev dependency); runs via `produce-home-field-atlas.js`. Atlas output (`web/public/home-field/atlases/main.png + .json`) is **committed**, not built at deploy time — mirrors the artifact/season pipelines.
- **State machine**: `xstate@5.x` (production dependency) for `home-field-state.js`. `@xstate/inspect` for dev only.

### Coordinate System

- **World units are pixels.** Production JSON stores integer pixel coordinates only.
- **World size: `1792 × 1024`** (7 × 4 tiles of `256 px`). Both axes are exact multiples of `tileSize`.
- **`tileSize: 256`** is fixed for v1. Terrain layers use a grid of `(7, 4)` cells.
- Normalized `0..1` coordinates appear only in design proposals/diagrams in this doc, never in shipped JSON.
- World-to-screen conversion happens once per frame in `home-field-camera.js`: `screenX = (worldX - camera.x) * zoom + viewport.w / 2`.

### Anchor Semantics

- `anchor: { x, y }` is a **fractional pivot** of the asset's intrinsic bounding box (`0,0` = top-left of the source PNG, `1,1` = bottom-right). When the renderer places an object at world `(wx, wy)`, the asset is positioned so its anchor sits at that point.
- Conventions:
  - **Ground entities** (chibi, mushroom props, signposts, gates): `{ x: 0.5, y: 0.95 }` — feet/base of the visual silhouette. The renderer treats this point as the "world position" for z-ordering and collision.
  - **Floating effects** (spore motes, portal shimmer): `{ x: 0.5, y: 0.5 }` — visual center. Effects do not contribute to z-order.
  - **Terrain tiles**: `{ x: 0, y: 0 }` — anchored at top-left of the tile cell.
- Anchors are validated by `validate-home-field-assets.js`: each asset's `type` must match an allowed anchor convention; off-convention values fail validation.

### Z-Ordering And Layer Order

Layer depth (Phaser `setDepth()` values):

| Depth | Layer | Notes |
|---|---|---|
| 0 | terrain tile layer | base grass + path tiles |
| 5 | path overlays | spore glow, mycelium pulse (animated, below objects) |
| 10 | objects layer | props, exits, chibi (sorted internally by `sortKey`) |
| 20 | effects layer | spore motes, portal shimmer |
| 30 | foreground props | overhanging caps, edge mushrooms that should occlude the chibi |
| 1000 | DOM overlay buttons | not in canvas; outside Phaser via `<Teleport>` |

Within the objects layer:

- Each object's `sortKey = round(y + anchor.y * height)`.
- Stable sort; ties broken by lexicographic comparison of `id`.
- The renderer re-sorts the objects layer on every chibi movement frame (`scene.children.depthSort` after updating `setDepth(10 + sortKey * 1e-6)`).

### Camera Math

- The camera centers on `cameraCenter` (initialized to `camera.initialTarget` from `home-field-map.json`).
- **Zoom formula**: `zoom = max(viewport.w / safeFrame.w, viewport.h / safeFrame.h)` clamped to `[0.5, 2.0]`.
  - `max` (not `min`) ensures the entire `mobileSafeFrame` is always inside the viewport — overflow on the *other* axis is cropped instead of showing empty world edges.
- **World-to-screen**: `screen = (world - cameraCenter) * zoom + viewportCenter`.
- **Camera bounds**: `cameraCenter` is clamped so the viewport never shows world edges; min/max derived from `world.width/height` and current zoom.
- **Camera follow**: when the chibi exits a `200 × 200` deadzone around `initialTarget`, the camera lerps toward the chibi at `lerp = 0.08` per frame; when the chibi returns inside the deadzone, the camera lerps back to `initialTarget`.
- **Wide desktop** (`viewport.w / viewport.h > 1.75`): world sits centered with empty Mycelium-fog gutters (CSS `background: url(/home-field/edge_fog.png) repeat-x`); world itself is not stretched.

### Tap-To-Move Feedback

- On `pointerdown` inside the field, the renderer immediately plays a single-shot 200ms ripple sprite at the tap world position before the chibi starts moving.
- Sprite: `effects/tap_ripple.png` (asset id `tap_ripple`, animated 4-frame at 20 fps, no loop, anchor `{0.5, 0.5}`).
- Ripples are not z-sorted; they render at depth 25 (above objects, below effects).
- Reduced-motion mode replaces the ripple with a static cross (frame `0` only).
- This is mandatory — without visual feedback, taps near collision feel broken (the chibi appears to ignore the input).

### Collision And Pathing

- **Chibi collider**: a circle of radius `28 px` (≈ one-eighth of a tile) centered at the chibi's feet anchor.
- **Collision rectangles** from `home-field-map.json` are axis-aligned (AABB). Polygons are not supported in v1.
- **Movement**: on `pointerdown` (or arrow/WASD keypress), the controller sets a `target` world point. Each frame the chibi advances along the straight line from current position to target at fixed world speed (`speed = 240 px/sec`), scaled by `delta` from `update(time, delta)`.
- **Stop conditions**: (a) target reached within `4 px` tolerance; (b) chibi collider intersects any collision AABB *after* the step — in that case, the chibi rolls back the step component(s) that caused the collision, stops at the contact boundary, and clears `target`.
- **No sliding, no pathfinding.** If a prop sits between the chibi and the tap target, the chibi stops at the prop. The map must keep the line between spawn and Arena clear.
- **Hotspot activation**: when the collider overlaps a hotspot AABB, the renderer emits `nearHotspot(id)`. Vue surfaces the corresponding DOM button as the active CTA. Activation requires an explicit click/tap/keypress, not proximity alone.

### Reduced Motion

- The renderer subscribes to `matchMedia('(prefers-reduced-motion: reduce)')` and to the app's `player_settings.reduced_motion` flag (whichever is more restrictive wins).
- In reduced-motion mode:
  - All ambient loops (spore motes, portal shimmer, path pulse) freeze on their declared `stillFrameIndex` (default `0`).
  - Chibi walk animation is replaced by an instant teleport to the target (no walk cycle), preserving collision behavior.
  - Camera bias is disabled; camera stays at `initialTarget`.

### Asset Versioning And Cache-Busting

- `home-field-assets.json` includes a top-level `version` integer; bumping requires a fresh manifest hash.
- Build pipeline computes `assetVersion = sha1(home-field-assets.json + home-field-map.json).slice(0,8)` and exposes it to the renderer.
- The renderer fetches every PNG/JSON as `/home-field/<file>?v=<assetVersion>`. Telegram WebView and CDN caches will revalidate on every meaningful asset change.
- Atlases follow the same pattern (`/home-field/atlases/main.png?v=<assetVersion>`).

### Memory And Lifecycle

- The Phaser game instance is **created on mount** of `HomeFieldCanvasScene.js` and **destroyed on unmount**: `scene.shutdown()` → `game.destroy(true /* removeCanvas */)`.
- Texture cache is flushed on destroy so navigating Home → Arena → Home does not retain home-field textures during a battle.
- The renderer pauses (`scene.scene.pause()`) when `document.visibilityState === 'hidden'` and resumes on `visible`. Chibi mid-walk preserves its `target` and continues from its current position on resume.
- **Save-on-exit**: an unload handler (`window.addEventListener('beforeunload', ...)` + Telegram `viewportChanged` going to height 0) flushes the chibi position to localStorage immediately, in addition to the normal save-on-activation/save-on-unmount triggers. Without this, closing Telegram mid-walk drops the position.
- **localStorage key**: `mb.homeField.position.<playerId>.<mushroomId>` → `{ x, y, facing }`. Quota errors are caught and silently dropped (next session falls back to spawn).
- **Touch-action**: `touch-action: none` is set on the Phaser `<canvas>` element only, not the parent — this prevents the canvas from triggering page scrolls while keeping drawer scrolling intact.
- **Vue HMR**: dev builds wrap the dynamic Phaser import in a module-level singleton check; HMR reload tears down the existing `Phaser.Game` instance before re-importing. Otherwise multiple game loops stack on every save.

### Schema Validation At Boot

- On mount, the renderer validates both JSON files with `app/shared/home-field/home-field-validator.js` (plain-JS field checks, mirrors the existing artifact pipeline's `checkProvenance` pattern) before booting Phaser.
- On validation failure, the renderer emits `errorFallback` with the validation error and Vue shows the legacy dashboard start/resume path (`HOME_FIELD_FORCE_FALLBACK` behavior).
- Validation also runs in CI via `npm run game:home-field:validate`.

## Animated Tilemap And Effects Direction

Assume the future hub should support animation. Even if v1 ships static, assets and metadata should be authored as if animation will arrive.

## Tilemap Composition Requirements

The field must be assembled from **tilemap layers plus object layers**, not generated as a single background picture.

Terrain assets are strict tile cells:

- each terrain PNG is one reusable `256x256` tile cell;
- grass/path/border tiles must be full-bleed ground cells;
- terrain tiles must have no horizon, sky, vignette, scene focal point, prop cluster, exit, sign, or character;
- terrain details are small ground texture details only, and they must be sparse enough to survive repetition;
- grass tiles must use low-frequency, intentional broad patches; dense AI texture, realistic grass-blade detail, and unique center highlights fail review even if the isolated tile looks attractive;
- every terrain tile must be reviewed as a `3x3` repeated patch in the contact sheet;
- every accepted proof tile must also be reviewed inside `/home-field-preview` or the map preview at the mobile and desktop screenshot viewports;
- a terrain tile that looks good alone but creates a visible wallpaper/focal pattern when repeated fails review.

Path and edge tiles need connector rules:

- horizontal path tiles must connect west/east at the same Y position;
- connector width and Y position are part of the tile contract, not a visual suggestion;
- glow/pulse path variants must align with the base path connector;
- blocked-edge tiles should be repeatable border cells and not full forest scenes;
- future corner/T-junction/autotile variants should follow Tiled/Wang-terrain thinking instead of freehand one-off illustrations.

Object-layer assets are separate sprites:

- mushroom clusters, lanterns, branches, signs, Arena arch, Journey gate, effects, and chibi are never baked into terrain;
- object sprites use transparent backgrounds and bottom-center anchors;
- collision/hotspots live in `home-field-map.json`, not in the terrain pixels;
- map preview must place object sprites on top of terrain tiles so scale/composition is reviewed as a field.

Agent review rule:

- Before any asset batch is accepted, the official contact sheet must show terrain repeated as tiles and object sprites separately. The agent must regenerate terrain if it reads as full-screen art, dense texture, wallpaper, or a pretty standalone illustration instead of a map cell.
- Deterministic proof assets are allowed only as `needs_review` or `placeholder` scaffolding for layout, repeatability, and screenshot tests. Production approval requires painterly game-art quality, `status: "approved"`, and a checked-in review row with `accepted: true`: organic hand-authored shapes, no visible procedural/math patterns, no developer-placeholder geometry, and no generic AI texture.
- The liked forest-floor direction is: dark muted green top-down ground, soft painterly tonal variation, separate rounded bush masses, tiny sprouts, and sparse warm motes. Terrain captures only the quiet walkable ground; bush masses and readable foliage stay as transparent object-layer props.

Research anchors:

- [Tiled terrain/Wang workflows](https://docs.mapeditor.org/en/latest/manual/terrain/) model maps as neighbor-compatible terrain cells; Mushroom Battles follows that mental model even before a `.tmx` source exists.
- [Phaser Tilemap](https://docs.phaser.io/api-documentation/3.88.2/class/tilemaps-tilemap) and [ObjectLayer](https://docs.phaser.io/api-documentation/4.0.0/class/tilemaps-objectlayer) APIs separate tile layers from object layers; Mushroom Battles terrain stays in tile layers, while Arena/Journey/chibi/props/effects stay in object and sprite layers.

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
  "anchor": { "x": 0.5, "y": 0.95 },
  "animations": {
    "idle": {
      "src": "/home-field/exits/arena_mushroom_arch_idle.png",
      "frameWidth": 512,
      "frameHeight": 512,
      "frames": 8,
      "fps": 8,
      "loop": true,
      "stillFrameIndex": 0
    }
  }
}
```

`stillFrameIndex` is the frame shown when reduced motion is active. It must be in `[0, frames - 1]`; the validator enforces this and rejects assets that declare animations without one.

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

Terrain compatibility is now explicit, not implied by the asset name. The live connector vocabulary and required tile families live in [`docs/home-field-tileset-contract.md`](./home-field-tileset-contract.md). Every terrain asset in `home-field-assets.json` declares `tile.connectors.n/e/s/w`; generation prompts must obey those tokens before a PNG can be accepted.

The strict tile adjacency gate is:

```bash
npm run game:home-field:validate -- --check-connectors
```

The current proof map is wired with explicit path-end and side-border transition assets so this gate should pass. Treat any future failure as a terrain-family design task, not as a reason to hide transitions inside mid-path or base-grass tiles.

## Visual Concept

Scene:

- Lush green grass clearing inside a fungal forest.
- Soft clearing in the lower-middle for the selected chibi's spawn.
- Mushroom clusters and root paths around the edge.
- Two readable exits:
  - **Arena / Mushroom Battles**: warm-lit mushroom arch, battle banners, spore lanterns, placed at the top-right or top-center-right.
  - **Journey**: mossy path or wooden sign with construction rope, dim lantern, "soon" marker, placed at the top-left or top-center-left.
- Title/signage should be in-world: carved mushroom signs, spore-lit plaques, not giant UI cards.
- Sign **art** is bitmap; sign **text** is rendered at runtime (Phaser BitmapText or DOM overlay) from the localized `labelKey`. Do not bake locale-specific text into PNGs — every new locale would require regenerating the banner art.
- Character starts below the exits in the lower-middle third, never hidden by panels.
- The top field line should read as "destination row"; the lower field should read as "player space".

Canon constraints from `docs/design-requirements.md`:

- World must read as Mycelium: organic, fungal-biological, spore-saturated, slightly bioluminescent.
- Palette can be greener than battle screens, but should include violet, amber, bone, and fungal neutrals to avoid generic lawn-game visuals.
- Mushroom details should feel alive and integrated, not decorative stock mushrooms.
- Chibi ears must remain elf ears when visible.

## Locale Strategy

The hub must not introduce per-locale baked-art coupling. Any new locale (EN, RU, future) should land by adding strings, not by regenerating PNGs.

- **All visible text is driven by `labelKey`** in `home-field-map.json`. The map stores keys; the renderer resolves them against the existing i18n catalog (the same one the rest of the app uses).
- **Sign art is text-free.** `arena_signpost_blank.png` and `journey_signpost_blank.png` provide the signpost shape; the renderer draws localized text over them using Phaser BitmapText (canvas) or a `<Teleport>`'d DOM label (HTML overlay). Prefer DOM overlay — it inherits the app's font, scales with i18n string length, and is screen-reader-accessible.
- **No `*_ru.png` / `*_en.png` assets.** The validator rejects asset IDs that end in `_<2-letter-locale>`.
- **Language switching does not recreate the Phaser scene.** The renderer subscribes to the locale store and re-renders text overlays only; world sprites, camera, and chibi position are preserved.
- **Required `labelKey` set for v1**:
  - `homeArenaExit` ("Mushroom Battles" / "Битвы грибов")
  - `homeArenaPickMushroom` ("Choose a mushroom" / "Выберите гриб")
  - `homeArenaDailyLimit` ("Daily limit reached" / "Дневной лимит исчерпан")
  - `homeArenaStarting` ("Starting…" / "Запуск…")
  - `homeArenaUnavailable` ("Arena unavailable" / "Арена недоступна")
  - `homeJourneyExit` ("Journey" / "Путешествие")
  - `homeJourneyUnderConstruction` ("Journey is under construction" / "Путешествие в разработке")
  - `homeFieldLoading` ("Preparing the field…" / "Готовим поляну…")
  - `homeFieldFallbackUseClassic` ("Use classic start" / "Использовать классический старт")

## Bootstrap API Contract

The hub needs a small addition to `/api/bootstrap` (defined in `app/server/services/game-service.js:getBootstrap`). No new tables, no new endpoints.

Response gains a single new top-level field:

```json
{
  "homeField": {
    "enabled": true,
    "renderer": "phaser",
    "forceFallback": false,
    "mapVersion": "home_field_v1",
    "assetVersion": "<8-char sha1 of map+assets json>"
  }
}
```

Source values:

- `enabled` = `process.env.HOME_FIELD_ENABLED === 'true'`
- `renderer` = `process.env.HOME_FIELD_RENDERER || 'phaser'` (only `phaser` is valid in v1)
- `forceFallback` = `process.env.HOME_FIELD_FORCE_FALLBACK === 'true'` (kill switch)
- `mapVersion` = `home-field-map.json` `version` field (currently `1`, prefixed `"home_field_v"`)
- `assetVersion` = computed at server boot as `sha1(home-field-map.json + home-field-assets.json).slice(0,8)`

Client behavior:

- When `homeField.enabled === false` or `forceFallback === true`: render the legacy dashboard, never mount Phaser.
- When `enabled === true`: render `<HomeFieldCanvasScene/>` inside `HomeScreen.js`; fetch assets at `/home-field/atlases/main.png?v=<assetVersion>` and `/home-field/characters/<mushroom_id>/spritesheet.png?v=<assetVersion>`.

Per-player override (support tickets, emergency rollback for one user) is **not** in v1. If needed it can be added later as `player_settings.home_field_disabled` without a schema migration.

## Telegram Mini App Integration

The hub runs inside Telegram WebView on iOS, Android, and Telegram Desktop. Treat the following as a contract, not as polish.

### Viewport And Safe Areas

- The renderer subscribes to `Telegram.WebApp.onEvent('viewportChanged', ...)` and reads `viewportStableHeight` (not `viewportHeight`) as the layout-stable height. Camera safe-frame calculations use the stable height so the chibi/Arena/Journey framing does not jump when Telegram's bottom sheet or keyboard opens.
- On `viewport_height < viewport_stable_height` (keyboard or in-app sheet open), the renderer treats this as a transient overlay; ambient loops pause to save battery, but layout does not reflow.
- CSS uses `env(safe-area-inset-*)` for overlay placement so the Arena/Journey DOM buttons are never under the iOS gesture bar or Telegram bottom chrome.

### Back And Main Buttons

- `Telegram.WebApp.BackButton` is wired to the active modal/drawer stack:
  - Journey modal open → BackButton closes the modal.
  - Drawer open (roster, settings, etc.) → BackButton closes the drawer.
  - Otherwise BackButton is hidden.
- `Telegram.WebApp.MainButton` is **not used** on the hub screen — the hub's primary CTAs are the in-world Arena/Journey hotspots, and a Telegram MainButton would duplicate or contradict them. The MainButton is reserved for the in-battle and post-battle screens that already use it.

### Theme And Color Scheme

- The hub reads `Telegram.WebApp.themeParams` on init and on `themeChanged`. Background, text, and overlay colors derive from theme params; the field art itself is theme-independent (always the lush green/violet canon).
- `colorScheme === 'dark'` does not invert the field art; only the surrounding overlays/drawers respect dark mode.

### Frame Rate And Performance

- Telegram iOS WKWebView caps animation at 30 fps on some builds. The renderer targets **30 fps as the design baseline** and treats 60 fps as a bonus; ambient loops are authored at 8 fps so the difference is invisible.
- On `Telegram.WebApp.platform === 'android'` and `platform === 'tdesktop'`, the renderer enables 60 fps; on `ios`, it clamps to 30 fps via `Phaser.Core.TimeStep.targetFps`.

### Initialization Order

- `Telegram.WebApp.ready()` and `Telegram.WebApp.expand()` are called before the Phaser scene mounts so `viewportStableHeight` is correct on first render.
- If `Telegram.WebApp` is unavailable (browser preview, Playwright in a regular browser context), the renderer falls back to `window.innerHeight` and assumes 60 fps.

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

## Loading And State UX

This section defines every visible state of the hub. Each is part of the UI contract and must be covered by screenshot tests.

### Loading

- On mount, before atlas/JSON load completes: a calm splash overlay shows the spore-lit Mycelium background with a thin progress bar (0–100%) and one localized line: "Preparing the field…" / "Готовим поляну…".
- Progress is reported by Phaser's `LoaderPlugin.on('progress', ...)`.
- Splash fades out only after `create()` runs and the chibi is placed at spawn.
- A hard `5 s` timeout triggers `errorFallback` even if Phaser is still loading; this prevents an indefinite blank state on slow networks.

### Ready (Idle)

- Chibi at spawn, both exits visible, ambient loops playing (or frozen if reduced motion).
- Localized name pill in top-left, settings/language icon in top-right.

### Near Hotspot

- Chibi collider overlaps Arena/Journey hotspot AABB.
- The corresponding DOM button transitions to "active CTA" state (slightly brightened, scaled to 1.05).
- Pressing Enter/Space activates the focused hotspot.

### Locked Arena States

Arena must communicate when it cannot be entered. The art is the same `arena_mushroom_arch.png` plus a state overlay:

| Reason | Visual cue | DOM button label |
|---|---|---|
| `noActiveMushroom` | Arch slightly desaturated, "?" silhouette under the arch | `homeArenaPickMushroom` ("Choose a mushroom") — routes to character picker |
| `dailyLimitReached` | Arch desaturated, small lock icon overlay, lanterns dimmed | `homeArenaDailyLimit` ("Daily limit reached") — disabled, opens explanation modal on tap |
| `startingRun` | Arch unchanged, button shows spinner | `homeArenaStarting` ("Starting…") — disabled to prevent duplicate activation |
| `assetMissing` | Arch hidden, neutral placeholder rectangle | `homeArenaUnavailable` — opens fallback modal with "Use classic start" button |

Each state has its own Playwright screenshot baseline.

### Journey Modal

- Tapping the Journey gate opens a localized modal: EN "Journey is under construction", RU "Путешествие в разработке". Modal has a single dismiss action; Telegram BackButton also dismisses it.

### Drawer Open

- Roster, leaderboard, friends, recipes, settings live in side/bottom drawers. While a drawer is open:
  - The Phaser scene pauses input (`scene.input.enabled = false`).
  - Ambient loops continue.
  - Telegram BackButton closes the drawer.

### Error Fallback

- Triggered by: schema validation failure, atlas load failure, WebGL init failure, or `HOME_FIELD_FORCE_FALLBACK=true`.
- Shows the legacy dashboard start/resume card on the same route — never a blank page.
- Logs `home_field_fallback` with `reason` (`schema`, `atlas`, `webgl`, `timeout`, `forced`).

### Single-Asset Failure

- One PNG fails to load (404, transparent-pixel corruption, etc.):
  - If the asset is critical (chibi, Arena arch, Journey gate, terrain base): treat as error fallback.
  - If the asset is decorative (one prop, one effect, one banner overlay): renderer continues without that object, logs `home_field_asset_failed` with `assetId` and `path`, and the validator must report the missing asset before the next deploy.

## Home Hub State Model

Client-only v1 state (pixel world coordinates, per the **Renderer Contract**):

```js
homeHub: {
  playerX: 896,          // pixel world X, defaults to spawn
  playerY: 760,          // pixel world Y, defaults to spawn
  cameraX: 896,          // pixel world X
  cameraY: 512,          // pixel world Y
  facing: 'down',
  targetX: null,
  targetY: null,
  activeHotspot: null,   // 'arena' | 'journey' | null
  arenaLockedReason: null, // null | 'noActiveMushroom' | 'dailyLimitReached' | 'startingRun' | 'assetMissing'
  cameraMode: 'home-default',
  introSeen: false,
  reducedMotion: false   // derived from prefers-reduced-motion ⊻ player_settings.reduced_motion
}
```

The state transitions in **Loading And State UX** are implemented as an [XState](https://xstate.js.org/) chart in `renderer/home-field-state.js`. Use XState because the transitions have asynchronous guards (Arena start/resume, daily-limit check) and concurrent regions (drawer open while chibi mid-walk); a hand-coded switch statement will leak edge cases. The chart definition is committed alongside the code so a chart diagram (via `@xstate/inspect`) can be regenerated for design review.

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
  terrain/                       # source per-tile PNGs (input to atlas packer)
  props/                         # source per-prop PNGs (input to atlas packer)
  exits/                         # source per-exit PNGs (input to atlas packer)
  characters/<mushroom_id>/      # per-character spritesheets (one folder per mushroom; lazy-loaded)
  effects/                       # source effect spritesheets
  atlases/
    main.png + main.json         # packed atlas (terrain + props + exits + effects), eager-loaded
  metadata/                      # home-field-map.json, home-field-assets.json
```

Atlas strategy:

- Production runtime loads **one packed atlas** (`atlases/main.png` + `main.json` in Phaser MultiAtlas format) for terrain, props, exits, and effects. Individual source PNGs under `terrain/`, `props/`, `exits/`, `effects/` are the inputs the atlas is built from; they are not loaded at runtime.
- The atlas is built by `app/scripts/produce-home-field-atlas.js` using `free-tex-packer-core` (CLI). Output is committed under `web/public/home-field/atlases/`.
- Per-character chibi spritesheets stay outside the main atlas — they're lazy-loaded per active mushroom so we don't ship every chibi to every player.
- Atlas regeneration is idempotent: rerunning the packer with no source changes produces a byte-identical output (sorted entry order, deterministic packing seed).

Tile format:

- PNG with transparent background where relevant; alpha channel required for all non-terrain assets.
- Terrain tiles: `256x256` (POT, GPU-friendly).
- Prop assets: `256x256` or `512x512` (POT), transparent.
- Exit assets: `512x512` (POT), transparent.
- Chibi sprites: `512x512` source poses → packed into `64x64` or `128x128` spritesheet frames per character. Frame size locked per character; the validator enforces it.
- Animated tiles/effects: spritesheet strips composed at production time; the atlas contains the strip as one packed image.
- No `.gif` or `.webm` under `web/public/home-field/`; the validator rejects them.
- Keep source/raw generation under ignored `.agent/home-field-workspace/`.

Chibi loading and budget:

- Only the **active mushroom's** chibi spritesheet is fetched on hub load (per the chibi loading rule above).
- Other mushrooms' chibi assets are fetched lazily: on roster open (preview thumbnail only) or on character switch.
- If a mushroom has no chibi PNG yet, the field uses a placeholder silhouette and logs `home_field_asset_failed` for visibility, but does not error out (chibi is critical → falls through to error fallback unless a placeholder exists; the placeholder is committed as `characters/_placeholder/spritesheet.png` and is the only chibi the validator allows as a fallback).

Chibi spritesheet layout (locked v1):

- Each character ships **one** spritesheet at `web/public/home-field/characters/<mushroom_id>/spritesheet.png`.
- Canvas size: `512 × 256` (8 cols × 4 rows of `64×64` frames).
- Phaser loader: `this.load.spritesheet(chibiKey, url, { frameWidth: 64, frameHeight: 64 })`.
- Row order (top to bottom): `down`, `up`, `left`, `right`.
- Column order (left to right) per row: 2 idle frames + 6 walk frames = 8 total. Idle column 0 is normal planted pose; idle column 1 is a little `1-3px` bob/squish pose that loops back to normal while staying upright, not a crouch or deep squat.
- Frame indices map to Phaser animation states:

| Animation | Direction | Phaser key | Frame range | fps |
|---|---|---|---|---|
| idle | down | `chibi_idle_down` | `0..1` | 2 |
| walk | down | `chibi_walk_down` | `2..7` | 10 |
| idle | up | `chibi_idle_up` | `8..9` | 2 |
| walk | up | `chibi_walk_up` | `10..15` | 10 |
| idle | left | `chibi_idle_left` | `16..17` | 2 |
| walk | left | `chibi_walk_left` | `18..23` | 10 |
| idle | right | `chibi_idle_right` | `24..25` | 2 |
| walk | right | `chibi_walk_right` | `26..31` | 10 |

- Diagonal movement uses `atan2(dy, dx)` quantized to the 4 cardinals; ties prefer horizontal (left/right are more visually distinct than up/down at 64×64).
- Target packed size: ≤ 100 KB per spritesheet after `pngquant --quality=70-85` + `oxipng -o4`.
- The validator enforces canvas dimensions, frame count, and pngquant freshness.

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
| `exits/arena_signpost_blank.png` | Art-only signpost beside Arena arch; text drawn at runtime from `labelKey` | no collision | static |
| `exits/journey_gate_under_construction.png` | Top-row Journey entrance | blocked visual, trigger in front | vine/rope rustle |
| `exits/journey_signpost_blank.png` | Art-only signpost beside Journey gate; text drawn at runtime from `labelKey` | no collision | static |

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
   - Defines asset IDs, output paths, dimensions, animation states, prompt keys, tile connector metadata, and validation requirements.
   - Must read [`docs/home-field-tileset-contract.md`](./home-field-tileset-contract.md) before changing or generating terrain.
   - Produces a missing-asset queue from metadata.
   - Acceptance gate: validation can fail clearly with actionable missing asset IDs.

3. **Art Generation Agent**
   - Uses imagegen only after metadata exists.
   - Generates the minimum proof batch, not the whole scene.
   - Generates one terrain family at a time: base grass, accent grass, horizontal path, vertical path, path ends/transitions, blocked edges, then object-layer props.
   - Rejects any terrain output whose visible edges do not match `tile.connectors`.
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
app/scripts/generation/next-home-field-image-prompts.js
app/scripts/generation/produce-home-field-assets.js
app/scripts/generation/generate-home-field-contact-sheet.js
app/scripts/checks/validate-home-field-assets.js
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
      "anchor": { "x": 0, "y": 0 },
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
  "anchor": { "x": 0.5, "y": 0.5 },
  "animation": {
    "frameWidth": 512,
    "frameHeight": 512,
    "frames": 8,
    "fps": 8,
    "loop": true,
    "stillFrameIndex": 0,
    "state": "idle"
  },
  "status": "missing"
}
```

Create `app/shared/home-field/home-field-map.json` second. It must use pixel world coordinates throughout (per the **Renderer Contract**):

```json
{
  "version": 1,
  "world": { "width": 1792, "height": 1024, "tileSize": 256 },
  "spawn": { "x": 896, "y": 760, "facing": "up" },
  "camera": {
    "initialTarget": { "x": 896, "y": 512 },
    "keepVisible": ["arena", "journey", "player"],
    "mobileSafeFrame": { "x": 72, "y": 80, "w": 1648, "h": 800 }
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
        { "id": "arena", "assetId": "arena_mushroom_arch", "x": 1280, "y": 256, "hotspotId": "arena" }
      ]
    },
    {
      "id": "effects",
      "type": "effectLayer",
      "z": 20,
      "effects": [
        { "assetId": "arena_portal_shimmer", "x": 1280, "y": 256, "state": "idle" }
      ]
    }
  ],
  "collision": [
    { "id": "topForest", "x": 0, "y": 0, "w": 1792, "h": 96 }
  ],
  "hotspots": [
    { "id": "arena", "action": "arena", "x": 1088, "y": 128, "w": 384, "h": 256, "labelKey": "homeArenaExit" },
    { "id": "journey", "action": "journey", "x": 320, "y": 128, "w": 384, "h": 256, "labelKey": "homeJourneyExit" }
  ]
}
```

Rules:

- `world.width` and `world.height` must each be exact multiples of `tileSize`.
- All `x`, `y`, `w`, `h` values in `camera`, `layers`, `collision`, and `hotspots` are integer pixel coordinates. No normalized `0..1` floats anywhere in production JSON.
- Keep the map JSON numeric and renderer-agnostic. Do not store CSS class names, Vue component names, or localized strings in map metadata.
- The schema validator enforces tile alignment for `tileLayer` entries (every `x` and `y` must be a multiple of `tileSize`).

### Step 2 — Prompt Queue Script

Add `app/scripts/generation/next-home-field-image-prompts.js`.

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
node app/scripts/generation/next-home-field-image-prompts.js --type terrain --limit 5
```

Recommended package alias:

```json
"game:home-field:next": "node app/scripts/generation/next-home-field-image-prompts.js"
```

### Step 3 — Generate Raw Images

Use imagegen for raw bitmap outputs.

Style anchor passing:

- The locked style anchor lives at `.agent/home-field-workspace/style-anchor.png`. Its **description** — palette hex codes, light direction, outline weight, shadow style, ambient mood — is committed to `app/shared/home-field/home-field-style-anchor.json` and templated into every prompt by `next-home-field-image-prompts.js`.
- If the imagegen tool supports inline reference images, pass the anchor PNG too; otherwise the text description in the prompt carries the constraint.
- The anchor is regenerated only when the canon direction in `docs/design-requirements.md` changes; otherwise it stays stable for the lifetime of the v1 batch.

Rules:

- Save raw images exactly at the `sourcePath`.
- Do not save raw images under `web/public`.
- For transparent assets, request transparent PNG when possible. If the generator returns a flat background, process it locally with the chroma-key helpers in `app/scripts/lib/bitmap-image-toolkit.js` (same path used by the artifact pipeline; do not reinvent).
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

### Step 3.5 — Record Provenance

Every approved app-facing PNG gets an entry in `app/shared/home-field/home-field-image-metadata.json`. Schema mirrors the artifact and season pipelines (`schemaVersion`, `generatedAt`, `status`, `policy`, `entryCount`, `metadataHash`, `entries[]`):

```json
{
  "schemaVersion": 1,
  "generatedAt": "<ISO date>",
  "status": "approved-production-baseline",
  "policy": {
    "runtimeUsesApprovedOnly": true,
    "temporaryCandidatesLocation": ".agent/home-field-workspace/",
    "productionImageLocation": "web/public/home-field/"
  },
  "entryCount": <int>,
  "metadataHash": "<hash>",
  "entries": [
    {
      "id": "grass_base_01",
      "status": "approved",
      "outputPath": "web/public/home-field/terrain/grass_base_01.png",
      "png": { "width": 256, "height": 256, "size": <bytes>, "sha256": "<hash>" },
      "asset": { "id": "grass_base_01", "type": "terrain", "promptKey": "terrain_grass_base_01" }
    }
  ]
}
```

Add `npm run game:home-field:provenance:generate` and `:provenance:check` aliases mirroring the artifact pipeline. The deploy gate (`game:home-field:release-check`) fails if any asset declared in `home-field-assets.json` is missing a provenance entry or has a stale sha256.

### Step 4 — Produce App-Facing Assets

Add `app/scripts/generation/produce-home-field-assets.js`.

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
"game:home-field:produce": "node app/scripts/generation/produce-home-field-assets.js"
```

### Step 5 — Validate Assets And Metadata

Add `app/scripts/checks/validate-home-field-assets.js`.

Validation should fail when:

- `outputPath` is missing for any required asset.
- PNG dimensions do not match metadata.
- Transparent props/effects have no alpha channel or no transparent padding.
- Terrain tile dimensions are not exactly `tileSize x tileSize`.
- Animated spritesheet dimensions do not match `frameWidth * frames` and `frameHeight`.
- `fps` is missing or outside a sane range (suggested `1..24` for ambient loops).
- `stillFrameIndex` is missing on any animated asset, or is outside `[0, frames - 1]`.
- Asset `anchor` is inconsistent with `type` (terrain ≠ `{0,0}`, ground ≠ `{0.5, ~0.95}`, effect ≠ `{0.5, 0.5}`).
- Asset ID ends in a 2-letter locale suffix (`_ru`, `_en`).
- `home-field-map.json` declares non-integer or negative coordinates.
- `world.width` or `world.height` is not a multiple of `tileSize`.
- A `tileLayer` entry's `x` or `y` is not a multiple of `tileSize`.
- `home-field-map.json` references unknown `assetId`s.
- Collision/hotspot rectangles are outside the world bounds.
- Spawn point is inside collision.
- Arena, Journey, and player spawn cannot all fit inside `camera.mobileSafeFrame` on initial render.

Expected command:

```bash
node app/scripts/checks/validate-home-field-assets.js
```

Recommended package alias:

```json
"game:home-field:validate": "node app/scripts/checks/validate-home-field-assets.js"
```

### Step 6 — Generate Review Contact Sheets

Add `app/scripts/generation/generate-home-field-contact-sheet.js`.

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
"game:home-field:sheet": "node app/scripts/generation/generate-home-field-contact-sheet.js"
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
| `grass_flowers_01` | terrain | yes |
| `path_dirt_straight` | terrain | yes |
| `path_spore_glow` | terrain | yes |
| `path_destination_row` | terrain | yes |
| `edge_roots_01` | terrain | yes |
| `edge_moss_rocks_01` | terrain | yes |
| `bush_cluster_dark_01` | prop | yes |
| `bush_cluster_light_01` | prop | yes |
| `leaf_sprout_01` | prop | yes |

This first proof set keeps grass terrain quiet and moves the readable bush/sprout shapes into the object layer. It exists to prove that the map can be assembled from small repeatable cells without losing the painterly forest mood. Do not generate all character chibis in the first pass; after terrain and foliage props pass contact-sheet and `/home-field-preview` review, validate the style with one active/default mushroom first.

### Step 9 — Phaser Scene Spike

After the first asset proof passes review, build the Phaser scene directly. There is no intermediate DOM prototype.

- Add Phaser as a dependency; pin the version in `package.json`.
- Pack the proof-batch assets into `web/public/home-field/atlases/main.png + .json` via `produce-home-field-atlas.js`.
- Render `home-field-map.json` in Phaser:
  - terrain tile layer from the proof-batch grass tiles (filling any gaps with `grass_base_01`);
  - object layer with Arena arch + Journey gate, anchored per the **Renderer Contract**;
  - one effect emitter (`spore_motes_loop`) using its `stillFrameIndex` when reduced-motion is active;
  - chibi at spawn with idle animation;
  - DOM overlay buttons for Arena/Journey via `<Teleport>`.
- Wire the camera safe-frame math against `Telegram.WebApp.viewportStableHeight` (or `window.innerHeight` in browser preview).

Completion condition:

- Screenshots at `390x844` (mobile) and `1440x900` (desktop) prove Arena, Journey, and chibi are all visible inside the mobile safe frame on first paint.
- Tap-to-move advances the chibi and stops at collision AABBs.
- `spore_motes_loop` plays normally; reduced-motion freezes it on `stillFrameIndex`.
- `home_field_initialized` logs once per session (sampled).
- No legacy dashboard migration yet — old dashboard sits behind a drawer.

### Step 10 — Agent Final Handoff Checklist

Before handoff, report:

- generated asset IDs;
- production output paths;
- raw workspace paths;
- contact sheet path;
- map preview path;
- animation sheet path;
- atlas path and packed size;
- validation command results;
- which `[Req 11-X]` E2E specs were exercised.

If anything is not generated, say exactly which asset IDs remain `missing`.

## Image Generation Prompt Templates

Use imagegen for bitmap art, not SVG, because the home screen should feel like a game scene with painterly assets.

Terrain prompt:

```text
Create a seamless 2D game terrain tile for Mushroom Battles: cute dark occult storybook fungal meadow, chunky moss and grass patches instead of realistic blade detail, tiny amber/violet spore glints, top-down 2.5D RPG hub style, flat-to-soft shaded cut-paper readability, no text, no UI, no characters, no hard sci-fi, no medieval stone floor. 256x256 square tile, seamless edges.
```

Mushroom prop prompt:

```text
Create a transparent-background 2D game prop for Mushroom Battles: [OBJECT], cute dark occult fungal storybook style, organic Mycelium world, chunky readable silhouette, moss, spores, candle-amber/violet bioluminescent accents, bold dark-plum/umber outline, readable at small size, 2.5D top-down RPG prop angle, centered object, no text, no character, no UI, transparent PNG.
```

Arena exit prompt:

```text
Create a transparent-background 2D game entrance prop for Mushroom Battles: an Arena entrance made from two giant living mushrooms forming an arch, warm amber spore lanterns, small blank battle banners, fungal roots, cute dark occult Mycelium storybook style, bold readable silhouette, inviting but combat-ready, 2.5D top-down RPG prop angle, no readable text, no characters, transparent PNG.
```

Journey under construction prompt:

```text
Create a transparent-background 2D game entrance prop for Mushroom Battles: a mossy path into a mushroom forest blocked by organic vine rope and small blank construction boards, whimsical but not modern, cute dark occult Mycelium storybook style, softly glowing spores, clearly reads as not available yet, 2.5D top-down RPG prop angle, no readable text, no characters, transparent PNG.
```

Chibi character prompt template:

```text
Create a transparent-background chibi game sprite for Mushroom Battles: [CHARACTER CANON SUMMARY], mushroom-elf heroine with visible elf ears if ears are shown, cute dark occult fungal storybook fantasy, oversized head and tiny body, bold readable silhouette, preserving signature silhouette and palette, 2.5D top-down RPG idle pose facing [DIRECTION], readable at 96px, clean dark-plum/umber outline, no text, no UI, transparent PNG.
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

### Renderer Decision (Locked)

**Renderer is Phaser, locked from Phase 0.** All four triggers below are confirmed v1 requirements, so the decision is no longer a gate:

- chibi has directional idle/walk sprites;
- Arena/Journey are collision/hotspot objects;
- ambient effects are animated spritesheets;
- map can grow later into Journey/home activities.

The decision is recorded in [`docs/adr/0001-home-field-renderer.md`](../docs/adr/0001-home-field-renderer.md). The ADR captures the alternatives considered (DOM, PixiJS, Phaser), the triggers, and the rejected migration path. Once the ADR lands, this section is the short summary; the ADR is the source of truth.

DOM/Node-canvas may only host: contact sheets, map preview, screenshot evidence, review crops. Not a walkable hub.

### Data Contract Freeze

Frozen contracts (validator enforces all of these; CI fails on violation):

- asset IDs are stable, lower_snake_case, no locale suffix (`*_ru`, `*_en` rejected);
- all public asset paths start with `/home-field/`;
- map uses **pixel world coordinates**, integers only; floats and percentages are rejected;
- `world.width` and `world.height` are exact multiples of `tileSize`;
- tileLayer entries are tile-aligned (`x % tileSize === 0`, `y % tileSize === 0`);
- every interactive object has `id`, `action`, `labelKey`, and a rectangular AABB hotspot;
- every animated asset declares `frameWidth`, `frameHeight`, `frames`, `fps`, `loop`, and `stillFrameIndex ∈ [0, frames-1]`;
- every asset declares `type` ∈ `{ terrain, prop, exit, character, effect }` and an `anchor` consistent with its type (see **Renderer Contract → Anchor Semantics**);
- `home-field-assets.json` carries a top-level `version` integer; bumping requires the contact sheet to be regenerated.

Changing the coordinate system mid-implementation is the highest-risk class of mistake for this kind of work. Pixel-only is non-negotiable.

### Schema Validation At Boot

- The renderer parses `home-field-map.json` and `home-field-assets.json` through the same validator the CLI uses. **No new schema-library dependency** — the existing artifact/season pipelines use direct field checks in plain JS (see `app/scripts/lib/bitmap-image-toolkit.js`'s `checkProvenance` pattern). Mirror that: one shared `app/shared/home-field/home-field-validator.js` exporting `validateMap(map)`, `validateAssets(assets)` returning `{ ok, errors[] }`.
- Validation failure routes the user to the error fallback and logs `home_field_fallback` with `reason: "schema"`.
- The same validator is used by `validate-home-field-assets.js` (CLI) and the runtime so CLI and runtime cannot diverge.
- CI runs `npm run game:home-field:validate` on every PR that touches `app/shared/home-field/**` or `web/public/home-field/**`.

### Asset Budget

Budgets are computed against the **atlas-first** asset plan, not against individual PNGs. The runtime fetch is one atlas PNG + one atlas JSON + the active chibi spritesheet.

Initial download budget (single eager fetch, before chibi walks):

| Item | Target | Notes |
|---|---|---|
| `atlases/main.png` | ≤ 800 KB | Packed: terrain (8 tiles), props (9), exits (2 art + 2 signposts), effects (4 spritesheets). pngquant + oxipng. |
| `atlases/main.json` | ≤ 30 KB | MultiAtlas frame map |
| Active chibi spritesheet | ≤ 100 KB | Packed 32 frames at `64x64`, pngquant. |
| `home-field-map.json` | ≤ 10 KB | |
| `home-field-assets.json` | ≤ 20 KB | |
| **Total eager fetch** | **≤ 1.0 MB** | Comfortably under the 1.5 MB ceiling. |

Per-frame source-PNG budgets (inputs to the packer, never shipped individually):

| Asset class | Source size | After pack+optimize contribution |
|---|---|---|
| Terrain tile (256×256) | ≤ 120 KB | ≈ 30–60 KB packed |
| Prop (256×256) | ≤ 150 KB | ≈ 40–80 KB packed |
| Exit (512×512) | ≤ 350 KB | ≈ 80–150 KB packed |
| Effect spritesheet (512×512, 4–8 frames) | ≤ 400 KB | ≈ 80–180 KB packed |

Runtime constraints:

- No more than **2 ambient animated loops visible at once** (e.g. spore motes + Arena shimmer). Additional loops are queued or pruned.
- Chibi walk animation counts as a third loop only when the chibi is actively moving.
- If atlas size exceeds 800 KB after pngquant+oxipng, split into `main_a` + `main_b` and load `main_b` on idle (after first paint).

If a generated image is beautiful but too large, downscale or split before shipping. Do not hide oversized assets behind cache assumptions.

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

Sampling rules (applied client-side, before POST to `/api/client-events`):

- `home_field_initialized`: **10% sample** (random per session). High-volume, low-signal individually.
- `home_field_arena_activated`, `home_field_journey_opened`: **100%** (low volume, high signal — conversion tracking).
- `home_field_fallback`, `home_field_asset_failed`, `home_field_duplicate_activation_blocked`: **100%** (error signal — never sample down).
- A single session writes at most **one** of each high-volume event in any 5-minute window (client-side dedupe via `sessionStorage`).

## Database And Persistence Plan

The home field should be **mostly static/versioned content**, not database content. The database should store player-specific state and analytics only.

### Existing Persistence Model

Current relevant tables:

- `players`: identity, Telegram fields, display name, `lang`, resources, rating, total stats.
- `player_settings`: persistent preferences such as `lang`, `reduced_motion`, battle speed, replay speed.
- `player_active_character`: selected mushroom/chibi source.
- `player_mushrooms`: owned/progressed mushrooms, portrait/preset choices, mycelium progression.
- `game_runs` / `game_run_players` / run tables: active and historical battle state.
- `client_events`: lightweight telemetry events already supported by `/api/client-events`.

Current `/api/bootstrap` already returns enough to initialize the home field:

- active player;
- settings and locale;
- active mushroom;
- progression and active portrait/preset data;
- active game run(s);
- daily battle limit;
- recent history.

### What Stays Out Of The Database

Do **not** store these in Postgres for v1:

- terrain tiles;
- prop/exits/effect definitions;
- map layout;
- collision rectangles;
- camera safe frames;
- animation frame metadata;
- image generation prompts;
- Phaser/Tiled object-layer metadata.

These belong in versioned files:

```text
app/shared/home-field/home-field-assets.json
app/shared/home-field/home-field-map.json
app/shared/home-field/home-field-prompts.json
web/public/home-field/**
```

Reason: these are build/content assets, not player data. Keeping them in files makes review, caching, rollback, CDN/static serving, and agent-generated contact sheets much simpler.

### What The Database Should Store In V1

V1 does not need a new table if the home field is just a navigation hub.

Use existing tables:

- selected chibi: `player_active_character.mushroom_id`;
- language: `player_settings.lang` and `players.lang`;
- reduced motion: `player_settings.reduced_motion`;
- active run/resume state: existing `game_run*` tables;
- Journey disabled state: static config/content, not user data;
- home-field telemetry: `client_events`.

Recommended client events:

| Event | Detail |
|---|---|
| `home_field_initialized` | `{ renderer, mapVersion, assetVersion }` |
| `home_field_fallback` | `{ reason }` |
| `home_field_asset_failed` | `{ assetId, path }` |
| `home_field_arena_activated` | `{ method: "hotspot"|"button"|"keyboard", activeRun: boolean }` |
| `home_field_journey_opened` | `{ method }` |
| `home_field_duplicate_activation_blocked` | `{ action: "arena" }` |

Do not store raw movement paths or per-frame position data.

### Optional Future Table

Add a table only if the hub gains durable personal state, such as tutorial completion, last hub position, unlocked decorations, Journey unlocks, NPC task state, or player-customized field layout.

Proposed table:

```text
player_home_state
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE
  map_version TEXT NOT NULL DEFAULT 'home_field_v1'
  last_x INTEGER
  last_y INTEGER
  last_facing TEXT NOT NULL DEFAULT 'down'
  tutorial_flags_json TEXT NOT NULL DEFAULT '{}'
  unlocked_nodes_json TEXT NOT NULL DEFAULT '{}'
  decoration_state_json TEXT NOT NULL DEFAULT '{}'
  updated_at TEXT NOT NULL
```

Rules:

- Do not create this table just to remember where the chibi stood after a navigation session.
- Add it when at least one user-visible durable feature requires it.
- If added, expose it through `/api/bootstrap` as `homeState`.
- Writes should be debounced and event-like, not per-frame:
  - save on exit activation;
  - save on scene unmount;
  - save on tutorial completion;
  - save on decoration/Journey unlock change.

### Migration And Production Notes

- The app currently uses Sequelize model definitions plus `sequelize.sync()` and a few `ensureColumnExists()` calls.
- Production is PostgreSQL via `DATABASE_URL`.
- Before adding any new home table, prefer a small Sequelize model and an idempotent `ensureColumnExists`/index path that is safe for existing production data.
- Long-term, `docs/post-review-followups.md` already calls out replacing `sequelize.sync()` with versioned migrations; the home field should not make that harder.
- If `player_home_state` is added, include an index-free primary-key lookup only. It should be fetched by `player_id` during bootstrap and should not be on hot battle paths.

### Bootstrap Shape If Future State Exists

If `player_home_state` becomes necessary, `/api/bootstrap` should include:

```json
{
  "homeField": {
    "enabled": true,
    "renderer": "phaser",
    "mapVersion": "home_field_v1",
    "assetVersion": "home_assets_v1",
    "state": {
      "lastPosition": { "x": 800, "y": 740, "facing": "up" },
      "tutorialFlags": {},
      "unlockedNodes": {}
    }
  }
}
```

For v1 without a new table, return only config/version info or keep it in `/api/app-config`; derive player-specific home state from existing bootstrap fields.

### Rollout

Ship behind a config flag first:

```text
HOME_FIELD_ENABLED=true
HOME_FIELD_RENDERER=phaser
HOME_FIELD_FORCE_FALLBACK=false
```

Production rollout order:

1. deploy assets/metadata/scripts only (`HOME_FIELD_ENABLED=false`);
2. enable Phaser hub for the development environment first;
3. enable for production for internal testers (`HOME_FIELD_ENABLED=true`);
4. keep `HOME_FIELD_FORCE_FALLBACK=false` set as a kill switch — flipping to `true` rolls everyone back to the legacy dashboard without a deploy;
5. keep fallback dashboard path for at least one release after general availability.

Kill / removal criteria for the legacy dashboard:

- **Activation parity**: `home_field_arena_activated` rate ≥ 95% of the pre-launch `start_run` rate, measured per active user per day, for **7 consecutive days**.
- **Fallback rate**: `home_field_fallback` rate < 1% of `home_field_initialized` (sampled) for 7 days.
- **No active support escalations** mentioning the hub for 7 days.

Only after all three conditions hold is the legacy `HomeScreen.js` dashboard path deleted. Until then it remains wired through the `HOME_FIELD_FORCE_FALLBACK` flag.

## Game Requirement IDs

Per `mushroom-master/AGENTS.md`, every behavioral test must carry a `[Req X-Y]` prefix tied to a section in `docs/game-requirements.md`. Sections 1–14 are taken; the hub introduces **Section 15 — Home Field Hub**. Add these IDs to `docs/game-requirements.md` in Phase 0 before any test is written:

| ID | Requirement |
|---|---|
| `15-A` | Home renders the selected mushroom's chibi at the configured spawn. |
| `15-B` | Arena entrance and Journey entrance are both visible inside the initial mobile viewport (`390x844`) without scrolling. |
| `15-C` | Tapping/clicking Arena starts a new run if no active run exists; resumes an active run if one exists. |
| `15-D` | Arena is disabled and shows the `dailyLimitReached` state when `bootstrap.battleLimit.used >= bootstrap.battleLimit.limit`. |
| `15-E` | Arena routes to the character picker when no active mushroom is selected. |
| `15-F` | Tapping Journey opens the under-construction modal; no backend call fires. |
| `15-G` | Walking the chibi into Arena's hotspot AABB surfaces the same Arena CTA as tapping the DOM button. |
| `15-H` | Chibi cannot pass through collision rectangles declared in `home-field-map.json`. |
| `15-I` | `prefers-reduced-motion` (or `player_settings.reduced_motion`) freezes ambient loops on their `stillFrameIndex` and replaces chibi walk with instant teleport. |
| `15-J` | Language switch updates all hub text without reinitializing the Phaser scene. |
| `15-K` | Duplicate Arena activation within `startingRun` is debounced; only one run is created per activation. |
| `15-L` | Asset load failure (atlas, chibi, or schema) routes to the legacy dashboard start/resume path with `home_field_fallback` logged. |
| `15-M` | `Telegram.WebApp.BackButton` closes the Journey modal and open drawers; otherwise it is hidden. |
| `15-N` | After a battle/run completes, the user returns to the hub (not the legacy dashboard) with the chibi at the configured post-battle spawn. |

E2E and screenshot specs covering the hub use these IDs (e.g. `test('[Req 15-B] mobile viewport shows Arena, Journey, and chibi', ...)`). Tests for the hub without `[Req 15-X]` prefix fail review.

Preview spec file: `tests/game/home-field-preview.spec.js`. It exercises `/home-field-preview`, a deterministic CSS layout lab that renders the intended `7 × 4` tile grid and object layer before final Phaser assets exist. It asserts tile count, path-tile count, Arena/Journey/chibi visibility, mobile safe-frame containment, object non-overlap, image loading, and horizontal overflow. The route is public so screenshot checks do not need a logged-in session or generated PNGs.

Future production spec file: `tests/game/home-field.spec.js`. Reuse helpers from `tests/game/helpers.js` (`bootRun`, `freshDb`, `createPlayer`) and `tests/game/screenshot-capture.js` (`captureScreenshot`, `assertImagesLoaded`). Take dual screenshots by calling `page.setViewportSize({width:375,height:667})` then `captureScreenshot()`, then `page.setViewportSize({width:1280,height:800})` then `captureScreenshot()` again.

`docs/user-flows.md` Flow B Step 1 is rewritten in Phase 0 to describe the field hub: visible elements, user actions, expected assertions. The new step text is reviewed alongside this plan before any UI work begins.

## Implementation Phases

### Phase 0 — Lock Contracts

No scene code, no imagegen. This phase produces only frozen contracts and the smallest tooling needed for the rest of the work.

- Add `docs/adr/0001-home-field-renderer.md` capturing the Phaser decision.
- Add the `11-A` … `11-M` entries to `docs/game-requirements.md`.
- Rewrite `docs/user-flows.md` Flow B Step 1 with the field hub flow (visible elements, actions, assertions).
- Land the schema files (`home-field-map.json`, `home-field-assets.json`) with v1-final shape but no asset payloads. Validator script can be a stub that loads, parses, and checks schema; no asset existence checks yet.
- Add `.gitignore` entry for `.agent/home-field-workspace/**`.
- Add config flags: `HOME_FIELD_ENABLED`, `HOME_FIELD_RENDERER=phaser`, `HOME_FIELD_FORCE_FALLBACK`.
- Lock the canon **style anchor**: one reference image (terrain + prop + chibi at correct relative scale) committed to `.agent/home-field-workspace/style-anchor.png` and referenced by every subsequent imagegen prompt.
- Add `/home-field-preview` as a deterministic screenshot harness for the tile grid, object layer, destination row, chibi spawn, and mobile safe frame. This route validates composition before generated PNGs are ready and remains a regression screen for future map metadata.

Completion condition:

- ADR landed.
- Requirement IDs added.
- User-flows.md updated.
- Schema files validate against an empty asset list.
- CI runs `npm run game:home-field:validate` and passes on the empty-but-valid baseline.

### Phase 1 — Plan And Asset Direction

- Confirm this plan is approved.
- Pick initial art generation batch:
  - 8 terrain tiles (grass base × 2, flowers, dirt straight, dirt curve, spore glow, destination row, edge roots)
  - 9 props (mushroom clusters, lantern, spore puff, fallen branch, signpost blank × 2, return marker)
  - 2 exits (Arena arch, Journey gate)
  - 1 chibi spritesheet for the default active mushroom
  - 4 effect spritesheets (spore motes, portal shimmer, path pulse, journey rustle)
- Confirm v1 uses existing database state only and does not add `player_home_state`.

Completion condition:

- First asset list locked.
- Database scope is locked: static map/assets in files; no new persistence unless durable home state is introduced.

### Phase 2 — Asset Generation Pipeline

Follow **Agent Implementation Flow** Step 1 through Step 8. Do not build the home-field UI until the first contact sheet and map preview exist.

- Add scripts:
  - `app/scripts/generation/next-home-field-image-prompts.js`
  - `app/scripts/generation/produce-home-field-assets.js`
  - `app/scripts/generation/generate-home-field-contact-sheet.js`
  - `app/scripts/checks/validate-home-field-assets.js`
- Add package aliases:
  - `game:home-field:next`
  - `game:home-field:produce`
  - `game:home-field:sheet`
  - `game:home-field:validate`
- Generate the minimum proof batch first, then expand only after review.
- Generate static base assets first, but reserve metadata fields for animation frames and effect emitters from the start.
- For animated assets, produce still preview contact sheets plus an animation manifest; do not rely on GIFs as production runtime assets.
- Use `/home-field-preview` after each map/object metadata change to confirm Arena, Journey, and chibi placement still read correctly at mobile and desktop viewports.
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

### Phase 3 — Phaser Hub Scene

The first scene code is Phaser, not DOM. There is no DOM walkable prototype.

- Add Phaser as a dependency; commit lockfile.
- Create `web/src/screens/HomeFieldCanvasScene.vue` (Vue wrapper) + `web/src/renderer/home-field-scene.js` (Phaser scene).
- `preload()` loads `atlases/main.png + .json`, the active chibi spritesheet, and parses the schema-validated map JSON.
- `create()`:
  - builds tile layer from `terrain` entries;
  - places objects from `objects` layer with anchor and z-order rules from the **Renderer Contract**;
  - creates effect emitters from `effects` layer (paused if reduced-motion);
  - places the chibi at `spawn` with `facing` direction;
  - creates camera bounds, follow rules, mobile safe-frame deadzone;
  - mounts `<Teleport>`'d DOM buttons over Arena/Journey hotspots via `worldToScreen()`.
- `update(time, delta)`:
  - advances chibi toward `target` per the collision/pathing rules;
  - re-sorts objects on chibi-y change;
  - updates `activeHotspot` based on overlap.
- Wire Arena CTA to existing `playSelectedMushroom()` (start/resume), Journey CTA to under-construction modal.
- Wire `home_field_*` telemetry events with sampling.
- Wire reduced-motion subscription.
- Wire schema validation + error fallback path.
- Keep the legacy home dashboard mounted behind a drawer temporarily.

Completion condition:

- Initial mobile (`390x844`) and desktop (`1440x900`) screenshots show field, chibi, Arena, Journey above the fold.
- Tap-to-move and WASD/arrow movement work; chibi cannot pass collision AABBs.
- Walking the chibi to Arena's hotspot activates the same DOM button as direct tap.
- Daily-limit-reached and no-active-mushroom states render correctly.
- Schema-validation failure routes to the legacy dashboard path.
- All `[Req 15-A]` … `[Req 15-H]` E2E specs pass.

### Phase 4 — Animated Tilemap And Effects Pass

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

### Phase 5 — Dashboard Migration

Existing widgets in `web/src/pages/HomeScreen.js` to migrate (from the current dashboard composition):

- Active mushroom portrait + level + mycelium progress → top-left nameplate overlay (already in hub composition)
- "Start Game" / "Resume Game" button → folded into Arena hotspot (already in hub composition)
- Spore count HUD → top-right corner overlay
- Battle limit `X/10` pill → top-right, beside spore count
- Recent game run history → bottom drawer ("History" tab), 5 entries
- Friends list (`HomeSocialSidebar`) → side drawer ("Friends" tab) on mobile, side panel on desktop
- Leaderboard → side drawer ("Leaderboard" tab) on mobile, side panel on desktop
- Stats popover → drawer's "Stats" tab
- Roster (mushroom switcher) → modal opened via Arena's "Choose a mushroom" CTA or a small switcher icon
- Achievements/season rank section → drawer's "Achievements" tab

Detailed migration steps:

- Lift each widget into a `<Teleport>`'d drawer or overlay component; do not rewrite the widget itself.
- The drawer container is a new component `HomeFieldDrawer.js` with tabs for History / Friends / Leaderboard / Stats / Achievements.
- Update emits: the hub forwards `start-run`, `resume-run`, `abandon-run`, `add-friend`, `challenge-friend`, `accept-challenge`, `decline-challenge`, `load-run-summary`, `select-mushroom`, `switch-portrait`, `switch-preset` from the drawer up to the parent — same emits the current `HomeScreen.js` already exposes.
- Remove duplicated "Start Game" card once Arena interaction is reliable.

Completion condition:

- Home no longer reads as a dashboard, but all old home functions remain reachable.

### Phase 6 — Tests And Production Hardening

- Update `docs/user-flows.md` Flow B Step 1 to describe the field hub.
- Add metadata validation coverage:
  - schema/version required;
  - all asset IDs unique;
  - all `assetId` references exist;
  - all hotspots have localized `labelKey`s;
  - all animation frame dimensions divide spritesheet dimensions;
  - all collision/hotspot rectangles are inside world bounds.
- Add E2E coverage:
  - `/home-field-preview` renders the intended tile/object composition without session state;
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
- Add database/persistence checks:
  - `/api/bootstrap` contains all data needed to choose the active chibi;
  - no new write occurs on simple movement/tap-to-move;
  - `client_events` records home-field telemetry without raw movement paths;
  - locale and reduced-motion values continue to come from `player_settings`.

Completion condition:

- `npm run game:test:screens`
- targeted e2e for home-to-arena flow
- `npm run game:build`

## First V1 Map Proposal

Pixel coordinates against the locked `1792 × 1024` world (`tileSize: 256`). Tile layer entries are tile-aligned; object/hotspot/collision rectangles are integer pixels but do not need to align to the tile grid.

```json
{
  "version": 1,
  "world": { "width": 1792, "height": 1024, "tileSize": 256 },
  "spawn": { "x": 896, "y": 760, "facing": "up" },
  "camera": {
    "initialTarget": { "x": 896, "y": 512 },
    "mobileSafeFrame": { "x": 72, "y": 80, "w": 1648, "h": 800 },
    "keepVisible": ["arena", "journey", "player"]
  },
  "hotspots": [
    {
      "id": "arena",
      "labelKey": "homeArenaExit",
      "rect": { "x": 1024, "y": 128, "w": 512, "h": 256 },
      "action": "arena"
    },
    {
      "id": "journey",
      "labelKey": "homeJourneyExit",
      "rect": { "x": 256, "y": 128, "w": 512, "h": 256 },
      "action": "journey"
    }
  ],
  "collision": [
    { "id": "topForest", "x": 0, "y": 0, "w": 1792, "h": 96 },
    { "id": "leftMushrooms", "x": 0, "y": 192, "w": 224, "h": 768 },
    { "id": "rightMushrooms", "x": 1568, "y": 192, "w": 224, "h": 768 }
  ]
}
```

Aspect-ratio note: the world is `1792 × 1024` (aspect 1.75). Telegram portrait viewports are taller than wide (e.g. `390 × 844`, aspect 0.46). The renderer fits the world to the viewport's *width* by default and crops top/bottom outside the camera's `mobileSafeFrame`. The `mobileSafeFrame` is the rectangle in world space that **must** be on-screen at all times — by construction it contains spawn, both hotspots, and the chibi nameplate.

## Development And Debug Tooling

- **Debug overlay**: when the URL contains `?home-field-debug=1`, the scene draws collision rectangles (red outline), hotspot rectangles (yellow outline + label), camera safe-frame (cyan outline), and a HUD line at the top showing `chibi(x,y) target(x,y) facing zoom fps`. Saves ~3 hours per debugging session vs. inferring from screenshots.
- **State machine inspector**: when the URL contains `?home-field-inspect=1` and the build is dev-only, `@xstate/inspect` is wired so the state chart can be opened in a separate browser tab.
- **Dev-only console helpers**: `window.__homeField = { scene, camera, state, teleport(x,y), simulateReducedMotion(bool) }` for fast iteration.

## Concurrency And Edge Cases

The XState chart (`renderer/home-field-state.js`) must cover these explicitly; otherwise edge bugs ship:

- **Tap Arena while chibi mid-walk to Journey**: cancel current movement, transition to `activatingArena`, debounce duplicate activations during `startingRun`.
- **Telegram BackButton during scene load**: deferred until `readyIdle`; queued back press is dropped if `errorFallback` fires first.
- **Drawer opens while chibi mid-walk**: chibi continues walking to current target, then idles; `scene.input.enabled = false` while drawer is open so no new taps register.
- **Locale switch mid-walk**: text overlays re-render in place; chibi position, camera, animation state are preserved.
- **Reduced-motion toggled at runtime**: ambient loops freeze immediately; chibi mid-walk teleports to current target.
- **Asset failure after initial render** (e.g. an effect sprite 404 on lazy fetch): scene continues without that effect; `home_field_asset_failed` logged.

## Telegram Mini App Hardening

In addition to the contract section above:

- **`Telegram.WebApp.disableVerticalSwipes()`** is called when any drawer is open so the user can scroll inside the drawer without triggering Telegram's pull-to-close gesture; re-enabled on drawer close.
- **`Telegram.WebApp.HapticFeedback.impactOccurred('light')`** fires on Arena/Journey hotspot activation (mobile only, gated on `Telegram.WebApp.HapticFeedback` existence).
- The hub does **not** call `Telegram.WebApp.close()`, `Telegram.WebApp.openTelegramLink()`, or any payment APIs.

## Visual And Scale Lock

- **Lighting**: fixed perpetual dusk in v1. No day/night cycle, no time-of-day variation. One lighting direction across all art (top-left key light, ambient violet/amber rim).
- **Chibi display height**: ~96 px tall on mobile (with `zoom ≈ 1.0`), scaling with camera zoom. The 64×64 spritesheet frame includes ~16 px of headroom and ~12 px of footroom so the visible silhouette is ~36 px tall in source.
- **Mushroom prop visible height**: 80–140 px range in source; place small caps in foreground, tall stems near edges. Caps must read as taller than the chibi to make mushrooms feel imposing.
- **Walk animation**: 10 fps (6 frames over 0.6 s loop), distinct from ambient 8 fps loops.
- **Spore motes density**: ≤ 12 mote sprites visible at once, drifting upward at 30 px/s, recycled when off-screen.
- **"Return to entrances" affordance**: visible only when chibi distance from spawn > 400 px; hidden inside the spawn deadzone.

## Risks

- **Asset scope balloon.** Keep v1 tiny: one field, two exits, one chibi style pass, four ambient loops. Lazy-load other chibis. Validator rejects unreferenced assets so dead PNGs do not accumulate.
- **Style drift across imagegen batches.** The 8 terrain + 9 props + 2 exits + chibi must read as one world (light direction, palette, outline weight, shadow style). Mitigated by the **style anchor** image referenced in every prompt and by the `generate-home-field-contact-sheet.js` palette-histogram check.
- **Character identity / elf ears regression.** Each chibi must preserve canon from `docs/design-requirements.md`; review the chibi contact sheet against the requirement doc before each character is shipped.
- **Atlas size overrun.** If the packed `main.png` exceeds 800 KB, split into `main_a` (critical: terrain + arch + chibi) and `main_b` (decorative: extra props + effects), load `main_b` on idle.
- **Telegram viewport reflow when keyboard opens.** Subscribed via `viewportStableHeight`; ambient loops pause to save battery during the transient.
- **WebGL init failure on old Android Telegram builds.** Caught by error fallback path; user lands on legacy dashboard with `home_field_fallback{reason:"webgl"}` logged.
- **Schema/asset/CI drift.** Validator runs at boot **and** in CI; both use the same Zod schema so they cannot disagree.
- **Texture memory leak across Home → Arena → Home navigations.** Explicit `scene.shutdown()` + `game.destroy(true)` on unmount; covered by a Playwright leak-check spec.
- **Duplicate Arena activation creating two runs.** XState chart enforces `startingRun` debounce; covered by `[Req 11-K]`.
- **Phaser version churn.** Pin Phaser to one minor version in `package.json`; renderer-API breakage on minor bumps is a known Phaser pattern.
- **Audio absent in v1.** Plan deliberately omits SFX/music; an ambient soundscape can land in a follow-up phase but is not part of the contract.

## Recommended Next Step

Execute **Phase 0 — Lock Contracts** first. No imagegen runs, no scene code, until contracts are frozen.

Phase 0 tasks, in order:

1. Add `docs/adr/0001-home-field-renderer.md` (Phaser locked; alternatives rejected; triggers recorded).
2. Add requirement IDs `11-A` … `11-M` to `docs/game-requirements.md`.
3. Rewrite `docs/user-flows.md` Flow B Step 1 for the field hub (visible elements, actions, expected assertions).
4. Add Zod schema for `home-field-map.json` and `home-field-assets.json`; ship `validate-home-field-assets.js` stub that passes against an empty asset list.
5. Add `.agent/home-field-workspace/**` to `.gitignore`.
6. Add `HOME_FIELD_ENABLED`, `HOME_FIELD_RENDERER=phaser`, `HOME_FIELD_FORCE_FALLBACK` plumbing.
7. Add the package aliases (`game:home-field:next/produce/sheet/validate`) and wire `game:home-field:validate` into CI.
8. Lock the map's pixel world size (`1792 × 1024`), tileSize (`256`), spawn (`896, 760`), and mobile safe frame (`72, 80, 1648 × 800`).
9. Lock the canon style anchor image at `.agent/home-field-workspace/style-anchor.png` (composite of grass + prop + chibi at correct relative scale); reference from every imagegen prompt.

After Phase 0 lands, **Phase 1 — Asset Direction** approves the first imagegen batch; **Phase 2** runs the asset-generation pipeline through the proof set; **Phase 3** lands the Phaser scene directly. There is no DOM walkable interlude.

This keeps the riskiest contracts — coordinate system, renderer, anchors, locale strategy — frozen before any code or art lands.
