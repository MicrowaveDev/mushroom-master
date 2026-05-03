# Achievement Image Reference

This is the canonical per-achievement visual reference for production run achievement badges. Use it to review, regenerate, or compare achievement bitmap images.

Global style lives in [season-image-style-prompt.md](season-image-style-prompt.md). Generation workflow and validation live in [season-image-todolist.md](season-image-todolist.md). Runtime achievement data lives in `app/shared/run-achievements.json`.

Production PNGs live at:

```text
web/public/achievements/{achievement_id}.png
```

## Shared Contract

- Achievement badges are run and character milestones, not rank emblems.
- Each badge should be a centered parchment-style medallion with one or two readable inner glyphs.
- The badge should explain the milestone's story: depth, wins, season tier, character identity, or final outcome.
- Season-tier achievements should visually echo the matching rank palette but remain smaller/subordinate in feel.
- Character achievements should use the character accent palette and a lore-specific motif.

## General Achievements

| Achievement ID | Name | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- | --- |
| `first_ring_crossed` | First Ring Crossed | General, first run milestone. | The arena/mycelium has learned the player's step for the first time. | Parchment medallion with concentric mossy ring and a small step-mark glyph at center. |
| `deep_run` | Deep Run | General, depth milestone. | The player reached the layer where roots remember strong fighters. | Parchment medallion with descending mycelium root or stair motif. |
| `three_caps_taken` | Three Caps Taken | General, win-count milestone. | Three victories form the first steady pattern of strength. | Parchment medallion with three small mushroom caps arranged in a triangle. |
| `perfect_circle` | Perfect Circle | General, full-clear/endurance milestone. | Every round held and the season ring closed without cracking. | Parchment medallion with closed wreath/full ring and a small gold accent. |
| `last_spore` | Last Spore | General, final-loss-with-progress milestone. | Even at the last breath, the spores left a warm trail. | Darker parchment medallion with a single bright spore mote; bittersweet but readable. |

## Season-Tier Achievements

| Achievement ID | Name | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- | --- |
| `season_bronze_spore` | Bronze Spore | Season achievement, Bronze reached. | The Deep Ring accepted the first spore of the player's season. | Parchment medallion with copper accent ring and small bright spore mote. |
| `season_silver_thread` | Silver Thread | Season achievement, Silver reached. | Silver threads now hold the player's path between rounds. | Parchment medallion with steel accent ring and single woven thread loop. |
| `season_gold_cap` | Golden Cap | Season achievement, Gold reached. | Gold settled on the cap after a strong circle. | Parchment medallion with gold accent ring and small gold mushroom cap. |
| `season_diamond_node` | Diamond Node | Season achievement, Diamond reached. | The mycelium compressed the player's path into a hard diamond node. | Parchment medallion with teal/cyan accent ring and small faceted gem-knot node. |

## Character Achievements

| Achievement ID | Character | Name | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- | --- | --- |
| `thalla_spore_echo` | Thalla | Spore Echo | Character milestone, early Thalla success. | Thalla's lash left a quiet spore-chime in the arena. | Soft green parchment medallion with glow thread loop motif. |
| `thalla_sacred_thread` | Thalla | Sacred Thread | Character milestone, stronger Thalla win path. | Victories settled like a sacred thread between light and shadow. | Soft green parchment medallion with sacred spore-thread knot. |
| `lomie_soft_wall` | Lomie | Soft Wall | Character milestone, Lomie endurance. | Lomie held pressure and kept the ring from scattering. | Moss-cream medallion with small soft wall-plate motif. |
| `lomie_stone_breath` | Lomie | Stone Breath | Character milestone, clean defensive run. | Her guard became calm as bark around an ancient trunk. | Moss-cream medallion with stone-rim motif and one breath line. |
| `axilin_volatile_brew` | Axilin | Volatile Brew | Character milestone, early Axilin aggression. | Axilin boiled fast and left a biting mark on the fight. | Purple-grey medallion with bubbling phial glyph. |
| `axilin_ferment_storm` | Axilin | Ferment Storm | Character milestone, major Axilin win path. | Where Axilin passed, the mycelium kept hissing. | Purple-grey medallion with storm-spore swirl glyph. |
| `kirt_measured_rhythm` | Kirt | Measured Rhythm | Character milestone, Kirt consistency. | Kirt caught the battle rhythm and held it to the end. | Warm rust-olive medallion with measured spear-mark glyph. |
| `kirt_clean_path` | Kirt | Clean Path | Character milestone, precise strong run. | Each clean strike cleared the path deeper into the ring. | Warm rust-olive medallion with clean fang or arrow-mark glyph. |
| `morga_first_bloom` | Morga | First Bloom | Character milestone, early Morga success. | Morga bloomed first, and the arena remembered. | Bright spark-cream medallion with small bloom flash glyph. |
| `morga_flash_trail` | Morga | Flash Trail | Character milestone, fast winning finish. | Morga's flash trail stayed at the very edge of sight. | Bright spark-cream medallion with flash trail streak glyph. |
| `dalamar_ashen_veil` | Dalamar | Ashen Veil | Character milestone, Dalamar decay pressure. | Dalamar left a gray mark of decay on enemy armor. | Ash-teal medallion with small veil-mote glyph. |
| `dalamar_entropy_bone` | Dalamar | Bone of Entropy | Character milestone, major Dalamar win path. | The ring trembled when entropy took Dalamar's side. | Ash-teal medallion with broken crown-shard glyph. |
