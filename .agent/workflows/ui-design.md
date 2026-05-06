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
- **Flat-first visual treatment**: app surfaces use solid pastel fills, clean typography, and geometric shapes. The parchment/dossier visual language belongs to the PDF, not to the Mini App. In the app, gradients, decorative accent bars, layered shadows, and gloss effects are dated by default; ask whether the effect carries information before adding it.

### Flat Design Rules

These rules scope the "flat-first" principle to concrete practices. They apply to app screens (Vue frontend), not to the PDF dossier.

- **Backgrounds are solid.** Use solid tinted fills for panels, headers, and stat tiles — not gradients. Reserve gradients for the handful of surfaces that genuinely need them (portrait name-overlay fade, dark-on-light readability ramps). If a panel uses a gradient purely for prettiness, flatten it.
- **No decorative accent bars.** Thin colored stripes at the top or side of a card, corner flourishes, or hairline separators that do not mark real sections are noise. Convey outcome or state through the panel fill itself.
- **Borders, fills, shadows — pick one.** Avoid stacking a border *and* a gradient *and* a drop shadow on the same element. Choose the lightest treatment that still reads as a distinct surface.
- **Sign-code deltas on the tile, not only the text.** A positive/negative value should shift the tile's background color (moss-tint for positive, rose-tint for negative) so the sign is visible at a glance. Color-only text changes are weaker and miss the peripheral-vision read.
- **Respect the pastel palette in flat fills.** Solid does not mean saturated. Use the same soft creams, moss, peach, and amber values as the rest of the app; just render them without gradient fades.

### Stat and Metric Card Pattern

For any surface that shows numeric outcomes (round rewards, run summary, leaderboard deltas, profile stats):

- **Big number on top, tiny label below.** The value is the hero (≈1.8–2.2rem, bold, `font-variant-numeric: tabular-nums`). The label is small (≈0.7rem), uppercase, muted, and sits underneath. If the markup uses `<dl><dt><dd>`, flip the visual order with `order: -1` on the `<dd>`.
- **Use `formatDelta` (or equivalent) for signed values.** Negative values must render with a single `-`. Templates that hard-prefix `+{{ value }}` produce `+-2` when the value is already negative — that is a bug, not a style choice.
- **Force explicit column count when the item count is fixed.** Three stats → `grid-template-columns: repeat(3, 1fr)`. Do not rely on `auto-fit` with `minmax(90px, 1fr)` in a narrow card; it silently bails to a single-column stack when the computed track width falls below the floor.
- **Cap focused-result panels.** Cards that summarize a single event (round result, battle outcome, earned-reward panel) should set `max-width` ≈520–560px and `margin: auto`. Without the cap, they stretch across a desktop viewport and look sparse.
- **Multi-data cards use header + full-width meter rows, not 3-column grids.** When a card carries emblem + name + lore + points + progress bar + footnotes, a 3-column grid (emblem | copy | meter) squeezes the copy into a narrow middle and pins the meter into the right gutter where the progress bar has no room. A two-row layout — header row (emblem | copy | points-block) on top, full-width meter row (progress bar + peak/next footer split) below — gives the bar horizontal space and lets the lore span its natural width.

### Chips vs Inline Text

Chips and pills are a specific affordance. Use them correctly or skip them.

