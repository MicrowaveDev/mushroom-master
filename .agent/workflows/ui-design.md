# UI / Renderer Design Rules

This repository has two primary UI surfaces:

1. The generated mushroom lore HTML/PDF dossier.
2. The Mycelium Autobattler Telegram Mini App (Vue frontend).

Design decisions should start from this repository's actual needs: readable lore presentation, stable print layout, an inviting game UI, and a light pastel mushroom visual language.

---

## Part 1: Print / Lore Dossier Rules

### Core Principle: Print-First Readability

- Prefer document flow, section clarity, and print stability over app-like chrome.
- Keep layouts rich enough to feel intentional, but never so decorative that they weaken readability.
- Use whitespace to support hierarchy, not to create empty dead zones.
- The generated PDF and page images are the primary quality bar for visual changes.

### Layout Hierarchy

Prefer this hierarchy for dossier-like layouts:

1. Document title and short opening context.
2. Major section headings such as general lore and characters.
3. Character intro blocks with canonical image plus overview text.
4. Supporting subsections and body content.

Rules:

- Keep hierarchy shallow and obvious.
- Use heading scale, spacing, and separators before adding extra containers.
- Avoid nested framed boxes unless they communicate real structure.
- Preserve clear association between each character image and its matching overview text.

### Character Intro Rules

- Treat the character intro as the key visual unit for a dossier section.
- Keep the canonical manifest image with the correct character heading and overview.
- Support portrait images with a stable side-by-side layout when space allows.
- Fall back to stacked layout on narrow widths or when side-by-side presentation hurts readability.
- Avoid image sizing that creates oversized gaps, crowded text wrap, or broken page flow.

### Spacing and Density

- Aim for consistent vertical rhythm across headings, images, paragraphs, and section breaks.
- Major headings should feel clearly separated without wasting a large portion of a page.
- Intro blocks and separators should have enough margin to avoid collisions with nearby text.
- Watch for oversized whitespace near page bottoms, after headings, and around image-heavy sections.

### Typography

- Typography should feel like a field guide or illustrated dossier: calm, readable, and slightly literary.
- Headings may carry more personality, but body text should remain highly legible in print.
- Avoid tiny decorative text treatments that degrade in PDF export or page screenshots.
- Favor stable, print-friendly type choices over trendy UI typography.

### Print and Page-Break Rules

- Treat print CSS as core product behavior.
- Avoid orphaned headings, detached subheadings, and split character intro blocks.
- Prefer deterministic renderer fixes using spacing and page-break controls over content hacks.
- When a layout issue shows up in screenshots, verify it in the generated HTML/PDF pair and fix it in renderer logic where possible.

---

## Part 2: Autobattler Mini App UI Rules

### Core Principles

- **Art-first, data-second**: lead every screen with character art or artifact visuals. Stats, labels, and mechanical info sit beneath or overlaid on the imagery — never above it.
- **One screen, one purpose**: each screen should have a clear primary action. Don't stack unrelated panels.
- **Eliminate nesting**: avoid borders inside borders. If a parent container has a border, child cards should be borderless. Fighter cards (`fighter`) use `padding: 0; border: none; background: none` — the parent provides the frame.
- **Vertical space is scarce on mobile**: everything important should fit in one viewport (430×932px). Shrink cells, remove dead whitespace, collapse sections rather than scroll.
- **Click-first, drag-second**: primary interactions are clicks/taps. Drag-and-drop is a secondary power-user path.
- **Never expose implementation**: no "initData", "session key", "4×4 grid", "browser fallback" in player-facing copy. Describe what the player does, not how the system works.

### Portrait and Name Overlay Pattern

- Character names overlay the bottom of their portrait image using a dark gradient fade-up (`linear-gradient(to top, rgba(30,22,12,0.75), transparent)`). White text with `text-shadow`.
- This pattern is used consistently across: character selection cards, fighter cards (replay/results), battle prep hero, and any future character display.
- The name element is positioned inside a wrapper (`card-portrait-wrap` or `fighter-portrait-inner`) that is `position: relative`, so the overlay anchors to the image — not to an outer container that may include speech bubbles or other content.
- Portrait images use the per-character config from `replay-portrait-config.js` for `object-position`.

