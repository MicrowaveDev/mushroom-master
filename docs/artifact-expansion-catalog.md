# Artifact Expansion Catalog

**Purpose:** candidate artifact ideas for turning the current catalog into a fuller game-feeling loot pool.

The live game currently has 45 artifact definitions in `app/server/game-data.js`: 24 normal combat artifacts, 6 character shop items, 8 shop bags, 6 signature starters, and the starter bag. This catalog proposes 68 more candidates: 18 in the first implementation wave and 50 reserve candidates. That would bring the long-term concept pool to 113 artifacts before future mechanic-only ideas.

This is intentionally not wired into `game-data.js` yet. Live shop artifacts need production bitmap assets, image provenance, visual-classification snapshot updates, and balance validation. Use this doc as the source list for the next implementation batches.

## Guardrails

- All Phase A candidates below fit the current combat model: `damage`, `armor`, `speed`, `stunChance`, price 1-3, footprint, optional replay-only `battleEffect`, and no hidden status rules.
- `poison`, `freeze`, `ferment`, `flash`, `biostasis`, and `decay` are visual tags only until `docs/game-requirements.md` adds new mechanics.
- Every promoted artifact needs a real bitmap under `web/public/artifacts/{artifact_id}.png`, generated through the artifact bitmap workflow.
- Character items should use `characterItem: { mushroomId, requiredLevel }`; suggested levels below assume the existing level-5 items stay as the first unlock tier.
- Russian names are draft flavor, not localization sign-off.

## Priority Batch

These 18 are the strongest first implementation wave: broad silhouettes, clear stats, and strong lore hooks. Start here if the next task is "make them playable".

| ID | Name | Source | Role | Size | Cost | Candidate bonus | Visual target |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| `kirt_mantrap_claws` | Kirt's Mantrap Claws / Когти-Ловушки Кирт | Kirt, Thorn Crown | damage | 2x1 | 2 | `damage +5`, `stunChance +5`, `armor -1` | Paired carnivorous clamp-claws, like a mantrap snapping shut, violet hinge, neon-green toothed inner lips. |
| `thalla_golden_veil_pin` | Golden Veil Pin / Булавка Золотой Вуали | Thalla, Golden Reliquary | stun | 1x1 | 1 | `stunChance +7` | Sacred gold pin trailing a small paralysis veil. |
| `lomie_portal_dust_vial` | Portal Dust Vial / Склянка Портальной Пыли | Lomie, Glass Mycelium | stun | 1x1 | 1 | `stunChance +6`, `speed +1` | Tiny vial of violet-green portal dust, white star-spores escaping through a cork. |
| `axilin_ginger_bite_root` | Ginger Bite Root / Кусающий Имбирный Корень | Axilin, Ginger | damage | 1x1 | 2 | `damage +4`, `speed +1`, `armor -1` | Angry mandrake-like ginger root charm with one bitten side and amber bubbles. |
| `dalamar_pallid_moth_pin` | Pallid Moth Pin / Булавка Бледной Моли | Dalamar, silent crypt | stun | 1x1 | 1 | `stunChance +8`, `armor +1`, `damage -1` | Porcelain-white moth with black wing veins and green mold sparks. |
| `morga_first_bloom_spur` | First Bloom Spur / Шпора Первого Цвета | Morga, opener tempo | damage | 1x1 | 2 | `damage +3`, `speed +2`, `armor -1` | Sharp bloom-spur bursting forward with a short flash trail. |
| `hyphae_corset_lace` | Hyphae Corset Lace / Шнуровка Гифного Корсета | Thalla, living corset | armor | 2x1 | 2 | `armor +4`, `stunChance +4` | Braided gold-white corset lace, protective and invasive. |
| `triple_knot_seed` | Triple Knot Seed / Семя Тройного Узла | Lomie, Triple Knot staff | stun | 2x1 | 2 | `stunChance +12`, `speed +1` | Three lattice bulbs joined on one black twig, void glowing through the cells. |
| `sour_vinegar_ampoule` | Sour Vinegar Ampoule / Ампула Синего Уксуса | Axilin, blue vinegar | damage | 1x1 | 1 | `damage +3`, `armor -1` | Tiny blue-violet acid ampoule with amber stopper and sour vapor. |
| `rainpuff_mine` | Rainpuff Mine / Мина-Дождевик | Kirt, explosive traps | stun | 2x1 | 2 | `stunChance +16`, `damage -1` | Low puffball mine with a green fuse and violet spore pressure. |
| `sound_eater_velvet` | Sound-Eater Velvet / Бархат Пожирателя Звука | Dalamar, crypt walls | armor | 2x1 | 2 | `armor +4`, `stunChance +6`, `speed -1` | Folded white mold-velvet pad absorbing a black sound ripple. |
| `afterimage_cap` | Afterimage Cap / Шляпка-Послеслед | Morga, speed trail | stun | 2x1 | 2 | `stunChance +10`, `speed +2` | A cap smeared into two flash silhouettes across the footprint. |
| `bone_cocoon_greaves` | Bone Cocoon Greaves / Поножи Костяного Кокона | Thalla, bone cocoon | armor | 1x2 | 2 | `armor +5`, `speed -1` | Tall bone-white leg armor wrapped with golden mycelium. |
| `mirrorfloor_shard` | Mirrorfloor Shard / Осколок Зеркального Пола | Lomie, black reflective floor | armor | 1x1 | 1 | `armor +2`, `speed +1` | Black glass shard reflecting cold portal light. |
| `overpressure_retort` | Overpressure Retort / Перегретая Реторта | Axilin, lab accident | damage | 2x2 | 3 | `damage +9`, `speed +1`, `armor -2` | Bulging amber retort about to pop, one object filling all four cells. |
| `green_star_sight` | Green Star Sight / Прицел Зеленой Звезды | Kirt, targeting star | damage | 1x1 | 1 | `damage +2`, `speed +1` | Small neon-green sight charm with violet arrow notch. |
| `ash_library_urn` | Ash Library Urn / Урна Библиотеки Пыли | Dalamar, dust archive | stun | 2x2 | 3 | `stunChance +24`, `armor +3`, `damage -2` | Square ceremonial urn of gray artifact dust, black lid, pale mold seal. |
| `flashstep_tendon` | Flashstep Tendon / Сухожилие Мгновенного Шага | Morga, initiative | damage | 1x2 | 2 | `damage +4`, `speed +2`, `armor -1` | Vertical living tendon pulled taut, bright flash knots at each end. |

