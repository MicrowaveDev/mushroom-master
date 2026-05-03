# Season Image Style Prompt

Goal: every season rank emblem and run-achievement badge has a real painted bitmap that matches the artifact direction in [`artifact-image-style-prompt.md`](artifact-image-style-prompt.md). Same chunky inventory-sticker language, applied to circular medallion-style emblems.

Per-rank and per-achievement purpose, motivation, type, and visual target live in [season-rank-image-reference.md](season-rank-image-reference.md) and [achievement-image-reference.md](achievement-image-reference.md). Use this style prompt for shared art direction; use the reference docs for image-specific intent.

Production PNGs live at:

```text
web/public/season-ranks/{rank_id}.png       # bronze, silver, gold, diamond
web/public/achievements/{achievement_id}.png
```

Raw imagegen exports and intermediate candidates are local-only and belong in:

```text
.agent/season-image-workspace/raw/
.agent/season-image-workspace/processed/
.agent/season-image-workspace/review/
```

These workspace folders are gitignored. The app should only consume the optimized PNGs in `web/public/`.

## Workflow

1. Run `npm run game:season:next` to print the next missing batch as imagegen prompts.
2. Generate the listed images with the imagegen skill/API, using the exact printed prompt plus this style guide. Imagegen is the artwork authoring step.
3. Save raw imagegen outputs under `.agent/season-image-workspace/raw/`, then run the chroma-key/conversion helper to write each optimized app PNG into the exact output path.
4. Run `npm run game:season:next` again until it reports all done.
5. Run `npm run game:season:validate -- --all` for coverage / edge / freshness checks.
6. Run `npm run game:season:sheet` to regenerate the deterministic contact sheet.
7. Once the user signs off, run `npm run game:season:provenance:generate` and verify with `npm run game:season:provenance:check`.

Hard rule: do not create production rank or achievement PNGs by writing a deterministic renderer that draws SVG, HTML/CSS, canvas, procedural glyph paths, or Puppeteer screenshots. Those approaches may only create temporary review scaffolds when explicitly requested as non-production placeholders, and they must not write to `web/public/season-ranks/` or `web/public/achievements/`. The only acceptable production sources are raw imagegen outputs plus deterministic local post-processing, validation, review-sheet generation, and provenance.

## Global Generation Rules

- Use the same chunky inventory-sticker language as the approved artifact pass: thick dark contour, flat cel-shaded color blocks, one or two large highlight/accent shapes, high contrast, no painted realism.
- Canvas: `192x192` square, transparent after chroma-key removal.
- Subject is one centered medallion-style emblem filling **70-86%** of the canvas on both axes. Leave at least **6 px** of fully transparent margin around all four edges.
- Generate on a flat removable chroma-key background, preferably `#ff00ff`, then remove the background locally before saving the final transparent PNG.
- No text, letters, watermarks, grid lines, cell borders, cast shadows, or frames.
- Do not bake an outer glow into the object — the UI adds its own drop shadow.
- Do not derive the image from the repo's inline SVG fallback, emoji glyph fallback, or any hardcoded vector/path template.

### Rank emblems (4 entries)

- bronze — warm copper / burnt amber medallion, single small mushroom-cap or ring glyph in cream highlight.
- silver — cool steel / pale platinum medallion, double cap glyphs (two dots / two short caps).
- gold — rich gold / warm amber medallion, star or sun glyph in ivory.
- diamond — cool teal / pale cyan medallion, faceted gem or four-pointed knot glyph in icy white.

### General achievements (9 entries)

- `season_bronze_spore` / `season_silver_thread` / `season_gold_cap` / `season_diamond_node` — match their tier's rank palette but render as a *small* spore / thread / cap / node glyph on a parchment medallion with the same tier accent ring. Visually subordinate to the matching rank emblem.
- `first_ring_crossed` — small concentric ring with a soft step-mark glyph.
- `deep_run` — descending mycelium root or stair motif on parchment.
- `three_caps_taken` — three small mushroom caps stacked or arranged in a triangle.
- `perfect_circle` — closed wreath or full ring, gold accent.
- `last_spore` — single bright spore mote on a darker parchment, bittersweet tone.

### Character achievements (12 entries — 2 per character)

Use the character's mushroom palette as the medallion accent, then a small motif from their lore line:

- thalla — soft green / parchment, glow thread or sacred knot.
- lomie — moss / cream, soft wall plate or stone-breath rim.
- axilin — fermented purple-grey / cream, bubbling phial or storm spore.
- kirt — warm rust / olive, fang or measured-strike spear-mark.
- morga — bright spark / cream, flash bloom or trail.
- dalamar — ash / muted teal, broken crown shard or veil mote.

## Validation

```bash
npm run game:season:validate -- --all
```

The validator checks:

- 192x192 RGBA canvas.
- Visible alpha coverage ≥ 18%.
- Subject bbox fills 62-94% of the canvas on both axes.
- ≥ 6 px transparent margin from every edge (no clipping).
- App PNG is newer than its raw source under `.agent/season-image-workspace/raw/`.

## Review Sheet

```bash
npm run game:season:sheet
```

Writes `.agent/season-image-workspace/review/contact-sheet.png` (deterministic; sections "Season Ranks" / "General Achievements" / "Character Achievements", sorted within each section, with a `manifest.json` tracking sha256 + changed ids).

## Approved Provenance

Once the user approves the production set:

```bash
npm run game:season:provenance:generate
npm run game:season:provenance:check
```

Writes `app/shared/season-image-metadata.json` (sha256 + prompt + validation snapshot per entry). The provenance check is what the runtime is allowed to trust — it asserts every metadata sha256 matches the file on disk and every entry is `status: approved`.

After every entry has approved metadata, runtime rendering is PNG-only; old SVG/glyph fallbacks are not production-art sources.
