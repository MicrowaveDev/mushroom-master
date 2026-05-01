# Phase 3 Evidence — Non-Color Role Glyphs In UI

Status: PASS

## AC3.1

PASS. Role glyphs now use distinct UI-drawn shapes for damage, armor, stun, and bag, so the role cue is not color-only.

## AC3.2

PASS. Shop cards render `.shop-item-role-glyph` with `aria-label` values for each role. The Playwright artifact bitmap spec forces one shop card per role and asserts each glyph label.

## AC3.3

PASS. The standard screenshot suite passed after the glyph change, and the focused artifact screenshot spec captured the shop role glyph surface.

## AC3.4

PASS. Glyphs are rendered in DOM/CSS by shop cards and artifact figures. No artifact PNG files were changed.

## Commands Run

```bash
node --check web/src/components/ArtifactFigure.js
node --test tests/web/artifact-render.test.js
npm run game:test:screens
npx playwright test tests/game/artifact-bitmap-screenshots.spec.js --config=tests/game/playwright.config.js --reporter=line
```