## General Shop Candidates

These are not character-gated. They should roll in normal shops once their images are ready.

### Damage

| ID | Name | Lore hook | Size | Cost | Candidate bonus | Visual target |
| --- | --- | --- | ---: | ---: | --- | --- |
| `rotlight_lantern` | Rotlight Lantern / Фонарь Гнилостного Света | Thalla's decay-fed light | 2x1 | 2 | `damage +4`, `armor +1` | Horizontal bone lantern with warm gold rotlight inside. |
| `portal_cut_sickle` | Portal-Cut Sickle / Серп Портального Разреза | Lomie cutting space | 2x1 | 2 | `damage +5`, `speed +1`, `armor -2` | Curved void sickle crossing a violet portal edge. |
| `ferment_sea_pearl` | Fermentation Sea Pearl / Жемчужина Моря Ферментации | amber fermentation seas | 2x2 | 3 | `damage +8`, `speed +1`, `armor -2` | Heavy amber pearl with pressure bubbles and sour green cracks. |
| `spore_burst_arrow` | Spore-Burst Arrow / Споровзрывная Стрела | Kirt's bio-archery | 2x1 | 2 | `damage +6`, `stunChance +4`, `armor -2` | Chunky arrow pod, violet shaft, green puffball warhead. |
| `rustbone_key` | Rustbone Key / Ржавокостный Ключ | Dalamar unlocking dead gates | 1x2 | 2 | `damage +4`, `stunChance +5` | Tall black-bone key corroding into ash at the teeth. |
| `snaplight_husk` | Snaplight Husk / Щелкающая Свето-Шелуха | Morga's quick burst | 2x1 | 2 | `damage +4`, `speed +2`, `armor -1` | Split seed husk mid-snap with a small flash line between halves. |
| `amber_needle_swarm` | Amber Needle Swarm / Рой Янтарных Игл | Ygg-Mycel defensive fauna | 2x2 | 3 | `damage +9`, `speed -1`, `armor -2` | Cluster of thick amber stingers orbiting one resin node. |
| `crownthorn_cleaver` | Crownthorn Cleaver / Колючий Секач Кроны | Thorn Crown branches | 1x2 | 2 | `damage +5`, `armor -1` | Vertical black-branch cleaver with green resin teeth. |