### Character Tags and Stats

- Style tags (`control`, `aggressive`, `balanced`, etc.) render as small uppercase pills with sage-green background (`.fighter-style-tag`).
- Stat summaries use compact inline format: `100 HP · 11 ATK · 7 SPD` — not verbose `HP 100 / ATK 11`.
- On the battle prep hero card, stat tags appear as frosted glass chips (`backdrop-filter: blur`) overlaid on the portrait gradient.
- Badge counts (`.artifact-container-count`, `.artifact-inventory-badge`) use small colored circles — sage-green for containers, accent for inventory.

### App Header and Navigation

- The header is a compact sticky bar: hamburger button | game title | lang toggle.
- Navigation is a collapsible dropdown (`nav-dropdown`) that only renders when toggled. It closes on any navigation action.
- The header is hidden on unauthenticated screens (auth, loading). Auth screen uses its own self-contained card layout.
- No large hero banner with eyebrow + h1 — the title in the header bar is sufficient.

### Auth / Welcome Screen

- Treat auth as a landing page, not a login form.
- Single card flow: eyebrow game title → portrait cluster → headline → tagline → feature bullets → primary CTA → secondary logins → lang toggle at bottom.
- No separate header. All content in one centered card (max-width 440px).

### Onboarding

- 3-step numbered walkthrough: pick fighter → build loadout → battle.
- Two-column layout on desktop: steps left, character portrait grid right.
- Collapses to single column on mobile with portraits on top.
- Numbered circles use sage-green gradient. Each step has a bold heading + muted subtitle.
- CTA button says "Start" (not "Continue").

### Character Selection

- 2-column grid of compact cards. Each card is fully clickable (no separate "Pick" button).
- Portrait uses 3:4 aspect ratio with name overlaid at bottom.
- Style tag pill + compact stats below the portrait.
- Hover: lift (`translateY(-2px)`). Press: scale (`scale(0.98)`).

### Artifacts Screen (Shop → Backpack → Inventory)

Three-zone single-column layout (mobile), two-column on desktop (left: backpack + inventory, right: shop):

- **Header row**: screen title + coin HUD showing remaining coins only (`💰 2`). No fraction or "X/5" format.
- **Backpack** (`.artifact-container-zone`): green-tinted solid border. Items are click-to-place (auto-places in first available grid cell). Each item has a sell button (top-right corner) showing the refund amount.
- **Inventory** (`.artifact-inventory-section`): wrapped in a `panel`. Header with count badge. Grid uses 44px cells. Stats line + Save button only appear when items are placed; empty state shows hint text.
- **Shop** (`.artifact-shop`): dashed border to visually distinguish from backpack. Click-to-buy is the primary interaction. Unaffordable items are dimmed (opacity 0.5) and non-clickable/non-draggable. Reroll button shows cost and dims when unaffordable.

### Battle Prep

- Default layout: single centered card (max-width 440px) with wide portrait (5:3) edge-to-edge, name + stat chips overlaid on a dark gradient, inventory grid (40px cells) below the portrait, and a prominent CTA.
- When multiple zones must fit in one viewport (e.g. shop + inventory + backpack + sell area + HUD on the run prep screen), prefer a compact side-by-side or stacked layout that keeps all interactive elements visible without scrolling. Fitting the primary action in the viewport takes priority over the canonical card layout.
- No nested panels — the card or screen itself provides all the visual framing.

### Results Screen

- Color-coded outcome banner: green (win), red (loss), amber (draw). Large centered outcome text.
- Two-column rewards row under the banner: each side's mushroom name + spore/mycelium rewards.
- Two-column fighter cards below (using `FighterCard` with portrait config).
- "Home" button at the bottom.

