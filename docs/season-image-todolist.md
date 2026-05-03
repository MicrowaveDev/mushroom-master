# Season Bitmap Production Todo List

Goal: every season rank emblem and run achievement has a real painted bitmap matching the artifact direction. The runtime renders the bitmap at fixed 192x192; the inline SVG in [`SeasonRankEmblem.js`](../web/src/components/SeasonRankEmblem.js) is a transitional fallback only.

Style guide: [`season-image-style-prompt.md`](season-image-style-prompt.md).

Production artwork rule: generate rank and achievement PNGs with imagegen from the prompts printed by `npm run game:season:next`. Do not create these bitmaps by screenshotting SVG/HTML/CSS/canvas templates, procedural glyphs, Puppeteer medallions, or any other deterministic drawing script. Scripts may be deterministic for prompt selection, raw-export processing, validation, review sheets, and provenance, but not for authoring the artwork.

Output paths:

```text
web/public/season-ranks/{rank_id}.png
web/public/achievements/{achievement_id}.png
```

Raw imagegen exports and processed candidates belong under `.agent/season-image-workspace/{raw,processed,review}/` (gitignored).

Use this command to get the next missing batch:

```bash
npm run game:season:next
```

The script skips entries whose target PNG already exists.

## Production Image Queue

### Season Ranks

- [x] `bronze.png` - `bronze`, rank emblem. Warm copper medallion with a single cream cap-dot center; thick dark contour.
- [x] `silver.png` - `silver`, rank emblem. Cool steel medallion with two small white cap-dots side by side.
- [x] `gold.png` - `gold`, rank emblem. Rich gold medallion with a chunky ivory star at center.
- [x] `diamond.png` - `diamond`, rank emblem. Teal/cyan medallion with a faceted icy gem glyph at center.

### General Achievements

- [x] `first_ring_crossed.png` - `first_ring_crossed`, general achievement. Concentric mossy ring with a small step-mark glyph at center; parchment medallion.
- [x] `deep_run.png` - `deep_run`, general achievement. Descending mycelium root or stair motif inside a parchment medallion.
- [x] `three_caps_taken.png` - `three_caps_taken`, general achievement. Three small mushroom caps arranged in a triangle on a parchment medallion.
- [x] `season_bronze_spore.png` - `season_bronze_spore`, season-tier achievement. Small bright spore mote on a parchment medallion with a copper accent ring.
- [x] `season_silver_thread.png` - `season_silver_thread`, season-tier achievement. Single woven thread loop on a parchment medallion with a steel accent ring.
- [x] `season_gold_cap.png` - `season_gold_cap`, season-tier achievement. Small gold mushroom cap on a parchment medallion with a gold accent ring.
- [x] `season_diamond_node.png` - `season_diamond_node`, season-tier achievement. Faceted gem-knot motif on a parchment medallion with a teal accent ring.
- [x] `perfect_circle.png` - `perfect_circle`, general achievement. Closed wreath or full ring with a small gold accent.
- [x] `last_spore.png` - `last_spore`, general achievement. Single bright spore mote on a darker parchment medallion; bittersweet tone.

### Character Achievements

- [x] `thalla_spore_echo.png` - `thalla_spore_echo`, thalla character achievement. Soft green parchment medallion with a glow thread loop.
- [x] `thalla_sacred_thread.png` - `thalla_sacred_thread`, thalla character achievement. Sacred spore-thread knot on a soft green parchment medallion.
- [x] `lomie_soft_wall.png` - `lomie_soft_wall`, lomie character achievement. Moss-cream medallion with a small soft wall-plate motif.
- [x] `lomie_stone_breath.png` - `lomie_stone_breath`, lomie character achievement. Moss-cream medallion with a stone-rim motif and breath line.
- [x] `axilin_volatile_brew.png` - `axilin_volatile_brew`, axilin character achievement. Purple-grey medallion with a bubbling phial glyph.
- [x] `axilin_ferment_storm.png` - `axilin_ferment_storm`, axilin character achievement. Purple-grey medallion with a storm-spore swirl glyph.
- [x] `kirt_measured_rhythm.png` - `kirt_measured_rhythm`, kirt character achievement. Warm rust-olive medallion with a measured spear-mark glyph.
- [x] `kirt_clean_path.png` - `kirt_clean_path`, kirt character achievement. Warm rust-olive medallion with a clean fang or arrow-mark glyph.
- [x] `morga_first_bloom.png` - `morga_first_bloom`, morga character achievement. Bright spark-cream medallion with a small bloom flash glyph.
- [x] `morga_flash_trail.png` - `morga_flash_trail`, morga character achievement. Bright spark-cream medallion with a flash trail streak glyph.
- [x] `dalamar_ashen_veil.png` - `dalamar_ashen_veil`, dalamar character achievement. Ash-teal medallion with a small veil-mote glyph.
- [x] `dalamar_entropy_bone.png` - `dalamar_entropy_bone`, dalamar character achievement. Ash-teal medallion with a broken crown-shard glyph.

## Notes

- The transitional inline SVG in `SeasonRankEmblem.js` covers ranks only. Achievement glyphs use a text symbol fallback in `AchievementBadge.js`.
- These runtime fallbacks are not production-art sources. Do not trace, screenshot, rasterize, or otherwise convert them into app-facing PNGs.
- Once every entry has approved provenance metadata in `app/shared/season-image-metadata.json`, the SVG/text fallbacks should be removed (backlog item).