### Armor

| ID | Name | Lore hook | Size | Cost | Candidate bonus | Visual target |
| --- | --- | --- | ---: | ---: | --- | --- |
| `star_spore_sash` | Star-Spore Sash / Пояс Звездных Спор | Lomie star-spore clothing | 2x1 | 2 | `armor +3`, `speed +1` | Flowing indigo sash with white spore constellations. |
| `trophy_helm_plate` | Trophy Helm Plate / Пластина Трофейного Шлема | Kirt's trophy wall | 1x1 | 1 | `armor +3`, `speed -1` | Bitten metal plate patched with green resin. |
| `gingerroot_filter` | Gingerroot Filter / Имбирный Фильтр | Ginger as living filter | 1x2 | 2 | `armor +3`, `damage +1` | Tall root-filter cartridge with amber fluid draining through it. |
| `voidglass_pauldron` | Voidglass Pauldron / Пустотный Наплечник | Lomie void glass | 1x2 | 2 | `armor +4`, `speed +1` | Tall green-violet glass shoulder plate with a black slit. |
| `golden_garden_carapace` | Golden Garden Carapace / Панцирь Золотого Сада | Thalla's garden armor | 2x2 | 3 | `armor +7`, `stunChance +4`, `damage -1` | Broad shell grown from gold oysters and white mycelium. |
| `amber_resin_shield` | Amber Resin Shield / Щит Янтарной Смолы | Axilin stabilized resin | 2x1 | 2 | `armor +5`, `speed -1` | Wide amber shield with trapped bubbles and bark rim. |
| `porcelain_mold_mask` | Porcelain Mold Mask / Фарфоровая Маска Плесени | Dalamar porcelain decay | 1x1 | 2 | `armor +3`, `stunChance +4` | White porcelain face shard with black eye hollow and mold sparks. |
| `living_bark_latch` | Living Bark Latch / Живая Кора-Застежка | Ygg-Mycel tissue | 1x1 | 1 | `armor +2`, `damage +1` | Small bark clasp that looks like it is still breathing. |

### Stun And Control

| ID | Name | Lore hook | Size | Cost | Candidate bonus | Visual target |
| --- | --- | --- | ---: | ---: | --- | --- |
| `body_memory_splinter` | Body-Memory Splinter / Осколок Памяти Тела | Thalla's weakness | 1x1 | 2 | `stunChance +10`, `damage +1`, `speed -1` | Warm flesh-gold shard wrapped in white nerve mycelium. |
| `ramaria_snare` | Ramaria Snare / Рамариевая Петля | Kirt's antler growths | 1x2 | 2 | `stunChance +12`, `damage +2` | Tall branching coral-fungus snare with neon green tips. |
| `ashen_heart_smoke` | Ashen Heart Smoke / Дым Пепельного Сердца | Dalamar's censer | 1x2 | 2 | `stunChance +14`, `armor +1`, `speed -1` | Vertical plume from a tiny bone censer, gray-white and heavy. |
| `silent_bell_mold` | Silent Bell Mold / Плесень Беззвучного Колокола | crypt silence | 2x2 | 3 | `stunChance +26`, `armor +2`, `damage -2` | Bell-shaped mold mass, black clapper swallowed by white fuzz. |
| `crystal_rift_chime` | Crystal Rift Chime / Звон Хрустального Разлома | Crystal Rifts | 1x2 | 2 | `stunChance +15`, `speed +1`, `armor -1` | Tall crystal chime with split violet-green light. |
| `biostasis_crown_seed` | Biostasis Crown Seed / Семя Короны Биостазиса | Golden Reliquary | 2x2 | 3 | `stunChance +22`, `armor +3`, `speed -2` | Crown-like seed pod, sacred and heavy, with pale cyan glints. |
| `spore_snow_globe` | Spore Snow Globe / Шар Спорового Снега | Dalamar's ash snow | 1x1 | 1 | `stunChance +7`, `armor +1` | Tiny globe of gray-white spore snow over black roots. |
| `forgotten_crossroads_ring` | Forgotten Crossroads Ring / Кольцо Забытого Перекрестка | Lomie meets Thalla | 2x1 | 2 | `stunChance +9`, `damage +2` | Ring split between violet void and gold mycelium teeth. |

