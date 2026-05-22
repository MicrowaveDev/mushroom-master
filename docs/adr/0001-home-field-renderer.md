# ADR 0001 — Home Field Hub Renderer

**Status**: Accepted, 2026-05-22

**Context document**: [`docs/home-field-ingame-plan.md`](../home-field-ingame-plan.md)

## Decision

The Home Field hub uses **Phaser 3.88.x** as the production renderer, loaded via dynamic `import()` so it ships in a code-split chunk.

DOM/Node-canvas tooling is used only for non-runtime artifacts: contact sheets, map previews, screenshot evidence, review crops.

## Alternatives Considered

### A. DOM-only walkable hub

Render the hub as absolutely-positioned `<img>` elements with `transform: translate3d(...)` for the chibi and CSS animations for ambient loops.

- **Pros**: no new dependency; accessible by default; Vue templating familiar.
- **Cons**:
  - Performance: every grass tile, prop, and frame would need DOM updates per chibi step; layout/paint cost is non-trivial on Telegram WebView.
  - Z-ordering across foreground/background mushrooms vs chibi requires custom sort-by-y logic that browsers don't do natively.
  - Animated effects (spore motes, portal shimmer, path pulse) are awkward in DOM; CSS background-position animation has high CPU overhead vs. GPU-batched sprites.
  - Migration risk: rebuilding into Phaser later would discard most input/animation/collision code.

**Rejected** because all three renderer triggers (directional chibi sprites, hotspot collision objects, animated spritesheets) are confirmed v1 requirements. Building DOM now and migrating later is the single largest source of churn in this kind of work.

### B. PixiJS

Use PixiJS 8.x for sprite batching + an ad-hoc collision/camera layer in app code.

- **Pros**: ~half Phaser's bundle size; great sprite batching; tightly composable.
- **Cons**:
  - No built-in tilemap, camera, scene, or input system — we'd write all of that on top of Pixi.
  - Future Journey expansion (which is signaled in the plan) needs explorable area, NPCs, triggers, scripted events — these are Phaser bread-and-butter; doing them on Pixi means reimplementing what Phaser provides.
  - Camera safe-frame, tap-to-move with collision, and animation states would each be hand-rolled.

**Rejected** because the savings on bundle size do not offset the cost of reinventing tilemap/camera/scene/input on top of Pixi, particularly with Journey on the roadmap.

### C. Phaser 3.88.x ← chosen

- Built-in tilemap (matches the `home-field-map.json` shape), object layers, camera with deadzone/safe-frame, sprite animation, AABB collision, scene lifecycle (`shutdown` + `destroy` make memory cleanup straightforward).
- `type: Phaser.AUTO` gives WebGL with Canvas fallback for free.
- Phaser MultiAtlas format is a 1:1 match for the planned `atlases/main.png + main.json` output of `free-tex-packer-core`.
- Bundle size (~700 KB minified) addressed via dynamic `import()` so only the home-field route pays the cost.
- Future Journey gameplay (NPCs, triggers, multiple scenes, scripted events) lands without renderer changes.

## Consequences

- **Locked**: renderer is Phaser from Phase 0. No "DOM prototype" walkable interlude. The plan's Phase 3 builds the Phaser scene directly.
- **Pinned**: `phaser@3.88.x` exactly; minor bumps require a follow-up ADR. Phaser breaks API on minor versions.
- **Lazy-loaded**: Phaser is in its own bundle chunk. The chunk is fetched on first hub visit, not on app boot.
- **Atlas format**: production assets land in Phaser MultiAtlas format under `web/public/home-field/atlases/`.
- **Accessibility**: DOM overlay buttons (`<Teleport>`'d above the canvas) own focus/keyboard activation for Arena and Journey; the canvas is never the only interface.
- **Fallback**: `HOME_FIELD_FORCE_FALLBACK=true` kill-switch reverts every user to the legacy dashboard without a deploy.

## When To Revisit

- If Phaser ships a major breaking change in its tilemap/camera/scene APIs.
- If hub bundle chunk grows beyond 1.2 MB after gzip — at that point, evaluate whether a custom Pixi-based hub would meaningfully reduce eager bundle for non-hub screens.
- If Telegram WebView WebGL support degrades on iOS such that Canvas fallback becomes the dominant path (≥ 20% of sessions logging `home_field_initialized.renderer = "canvas"`).