### Replay Screen

- Two-column duel layout on desktop, single column on mobile.
- Speech bubbles overlay directly on the portrait image (no padding-top shift). Bubble position configured per character in `replay-portrait-config.js`.
- Fighter cards have no border/padding of their own — the parent panel provides framing.
- Battle status icon centered between the fighters on desktop, full-width on mobile.

### Components and Reuse

- `ArtifactGridBoard` — shared spatial grid for all inventory surfaces. Supports drag, drop, click, rotate.
- `FighterCard` — portrait (with name overlay) + meta row (stats/health + inline inventory). Used in replays, results, battle prep review, bubble review.
- `ReplayDuel` — two `FighterCard`s with a battle-status center column.
- When adding a new surface that shows artifacts or fighters, compose from these existing components. Do not create parallel portrait/inventory rendering.

### Mobile and Telegram Constraints

- All layouts must work at 430×932px viewport (Telegram Mini App standard).
- Touch targets: minimum 44px tap area for buttons, cells, and interactive items.
- Click-to-buy/place is the primary interaction. Drag-and-drop is secondary and optional.
- Avoid hover-only affordances; all interactive states must have tap equivalents.
- Test every screen at mobile width before considering it done. If it requires scrolling to reach the primary action, it needs to be tighter.

---

## Shared Rules (Both Surfaces)

### Visual Direction

- Default to a light pastel mushroom theme.
- Favor soft creams, warm parchment, muted sage, pale moss, dusty peach, light amber, and gentle earth accents.
- Avoid dark-theme defaults unless a specific task explicitly calls for them.
- Decorative mushroom motifs, spores, and botanical ornaments should stay subtle and supportive.
- If ornamentation competes with headings, body text, or character images, reduce it.

### Color and CSS Rules

- Reuse repo-native CSS variables (`--bg`, `--surface`, `--ink`, `--accent`, `--sage`, `--border`, etc.) before introducing new color systems.
- Prefer light pastel values and warm neutrals over stark contrast or saturated dark surfaces.
- Use strong accent color sparingly for headings, dividers, and small emphasis points.
- Avoid large blocks of intense color behind reading text.
- Do not import another repo's SCSS tokens, component assumptions, or layout systems without verifying they exist here.

### Responsive Expectations

- PDF output: primary quality bar for lore surfaces.
- Mini App: primary quality bar is 430px mobile viewport in Telegram.
- Character intro layouts and game screens should collapse cleanly on smaller widths.
- No horizontal overflow.
- Keep image scaling controlled.

### Review Checklist

When reviewing visual output, check:

1. Section hierarchy and page flow.
2. Character image and overview pairing accuracy.
3. Whitespace balance — especially on mobile. If the primary action requires scrolling, the screen is too tall.
4. Awkward page breaks, orphans, and detached headings (print) or overflowing content (app).
5. Image sizing, placement, and background treatment. Portraits should use `object-position` from `replay-portrait-config.js`.
6. Whether ornamentation helps the page or only adds noise.
7. Whether the palette still reads as light pastel mushroom rather than dark, heavy, or generic.
8. Whether gate/auth screens sell the game rather than describe implementation.
9. Whether interactive elements (buttons, drag targets, toggles) are clearly afforded and touch-friendly.
10. **No borders inside borders**: if a card has a border, its children (fighter cards, portraits, grids) should not.
11. **Name overlays**: character names should be overlaid at the bottom of their portrait, not in a separate row above.
12. **Mobile viewport fit**: every key screen (auth, characters, artifacts, battle prep, results) should fit its primary content in one 430×932px viewport.

### Adapting Guidance From Other Repos

- Do not paste app-dashboard guidance directly into this project.
- Translate outside guidance into repo-native terms: markdown structure, renderer CSS, Vue components, game-data definitions, and Telegram Mini App constraints.
- Keep all UI surfaces consistent with the same mushroom-world visual direction unless product requirements clearly differ.