## Character Shop Ladder

These extend the existing level-5 signature items into a proper character progression ladder. Suggested unlock levels are drafts; exact thresholds should follow the live mycelium curve.

| ID | Character | Unlock | Role | Size | Cost | Candidate bonus | Fantasy |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| `thalla_living_corset` | Thalla | 8 | armor | 1x2 | 2 | `armor +5`, `stunChance +5`, `speed -1` | A living cordyceps corset lace that heals and binds with the same threads. |
| `thalla_first_host_locket` | Thalla | 12 | stun | 1x1 | 2 | `stunChance +11`, `armor +1` | A forbidden locket holding a warm memory of Ilve, her first body. |
| `thalla_gold_oyster_crown` | Thalla | 16 | armor | 2x2 | 3 | `armor +8`, `stunChance +8`, `speed -2` | Heavy golden oyster crown, regal but assimilating. |
| `lomie_mirror_route_map` | Lomie | 8 | armor | 1x2 | 2 | `armor +4`, `speed +2` | A black mirror route-map whose lines re-route incoming force. |
| `lomie_void_lattice_gate` | Lomie | 12 | armor | 2x2 | 3 | `armor +7`, `stunChance +10`, `damage -1` | A miniature lattice gate with void held in three fungal cells. |
| `lomie_white_spore_cloud` | Lomie | 16 | stun | 2x1 | 2 | `stunChance +13`, `speed +2`, `armor -1` | A soft white spore cloud that bends position and timing. |
| `axilin_blue_vinegar` | Axilin | 8 | stun | 1x2 | 2 | `stunChance +10`, `damage +2` | A tall blue vinegar flask made with stolen portal dust. |
| `axilin_grot_pressure_cap` | Axilin | 12 | damage | 2x1 | 2 | `damage +6`, `speed +1`, `armor -2` | A cap from the Bubbling Grot inflated to unsafe pressure. |
| `axilin_ginger_overdrive` | Axilin | 16 | damage | 2x2 | 3 | `damage +10`, `speed +1`, `armor -3` | Ginger-processed elixir core, powerful and rude. |
| `kirt_green_star_sight` | Kirt | 8 | damage | 1x1 | 1 | `damage +2`, `speed +1` | Her targeting star miniaturized into a bow-sight charm. |
| `kirt_rainpuff_quiver` | Kirt | 12 | stun | 2x1 | 2 | `stunChance +14`, `damage +3`, `armor -1` | A living quiver packed with explosive puffballs. |
| `kirt_black_wind_bowchip` | Kirt | 16 | damage | 2x2 | 3 | `damage +8`, `stunChance +8`, `armor -2` | A chipped knot from Black Wind of the Abyss, still pulsing violet. |
| `morga_snaplight_claw` | Morga | 8 | damage | 1x1 | 2 | `damage +3`, `speed +2` | A small snap-claw that opens like a flash trap. |
| `morga_afterimage_cap` | Morga | 12 | stun | 2x1 | 2 | `stunChance +10`, `speed +2` | A cap split into several visible positions at once. |
| `morga_opening_bell_spore` | Morga | 16 | damage | 2x2 | 3 | `damage +7`, `speed +2`, `armor -2` | A bell-spore that rings only at the beginning of a fight. |
| `dalamar_ash_moth_pin` | Dalamar | 8 | stun | 1x1 | 1 | `stunChance +8`, `armor +1` | A pale moth pinned without a needle, held by silence. |
| `dalamar_obsidian_throne_chip` | Dalamar | 12 | armor | 1x2 | 2 | `armor +5`, `stunChance +5`, `speed -1` | A narrow obsidian throne fragment dusted with white mold. |
| `dalamar_dead_gate_seal` | Dalamar | 16 | stun | 2x2 | 3 | `stunChance +25`, `armor +2`, `damage -2` | Seal from the Dead City gate, already crumbling into useful dust. |