- **Chips signal selectability / filtering.** If the element is tappable and represents a selection, filter, or toggle, chip styling (rounded pill, border, background) is right.
- **Read-only auxiliary info on a panel background is not chips.** For tagline-style supporting details (`vs Ломиэ · Урон +2 · Броня +4`) rendered against a solid panel, use inline text with middot separators. Rendering non-interactive facts as chip clusters reads as dated "tag cloud" UI and adds borders, padding, and visual weight where none is needed.
- **Contrast affordance over an image is a documented exception.** When read-only facts overlay a portrait, textured background, or other non-uniform surface (e.g. the battle-prep hero's stat tags, the style-tag pill on a character card), a pill or frosted chip backing is legitimate — it exists for legibility, not as a filter affordance. The "no chips for read-only info" rule applies to panel-on-panel surfaces, not image-on-portrait surfaces.
- **Do not use chips to compensate for a weak hierarchy.** If a section feels bland and you are tempted to add chip styling to make it pop, fix the hierarchy instead (typography, spacing, contrast).

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
- When multiple zones must fit in one viewport (e.g. shop + inventory + backpack + sell area + HUD on the run prep screen), prefer a compact side-by-side or stacked layout that keeps all interactive elements visible without scrolling. On desktop, the run prep workspace must read as two coherent columns: backpack + inventory stacked on the left, shop + sell zone stacked on the right, with both column tops aligned under the HUD. Fitting the primary action in the viewport takes priority over the canonical card layout.
- No nested panels — the card or screen itself provides all the visual framing.

### Results Screen

- Color-coded outcome banner: green (win), red (loss), amber (draw). Large centered outcome text.
- Two-column rewards row under the banner: each side's mushroom name + spore/mycelium rewards.
- Two-column fighter cards below (using `FighterCard` with portrait config).
- "Home" button at the bottom.

### Run-Complete Screen

The end-of-run recap stacks several richly-styled cards (outcome card, season/rank card, achievements panel). Four rules keep the stack readable:

- **Tonal identity per outcome.** Defeat / cleared / abandoned cards each carry a soft tinted background matching their tone (warm-red for `eliminated`, sage for `cleared`, neutral warm for `ended`). A flat `.panel` background sitting next to richly tinted sibling cards reads as unfinished — match the tinting language across the stack.
- **Run-level facts only — no last-battle recap.** This screen is the moment for run totals (rounds played, total spore/mycelium, season delta). Per-battle facts (last round number, last reward) duplicate what was already shown on the prior round-result screen and add visual weight without information.
- **No subset cards next to a totals line.** If the screen shows an "earned this run" total, fold the completion bonus into that total rather than rendering it as a separate sibling card. Two cards that show partial vs full of the same number invite "why are these different?" — players have to read both before answering.
- **Drop technical breakdown captions.** "Wins +14 / Losses -2 / Full clear +3" under a points number is debug telemetry: useful for designers, noise for players. If the headline number tells the story, drop the decomposition.

### Player / Roster Card Pattern

Profile cards, leaderboard rows, friend cards — any surface that summarizes a *player + character* — should follow this shape:

- **Magazine-zigzag rows over a uniform grid.** Stack full-width rows vertically and alternate which side carries the portrait (`row 1: portrait | meta`, `row 2: meta | portrait`, etc., via a `--reversed` modifier on every other row). A grid of identical cards reads as a roster export; alternating rows reads as a curated character page.
- **Cap the portrait to ~200–240px on desktop.** A full-bleed portrait dominating an info-dense card eats half the row without earning it. Keep the portrait at 4:5 (`aspect-ratio: 4 / 5`) and ~220px wide; let the meta column take the rest. On mobile collapse to a single column with the portrait at 16:11 (banner-style) and a tight `object-position: 50% 18%` so the face stays visible.
- **Card content order, top to bottom**: small kicker (style/class tag + level), big character name, *what they do* callout (passive/ability description, sage-tinted left-bordered box — see below), level progress bar with `current / next → Level N+1` caption, stat tiles. This answers "who is this, what do they do, how am I progressing, how have they done in battle" in that priority order.
- **Show ability description, not generic lore.** On a player-facing roster card, "what does this character do in a fight?" beats abstract flavor text every time. Pull from `passive.description` / `active.description` and lead with the ability *name* in caps + description below. If the character has both, prefer the passive — it's the always-on identity.
- **Reuse the existing progress-bar idiom.** The character level bar uses the same sage→amber gradient track as the season-progress bar (`linear-gradient(90deg, #7d9b6b, #d8ba66)`). Don't invent a new visual vocabulary for the same metaphor (linear progression toward a threshold).
- **Filter to active state, not the full catalogue.** A profile shows characters the player has *touched* (any wins/losses/draws or any mycelium earned), not all six characters with zero stats — empty rows make the card list feel padded.

### Sharable Page Pattern

When adding a screen users would want to share with friends (profile, roster, run summary, leaderboard entry):

- **Scaffold the URL identifier from the start.** Add the route to `ROUTE_PARAMS` in `web/src/api.js` (`profile: 'profilePlayerId'`, etc.) and write the current user's id into the URL when they navigate to that screen — even before the backend public-fetch endpoint exists. The URL identity is half the value.
- **Pair the URL with a share button.** Use `navigator.share` with a clipboard-copy fallback (the friends-screen and profile-screen patterns are the canonical implementations). Show a "Copied" / "Shared" confirmation pill for ~1.6s on success.
- **Be honest about backend gaps.** When the public-fetch endpoint isn't built yet, render the page from local bootstrap data and document the limitation: the URL plumbing is correct, but a friend opening *your* shared URL will see *their own* page until the public endpoint lands. Don't fake cross-player rendering with stale or invented data.

### Profile Page

- **Section order: characters → season/rank → achievements journal.** Lead with what the player came to look at (their roster + identity), then the abstract metric (rank), then the long catalogue (achievements). Inverting this — putting the rank card on top — buries the player's personal connection to the page behind a leaderboard number.
- **Header carries identity, not metrics.** Player display name as the heading, `#friendCode` as the handle, share button on the right. No stats in the header itself — those belong on the character cards or the season card.
- **Compact season card after the roster.** Three-column header (emblem | copy | total points) with a full-width progress bar and a single "X to next rank" footer line. Drop the peak-rank breakdown, "first 7 wins count for rank" hint, and "season chapter" footnote — those are help-modal copy, not card copy.

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
- **Media-query overrides come AFTER the base rules they override.** Equal-specificity rules win by source order, and bundlers do not reshuffle by media-query specificity. If `@media (max-width: 540px) .X { ... }` precedes the base `.X { ... }` in source, the mobile override is silently dead in the bundle. Either co-locate base + mobile pairs tightly, or keep all media queries at the end of their feature block. JS test suites cannot catch this — only a fresh mobile screenshot can.
- **Reuse existing visual primitives for the same metaphor.** Linear progression bars (season points, character level, run progress) all use the sage→amber gradient track at 8–10px height with `border-radius: 999px`. Tonal card tints (defeat, cleared, ended, level-down) all use the same `linear-gradient(135deg/160deg, <accent>, <fade>), <surface>` recipe. Stat tiles all use the `dt`/`dd` pattern with `order: -1` on `dd`. Adding a parallel implementation for a metaphor that already has a primitive in the codebase is a smell — find the existing one and extend it, or refactor the existing one if the new use case really needs different shape.

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

### Dated Design Signals (App Surfaces)

Before reporting a design change as done, scan the changed surface for these signals. Each one is *presumed dated* in the Mini App unless a specific reason is documented. Fix or justify.

- **Gradients on panels, stat tiles, headers, or chips.** Soft fades from tinted-to-transparent for "depth" are the single most common dated pattern in this repo's recent UI work. Replace with a solid tint from the pastel palette.
- **Decorative top accent bars** (`::before` stripes, 3px colored lines) that do not carry state or section info. Delete — use the panel fill to communicate outcome.
- **Chip clusters used for read-only info.** Tagline-style facts (`vs X · Урон +2 · Броня +4`) rendered as four or five chip pills in a row look like filter UI. Convert to inline middot text unless the chips are actually tappable.
- **Wide stat cards with tiny values.** A stat tile stretching to 400+px wide with a 1.15em number in the middle looks empty and dated. Either cap the container width or scale the value up (≈1.9–2.2rem).
- **Classic `dt` above `dd` stat layout.** Label-on-top / value-on-bottom with both at similar sizes reads as a 2010s definition-list component. Reverse the visual order (`order: -1` on `dd`) and make the value dominant.
- **`auto-fit` grids silently stacking to one column.** If the screenshot shows stat tiles vertically stacked when they should be side-by-side, the `minmax` floor is too high for the container. Force the known column count explicitly.
- **Sign conveyed only in text color.** A `-8` that is red-on-cream without a rose-tinted background is easy to miss. Shift the tile fill as well.
- **Box-shadow + border + gradient on the same element.** Triple-layered depth is a 2014–2017 signature. Pick one treatment.
- **Hardcoded `+` prefix in templates.** `+{{ value }}` renders `+-2` for negative values. Always go through `formatDelta` (or equivalent) so the sign is correct.
- **Full-bleed focused panels on desktop.** A single result/outcome card stretching across 1200px+ screen width should have a `max-width` cap (≈520–560px) with `margin: auto`.
- **Plain panel next to tinted sibling cards.** A `.panel` with the default surface background sitting next to richly gradient-tinted neighbors reads as unstyled. If the surface is part of a stack of cards that already carry tonal backgrounds, give it tonal identity too.
- **A subset-of-totals as a separate card.** Surfacing "Completion bonus: +20" as its own card while a sibling already shows "Earned this run: +36" forces the player to mentally subtract one from the other. Pick one — totals OR components, never both.
- **Technical breakdown captions under a number.** Captions like "Wins +14 / Losses -2 / Full clear +3" decompose a number that the big headline already implies. The breakdown is debug copy; drop it unless the player can act on each component.
- **Full-bleed portrait dominating an info-dense card.** When the meta column also has to carry a name, ability, progress bar, and stats, a portrait taking 45–50% of card width starves the meta of horizontal space. Cap portraits to ~200–240px on player/roster cards and let the meta column run.
- **Generic lore copy where ability description belongs.** A profile or roster card that says "the first sign of the deep ring shows on the mycelium…" instead of "after a successful stun, this character's next hit deals +2 damage" is failing the player's actual question ("what does this do in a fight?"). Pull from gameplay descriptions, not flavor text, on player-facing cards.
- **Inventing a new visual idiom for an existing metaphor.** A second style of progress bar (different colors, different height, different easing) on the same screen as the canonical one signals nothing new — it just makes the page feel less unified. Reuse the existing primitive when the metaphor matches.

If any signal is present and the agent cannot justify keeping it, the design change is not done — fix it before reporting completion. When in doubt about whether a treatment is "modern," flat-first is the safer default in this repo.

### Adapting Guidance From Other Repos

- Do not paste app-dashboard guidance directly into this project.
- Translate outside guidance into repo-native terms: markdown structure, renderer CSS, Vue components, game-data definitions, and Telegram Mini App constraints.
- Keep all UI surfaces consistent with the same mushroom-world visual direction unless product requirements clearly differ.
