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

### Core Principle: Inviting First Impression, Cohesive Flow

- Every screen the player sees should feel like part of the same mushroom world — never generic, never technical.
- Lead with visual personality (character art, artifact visuals, warm palette) before mechanical detail.
- Gate screens (auth, onboarding) must sell the game, not describe the architecture. Show the world, explain the loop, then offer a clear action.
- Avoid exposing implementation details ("initData", "session key", "browser fallback") in player-facing copy.

### Auth / Welcome Screen

- The auth screen is the player's first impression — treat it as a landing page, not a login form.
- Structure as a single cohesive card: game identity → visual hook → value proposition → call to action.
- Show character art early (portrait cluster or hero image) to immediately communicate the game's personality.
- Use a short compelling headline ("The mushroom arena awaits") followed by a tagline explaining the gameplay loop.
- List 2–4 feature bullets to set expectations (fighters, artifacts, battles).
- The primary CTA ("Play via Telegram") should be visually dominant and action-oriented.
- Secondary login methods sit below the CTA, visually quieter.
- Language toggle can sit inside the card at the bottom — no need for a separate header on unauthenticated screens.
- The full app header (hero bar + nav) should only appear once the player is logged in.

### Screen Structure

- Authenticated screens use the standard hero header with game title + lang toggle, then nav grid, then content.
- Each screen should have a clear single purpose — don't overload panels.
- Use the `panel` container for self-contained content blocks. Use `stack` for vertical flow within a panel.
- Prefer grid-based layouts (`grid`, `dashboard`, `nav-grid`) over free-form positioning.

### Shop and Inventory (Artifacts Screen)

- The artifacts screen has two zones: shop (bottom-left) and inventory (right).
- Shop offers are draggable tiles showing artifact visual + name + price + stat chips.
- Coin HUD is always visible: `{used} / 5` with remaining balance.
- Unaffordable items are visually dimmed (reduced opacity) and not draggable.
- Drop targets highlight on hover during drag (gold outline).
- Clicking a placed piece returns it to the shop — give the player easy undo.
- The shop container has a dashed border to distinguish it from solid panels.

### Battle and Replay

- Battle prep shows character portrait, inventory preview, and stat summary in a clear grid.
- The "Start battle" button should always be visible and clearly enabled/disabled based on loadout validity.
- Replay screens flow top-to-bottom: combatant cards with speech bubbles → status → log entries.
- Log entries accumulate visually; active entry gets emphasis.

### Components and Reuse

- `ArtifactGridBoard` is the shared spatial grid for inventory display across all surfaces (shop, builder, battle prep, replay, review).
- `FighterCard` wraps portrait + name + stats + inline inventory for any combatant display.
- `ReplayDuel` composes two `FighterCard`s with a battle-status center column.
- When adding a new surface that shows artifacts or fighters, compose from these existing components rather than building new ones.

### Mobile and Telegram Constraints

- All layouts must work at 430px viewport width (Telegram Mini App standard).
- Touch targets: minimum 44px tap area for buttons, cells, and draggable items.
- Drag-and-drop uses HTML5 DataTransfer events — also support click-to-place as a fallback for touch.
- Avoid hover-only affordances; all interactive states should have non-hover equivalents.

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
3. Whitespace balance.
4. Awkward page breaks, orphans, and detached headings (print) or overflowing content (app).
5. Image sizing, placement, and background treatment.
6. Whether ornamentation helps the page or only adds noise.
7. Whether the palette still reads as light pastel mushroom rather than dark, heavy, or generic.
8. Whether gate/auth screens sell the game rather than describe implementation.
9. Whether interactive elements (buttons, drag targets, toggles) are clearly afforded and touch-friendly.

### Adapting Guidance From Other Repos

- Do not paste app-dashboard guidance directly into this project.
- Translate outside guidance into repo-native terms: markdown structure, renderer CSS, Vue components, game-data definitions, and Telegram Mini App constraints.
- Keep all UI surfaces consistent with the same mushroom-world visual direction unless product requirements clearly differ.
