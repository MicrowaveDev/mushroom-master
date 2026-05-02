# Season Bitmap Production Todo List

Goal: every season rank emblem and run achievement has a real painted bitmap matching the artifact direction. The runtime renders the bitmap at fixed 192x192; the inline SVG in [`SeasonRankEmblem.js`](../web/src/components/SeasonRankEmblem.js) is a transitional fallback only.

Style guide: [`season-image-style-prompt.md`](season-image-style-prompt.md).

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

- [ ] `bronze.png` - `bronze`, rank emblem. Warm copper medallion with a single cream cap-dot center; thick dark contour.
- [ ] `silver.png` - `silver`, rank emblem. Cool steel medallion with two small white cap-dots side by side.
- [ ] `gold.png` - `gold`, rank emblem. Rich gold medallion with a chunky ivory star at center.
- [ ] `diamond.png` - `diamond`, rank emblem. Teal/cyan medallion with a faceted icy gem glyph at center.

### General Achievements

- [ ] `first_ring_crossed.png` - `first_ring_crossed`, general achievement. Concentric mossy ring with a small step-mark glyph at center; parchment medallion.
- [ ] `deep_run.png` - `deep_run`, general achievement. Descending mycelium root or stair motif inside a parchment medallion.
- [ ] `three_caps_taken.png` - `three_caps_taken`, general achievement. Three small mushroom caps arranged in a triangle on a parchment medallion.
- [ ] `season_bronze_spore.png` - `season_bronze_spore`, season-tier achievement. Small bright spore mote on a parchment medallion with a copper accent ring.
- [ ] `season_silver_thread.png` - `season_silver_thread`, season-tier achievement. Single woven thread loop on a parchment medallion with a steel accent ring.
- [ ] `season_gold_cap.png` - `season_gold_cap`, season-tier achievement. Small gold mushroom cap on a parchment medallion with a gold accent ring.
- [ ] `season_diamond_node.png` - `season_diamond_node`, season-tier achievement. Faceted gem-knot motif on a parchment medallion with a teal accent ring.
- [ ] `perfect_circle.png` - `perfect_circle`, general achievement. Closed wreath or full ring with a small gold accent.
- [ ] `last_spore.png` - `last_spore`, general achievement. Single bright spore mote on a darker parchment medallion; bittersweet tone.

### Character Achievements

- [ ] `thalla_spore_echo.png` - `thalla_spore_echo`, thalla character achievement. Soft green parchment medallion with a glow thread loop.
- [ ] `thalla_sacred_thread.png` - `thalla_sacred_thread`, thalla character achievement. Sacred spore-thread knot on a soft green parchment medallion.
- [ ] `lomie_soft_wall.png` - `lomie_soft_wall`, lomie character achievement. Moss-cream medallion with a small soft wall-plate motif.
- [ ] `lomie_stone_breath.png` - `lomie_stone_breath`, lomie character achievement. Moss-cream medallion with a stone-rim motif and breath line.
- [ ] `axilin_volatile_brew.png` - `axilin_volatile_brew`, axilin character achievement. Purple-grey medallion with a bubbling phial glyph.
- [ ] `axilin_ferment_storm.png` - `axilin_ferment_storm`, axilin character achievement. Purple-grey medallion with a storm-spore swirl glyph.
- [ ] `kirt_measured_rhythm.png` - `kirt_measured_rhythm`, kirt character achievement. Warm rust-olive medallion with a measured spear-mark glyph.
- [ ] `kirt_clean_path.png` - `kirt_clean_path`, kirt character achievement. Warm rust-olive medallion with a clean fang or arrow-mark glyph.
- [ ] `morga_first_bloom.png` - `morga_first_bloom`, morga character achievement. Bright spark-cream medallion with a small bloom flash glyph.
- [ ] `morga_flash_trail.png` - `morga_flash_trail`, morga character achievement. Bright spark-cream medallion with a flash trail streak glyph.
- [ ] `dalamar_ashen_veil.png` - `dalamar_ashen_veil`, dalamar character achievement. Ash-teal medallion with a small veil-mote glyph.
- [ ] `dalamar_entropy_bone.png` - `dalamar_entropy_bone`, dalamar character achievement. Ash-teal medallion with a broken crown-shard glyph.

## Notes

- The transitional inline SVG in `SeasonRankEmblem.js` covers ranks only. Achievement glyphs use a text symbol fallback in `AchievementBadge.js`.
- Once every entry has approved provenance metadata in `app/shared/season-image-metadata.json`, the SVG/text fallbacks should be removed (backlog item).