## Bag And Container Candidates

These add puzzle variety without changing combat math. They should be tuned carefully because bag density shapes the whole run economy.

| ID | Name | Shape | Cost | Slot count | Fantasy |
| --- | --- | --- | ---: | ---: | --- |
| `thorn_crown_quiver` | Thorn-Crown Quiver / Колчан Колючей Кроны | `1x3` | 3 | 3 | Tall black-branch quiver with green resin seams, good for vertical planning. |
| `glass_cocoon_pack` | Glass Cocoon Pack / Стеклянный Кокон-Ранец | `2x3` | 3 | 6 | Lomie-style transparent cocoon, large but visually fragile. |
| `ferment_bladder_bag` | Ferment Bladder Bag / Бродильный Пузырь | `2x2` | 3 | 4 | Axilin's elastic amber bladder, warm and swollen. |
| `ash_urn_case` | Ash Urn Case / Футляр Пепельной Урны | `2x2` | 3 | 4 | Dalamar storage urn with a heavy quiet lid. |
| `golden_reliquary_purse` | Golden Reliquary Purse / Кошель Золотого Реликвария | `2x1` | 2 | 2 | Small ceremonial purse for early expansion. |
| `snapjaw_pouch` | Snapjaw Pouch / Пасть-Сумка | `3x2` mask `[[1,1,1],[1,0,1]]` | 3 | 5 | A mantrap-mouth bag with a hollow throat cell. |
| `rift_loop_sling` | Rift Loop Sling / Перевязь Разломного Кольца | `3x2` mask `[[1,1,0],[0,1,1]]` | 3 | 4 | Lomie diagonal sling shaped like a folded portal route. |
| `root_cathedral_case` | Root Cathedral Case / Корневой Соборный Футляр | `2x3` mask `[[1,1],[1,0],[1,1]]` | 3 | 5 | Root-and-ash case with a missing side chapel cell. |

## Future Mechanics Backlog

These are good fantasies, but they should not ship until the requirements and battle engine support them.

| Name | Fantasy | Required mechanic |
| --- | --- | --- |
| Mantrap Claws: snap bonus | Claws bite harder if the wielder acts first. | First-action or initiative-triggered artifact effects. |
| Living Corset: leech heal | Thalla's corset heals the owner after a stun. | Healing or lifesteal artifact effects. |
| Portal Dust: dodge step | Lomie dodges the next hit after enough speed. | Dodge/miss or one-hit shield mechanic. |
| Ginger Filter: brew counter | Each third action spikes damage. | Per-artifact action counters. |
| Rainpuff Mine: opening trap | Kirt plants a trap before combat starts. | Start-of-battle artifact triggers. |
| Ash Library Urn: stat decay | Enemy armor decays every few steps. | Persistent debuff status with duration/cap. |
| Snapjaw Pouch: adjacency bite | Items inside a mantrap bag gain attack. | Bag-local adjacency or containment synergies. |
| Glass Cocoon Pack: protected row | First item placed inside ignores one damage. | Bag membership effects with item scopes. |

## Promotion Checklist

When moving any row from this catalog into the live game:

1. Add the artifact definition to `app/server/game-data.js`.
2. Add a row to `docs/artifact-image-reference.md` with the final visual target.
3. Generate and validate `web/public/artifacts/{artifact_id}.png` through `docs/artifact-bitmap-todolist.md`.
4. Regenerate or update approved provenance in `app/shared/artifact-image-metadata.json`.
5. Update `tests/game/artifact-visual-classification.test.js`.
6. Run the smallest relevant tests, then `npm run game:artifacts:next` to confirm the image queue is clean.
