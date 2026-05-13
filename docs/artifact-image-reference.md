# Artifact Image Reference

This is the canonical per-artifact visual reference for production artifact bitmaps. Use it to decide what each image is for, why it exists in the game loop, and what the approved or regenerated bitmap should communicate.

Global style lives in [artifact-image-style-prompt.md](artifact-image-style-prompt.md). Generation workflow, validation, and local workspace rules live in [artifact-bitmap-todolist.md](artifact-bitmap-todolist.md). Runtime classification lives in `app/shared/artifact-visual-classification.js`; gameplay values live in `app/server/game-data.js`.

All production artifact PNGs live at:

```text
web/public/artifacts/{artifact_id}.png
```

## Shared Contract

- Every artifact image is a small, chunky, readable inventory sticker for the shop, backpack, inventory grid, replay surfaces, and review sheets.
- The bitmap should teach the player the artifact's role before they read the stat text: damage, armor, stun, utility, character signature, or container.
- The image must render as one connected object across its full grid footprint. It is not a set of repeated per-cell icons.
- Shape and orientation matter: horizontal pieces read left-to-right, vertical pieces read top-to-bottom, block pieces fill their quadrants, and bag masks suggest their occupied cells without mechanical rectangular cutouts.
- Visual detail is subordinate to mobile readability at `32px`, `48px`, and `64px`.

## Damage

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `spore_needle` | Damage, `1x1`, plain. | The smallest aggressive pickup: a compact starter attack charm that should read instantly in shop cells. | Small mushroom-headed needle or pin; cap at top, dark diagonal stem, small spore glow near the cap. |
| `sporeblade` | Damage, `1x1`, plain. | A simple cutting upgrade with sharper intent than the needle. | Short curved blade grown from spore-chitin; amber cutting edge, dark handle knot, diagonal but broad silhouette. |
| `amber_fang` | Damage, `1x2`, bright. | A stronger vertical strike item with a drawback/tradeoff feel. | One long translucent amber fang spanning both cells; upper root and shine continue into a sharp lower point. |
| `glass_cap` | Damage, `2x1`, bright. | A fragile wide attack piece; should feel brittle and dangerous without becoming realistic glass. | Glassy mushroom cap spanning both cells; underside gills and stem near the seam, highlight continues across the cap. |
| `fang_whip` | Damage, `2x1`, bright. | A wide flexible attack piece that rewards spatial planning. | Handle/root knot on the left; curving whip crosses the seam into a fang head on the right. |
| `burning_cap` | Damage, `2x2`, bright. | A large hot attack commitment; should feel powerful and costly. | Hot mushroom cap with flame core; ember cracks, red rim, lower stem/base, and contained flame glow form one large object. |
| `bubbling_grot_bomb` | Lore damage, `1x1`, bright. | A general shop artifact tied to the Bubbling Grot; gives a readable ferment hit cue without adding hidden status rules. | Round amber-red fungal flask, corked cap fuse, and contained green ferment bubbles. |
| `sour_vinegar_ampoule` | Expansion damage, `1x1`, plain. | A cheap Axilin-flavored risk pickup: efficient bite with an armor drawback. | Tiny blue-violet vinegar ampoule, amber stopper, sour vapor curl, chunky enough to fill one cell. |
| `overpressure_retort` | Expansion damage, `2x2`, radiant. | A large volatile attack commitment for players who want a high-risk damage spike. | Bulging amber retort about to pop; glassy organic body, green pressure bubbles, one connected object filling all four cells. |
| `green_star_sight` | Expansion damage/speed, `1x1`, plain. | A compact tempo pickup inspired by Kirt's targeting star. | Small neon-green sight charm with a violet arrow notch, broad star silhouette, no tiny crosshair lines. |
| `flashstep_tendon` | Expansion damage/speed, `1x2`, bright. | A vertical speed-risk piece that echoes Morga's snap-forward initiative. | Living tendon pulled taut top-to-bottom, bright flash knots at both ends, orange-white motion glow inside the silhouette. |
| `rotlight_lantern` | Deep lore damage/armor, `2x1`, bright. | Thalla-adjacent rotlight that gives attack builds a warmer defensive branch. | Horizontal bone lantern with warm gold rotlight inside and chunky side caps, filling both cells. |
| `portal_cut_sickle` | Fusion-only damage/speed, `2x1`, bright. | Lomie route-cutting fantasy created when `sporeblade` and `mirrorloop_knot` fuse after a round. | A fused portal edge plus broad curved void sickle crossing both cells; it should read as one joined result, not a normal shop blade. |
| `ferment_sea_pearl` | Deep lore damage, `2x2`, radiant. | Axilin-style high-risk pressure object for late-run damage spikes. | Heavy amber pearl with green pressure bubbles and sour cracks, one round blocky body filling all quadrants. |
| `spore_burst_arrow` | Deep lore damage/control, `2x1`, bright. | Kirt bio-archery item that mixes strike and interruption without new mechanics; quality-watch item for the footprint-aware detail pass. | Chunky arrow pod with violet shaft and green puffball warhead, connected left-to-right; avoid blur, overcompression, and tiny pod texture. |
| `rustbone_key` | Deep lore damage/control, `1x2`, bright. | Dalamar dead-gate motif as a tall attack charm. | Tall black-bone key corroding into ash at the teeth, broad bow at top and heavy key bit below. |
| `snaplight_husk` | Deep lore damage/speed, `2x1`, bright. | Morga snap-burst fantasy for faster risky strike builds. | Split seed husk mid-snap with a bright contained flash line between two chunky halves. |
| `amber_needle_swarm` | Deep lore damage, `2x2`, radiant. | Ygg-Mycel stinger swarm as a large aggressive commitment with speed/armor tradeoffs. | Cluster of thick amber stingers orbiting one resin node, dense connected block rather than loose particles. |
| `crownthorn_cleaver` | Deep lore damage, `1x2`, bright. | Thorn Crown branch made into a vertical heavy strike piece. | Vertical black-branch cleaver with green resin teeth, broad head and rooted handle. |
| `heartwood_splinter_bow` | Circle relic damage/armor, `2x1`, bright. | Ygg-Mycel heartwood as a balanced strike piece that helps attackers survive. | One broad horizontal black heartwood bow with green resin string and one amber arrowbud, chunky across both cells; avoid small bark knots and tiny end decorations. |
| `blue_vinegar_chakram` | Circle relic damage/control, `2x1`, bright. | Axilin blue vinegar shaped into a risky slicing ring with interruption flavor. | Wide blue-violet vinegar chakram with amber stopper nodes and contained green fizz, broad ring silhouette. |
| `first_bloom_cinder` | Circle relic damage/speed, `1x1`, bright. | Morga opener fantasy in a compact cell: fast, hot, and fragile. | Compact orange flower-coal with cap-like petals and one white flash slash, filling one cell. |
| `dead_city_nail` | Circle relic damage/control, `1x2`, bright. | Dalamar dead-gate hardware turned into a slow heavy puncture charm. | Tall black-bone nail with ash cap at top and corroded tooth point below, thick vertical silhouette. |
| `golden_spore_mace` | Circle relic damage/armor, `2x2`, radiant. | Thalla royal force as a large anchored attack object with defensive weight. | Heavy solid golden spore mace head with short white mycelium haft, a few large spore bumps, and one pale cyan biostasis mark; avoid dense holes or filigree. |
| `riftfang_comet` | Fusion-only damage/speed, `2x1`, bright. | Lomie rift motion created when `amber_fang` and `haste_wisp` fuse after a round. | Horizontal violet fang-comet with green rift tail and dark rim, broad enough to fill both cells. |
| `portal_vinegar_lens` | Fusion-only damage/speed, `2x1`, radiant. | Axilin sour-vinegar chemistry caught in Lomie mirror glass: fast route-cutting with a defensive tradeoff. | Wide blue-violet lens ring with an amber acid core and black mirror rim, one connected horizontal object with green fizz contained inside. |
| `deadwind_arrow` | Fusion-only damage/control, `2x2`, radiant. | Kirt bio-archery pinned through Dalamar dead-city metal, turning a normal spore arrow into a crypt projectile. | Heavy cross-shaped arrow-nail relic: violet shaft, green puffball charge, black-bone nail spine, ash cap; dense block silhouette filling all quadrants. |

## Armor

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `bark_plate` | Armor, `1x1`, plain. | Basic defensive pickup; must be clearly protective at tiny size. | Square-ish rounded bark armor slab with vertical grain and moss edge. |
| `loam_scale` | Armor, `1x1`, plain. | Small earthy defense piece, more organic than `bark_plate`. | Single curved loam plate with heavy lower mass and minimal grit marks. |
| `mycelium_wrap` | Armor, `2x1`, bright. | Wide defensive band; should read as binding/protection across cells. | Braided mycelium band with loose fibers on the left and knot or bead on the right. |
| `stone_cap` | Armor, `1x2`, bright. | Tall heavy defense piece with grounded mass. | Cracked stone mushroom cap in upper cell, thick stone stem/base below. |
| `root_shell` | Armor, `2x2`, bright. | Large protective body that anchors defensive builds. | Root-wrapped shield shell; upper shell plates and lower root tendrils form one continuous protective mass. |
| `truffle_bulwark` | Armor, `2x2`, bright/radiant defensive commitment. | The densest shield fantasy, with visible bulk and tradeoff weight. | Dense truffle shield; rough pore dome, raised lobe, moss and loam chips, grounded mass. |
| `void_cocoon_spore` | Lore armor/control, `1x2`, bright. | A general shop artifact tied to Ygg-Mycel cocoon/void imagery; teaches block-triggered frost feedback as protection. | Tall armored cocoon spore; moss-green outer plates wrap a pale frozen core and dark central void slit. |
| `hyphae_corset_lace` | Expansion armor/control, `2x1`, bright. | Defensive binding that turns Thalla's living-corset motif into a normal shop item. | Braided gold-white corset lace spanning both cells, protective knot on one side, invasive fibers on the other. |
| `sound_eater_velvet` | Expansion armor/control, `2x1`, bright. | Dalamar crypt material for slower defensive control builds. | Folded white mold-velvet pad absorbing a black sound ripple across the whole horizontal footprint. |
| `bone_cocoon_greaves` | Expansion armor, `1x2`, bright. | Heavy vertical protection with a speed tradeoff. | Tall bone-white leg armor wrapped in golden mycelium, strong upper plate and grounded lower greave. |
| `mirrorfloor_shard` | Expansion armor/speed, `1x1`, plain. | A tiny Lomie defensive-tempo piece that feels precise rather than bulky. | Black mirror-glass shard reflecting cold portal light, wide enough to avoid reading as a thin sliver. |
| `star_spore_sash` | Deep lore armor/speed, `2x1`, bright. | Lomie star-spore clothing as a light defensive tempo pickup. | Flowing indigo sash with white spore constellations, one connected ribbon across both cells. |
| `trophy_helm_plate` | Deep lore armor, `1x1`, plain. | Kirt trophy-wall scrap that gives small defense with a speed tradeoff. | Bitten metal plate patched with green resin, square enough to read as armor. |
| `gingerroot_filter` | Deep lore armor/damage, `1x2`, bright. | Axilin ginger companion motif turned into a defensive converter. | Tall root-filter cartridge with amber fluid draining through it, rooted top and heavy lower chamber. |
| `voidglass_pauldron` | Deep lore armor/speed, `1x2`, bright. | Lomie voidglass protection with precise movement flavor. | Tall green-violet glass shoulder plate with a black slit, broad enough for one-cell width. |
| `golden_garden_carapace` | Deep lore armor/control, `2x2`, radiant. | Thalla/Golden Reliquary heavy garden shell for defensive control builds. | Broad shell grown from gold oyster caps and white mycelium, one heavy object filling all quadrants. |
| `amber_resin_shield` | Deep lore armor, `2x1`, bright. | Axilin stabilized resin as a wide durable shield with tempo cost. | Wide amber shield with trapped bubbles and bark rim, strong horizontal face. |
| `porcelain_mold_mask` | Deep lore armor/control, `1x1`, bright. | Dalamar porcelain decay made into a compact defensive charm. | White porcelain face shard with black eye hollow and green mold sparks, chunky mask silhouette. |
| `living_bark_latch` | Deep lore armor/damage, `1x1`, plain. | Ygg-Mycel living tissue as a small flexible clasp. | Small bark clasp that looks like it is breathing, moss hinge and cream highlight. |
| `reliquary_bone_buckle` | Circle relic armor/control, `1x1`, plain. | A cheap Thalla defensive buckle that adds a small biostasis cue. | Compact gold-bone buckle with a sacred knot and moss-green clasp, square readable silhouette. |
| `soft_wall_tile` | Circle relic armor/speed, `2x1`, bright. | Lomie passive as normal-shop protection: softening and repositioning in one item. | Wide translucent pale-green wall tile with crystal rim and one soft bend line across both cells. |
| `ferment_glass_bracer` | Circle relic armor/damage, `1x2`, bright. | Axilin pressure vessel turned into a counterpunch bracer. | Tall amber glass bracer with green ferment bubbles, heavy cuff at top and lower pressure chamber. |
| `thornhide_scale` | Circle relic armor/damage, `1x1`, plain. | Kirt hunting hide as a small armor pickup that still bites. | Square black-bark scale with one green resin thorn and cream highlight, compact and protective. |
| `flashcap_knee_guard` | Circle relic armor/speed, `1x2`, bright. | Morga evasive defense as a tall tempo guard. | Vertical orange flashcap knee guard with moss strap and white speed stripe, connected top-to-bottom. |
| `obsidian_throne_chip` | Circle relic armor/control, `1x2`, bright. | Dalamar throne fragment for slow defensive control. | Tall broad black obsidian throne shard with simple white mold crown and one gray ash edge; avoid gritty stone texture and many small cracks. |
| `pressure_bloom_bulwark` | Fusion-only armor/damage, `2x2`, radiant. | Axilin ferment pressure forced into amber resin, becoming armor rather than a burst. | Large amber shield-flower swollen with green pressure bubbles, bark-rimmed petals and one heavy lower guard, blocky in every quadrant. |

## Stun

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `shock_puff` | Stun, `1x1`, plain. | Basic disruption charm; should read as a puff and an electric crack. | Round puffball cloud with a contained electric crack through the center. |
| `glimmer_cap` | Stun, `1x1`, plain. | Small luminous control item. | Luminous mushroom cap with star-like glint and subtle stem. |
| `dust_veil` | Stun, `1x2`, bright. | Vertical soft-control piece; should feel drifting but not wispy/noisy. | Source cap/cloud above, falling veil of spore dust fading downward. |
| `static_spore_sac` | Stun, `1x2`, bright. | Charged hanging control item. | Upper neck and static nodes continue into swollen lower membrane. |
| `thunder_gill` | Stun, `2x1`, bright. | Wide control piece with a readable fan shape. | Exposed mushroom gill with lightning veins; fan ribs continue left-to-right. |
| `spark_spore` | Stun, `2x2`, bright. | Large control commitment; should feel charged but contained. | One large charged spore orb with pale glow, electric cracks, and a few contained sparks. |
| `reliquary_biostasis_seal` | Lore stun/armor, `1x1`, bright. | A general shop artifact tied to the Golden Reliquary; communicates biostasis as a short battle-read cue. | Golden reliquary seal shaped like a mushroom-cap stamp with a sacred white knot and contained pale cyan glints. |
| `root_ash_censer` | Lore stun/armor, `2x1`, bright. | A general shop artifact tied to Ygg-Mycel root and ash imagery; gives decay/ash feedback with a restrained horizontal silhouette. | Horizontal root-ash censer with dark root handles, ash-cream ritual bowl, and carved pale spiral marks. |
| `triple_knot_seed` | Expansion stun/speed, `2x1`, bright. | Lomie route-control object for wide stun builds. | Three lattice bulbs joined on one black twig, violet void visible through the cells, white spores kept inside the silhouette. |
| `rainpuff_mine` | Expansion stun, `2x1`, bright. | Kirt-style trap fantasy with a damage tradeoff. | Low puffball mine with green fuse, violet spore pressure line, broad horizontal body. |
| `afterimage_cap` | Expansion stun/speed, `2x1`, bright. | Morga tempo-control piece that should feel fast without adding hidden mechanics. | A cap smeared into two flash silhouettes across the footprint, left origin and right afterimage connected by light. |
| `ash_library_urn` | Expansion stun/armor, `2x2`, radiant. | Big Dalamar control commitment with defensive support and damage tradeoff. | Square ceremonial urn of gray artifact dust, black lid, pale mold seal, one heavy object filling all quadrants. |
| `body_memory_splinter` | Deep lore stun/damage, `1x1`, bright. | Thalla body-memory theme as a compact interrupt charm with a speed tradeoff. | Warm flesh-gold shard wrapped in white nerve mycelium, compact but not needle-thin. |
| `ramaria_snare` | Deep lore stun/damage, `1x2`, bright. | Kirt coral-fungus trap for tall control planning. | Tall branching coral-fungus snare with neon green tips and connected lower root. |
| `ashen_heart_smoke` | Deep lore stun/armor, `1x2`, bright. | Dalamar censer plume for slow heavy control builds. | Vertical plume from a tiny bone censer, gray-white smoke with a dense readable silhouette. |
| `silent_bell_mold` | Deep lore stun/armor, `2x2`, radiant. | Crypt silence as a large control commitment. | Bell-shaped mold mass, black clapper swallowed by white fuzz, one blocky object filling all quadrants. |
| `crystal_rift_chime` | Deep lore stun/speed, `1x2`, bright. | Lomie rift sound as vertical tempo control. | Tall crystal chime with split violet-green light and thick dark rim. |
| `biostasis_crown_seed` | Fusion-only stun/armor, `2x2`, radiant. | Golden Reliquary sacred control object created when `reliquary_biostasis_seal` and `triple_knot_seed` fuse after a round. | Crown-like seed pod, sacred and heavy, with pale cyan glints and broad base. |
| `spore_snow_globe` | Deep lore stun/armor, `1x1`, plain. | Dalamar ash snow as a tiny defensive-control pickup. | Tiny globe of gray-white spore snow over black roots, round clear silhouette. |
| `forgotten_crossroads_ring` | Deep lore stun/damage, `2x1`, bright. | Lomie/Thalla crossroads as a wide hybrid control charm. | Ring split between violet void and gold mycelium teeth, stretched as one horizontal emblem. |
| `spore_lullaby_conch` | Circle relic stun/armor, `2x1`, bright. | Thalla command-over-body fantasy in a wide control charm. | Horizontal pale-gold fungal conch with white spore curls kept inside the outline and dark lip. |
| `mirrorloop_knot` | Circle relic stun/speed, `1x1`, plain. | Lomie mirror-route logic as a tiny tempo interrupt. | Compact black-violet loop knot with green mirror highlight and one pale spore bead. |
| `ginger_spark_bottle` | Circle relic stun/damage, `1x2`, bright. | Axilin ginger alchemy as a tall bottle that pops into disruption. | Tall ginger-shaped amber bottle with yellow spark cork and green fizz core, chunky vertical form. |
| `abyss_bow_knot` | Fusion-only stun/damage, `2x2`, radiant. | Kirt Black Wind bow material created when `heartwood_splinter_bow` and `mirrorloop_knot` fuse after a round. | Heavy black-violet bow knot with green resin eye and amber string arcs, filling all quadrants. |
| `opening_bell_spore` | Fusion-only stun/speed, `2x2`, radiant. | Morga opening tempo created when `afterimage_cap` and `first_bloom_cinder` fuse after a round. | Bell-shaped orange spore split by a white flash petal, broad base and contained yellow glow. |
| `entropy_scepter_tip` | Circle relic stun/armor, `1x2`, bright. | Dalamar scepter fragment as vertical ash-control support. | Tall ash-gray scepter tip with porcelain crown and black shard core, thick enough for one-cell width. |
| `reliquary_ash_crown` | Fusion-only stun/armor, `2x2`, radiant. | Thalla sacred reliquary command filtered through Ygg-Mycel root ash and Dalamar-like stillness. | Heavy gold-and-ash crown seed, white mold rim, black root bowl, pale cyan stillness marks; sacred but funerary, filling all quadrants. |
| `snap_lullaby_bell` | Fusion-only stun/damage/speed, `2x1`, radiant. | Thalla body-command lullaby accelerated by Morga's snaplight opening pressure. | Horizontal pale-gold bell-conch cracked by an orange snap flash, broad lip on the left and speed slash on the right. |
| `riftpuff_snare` | Fusion-only stun/speed, `2x2`, radiant. | Lomie route geometry folded around Kirt's rainpuff mine, making a trap that arrives from a neighboring path. | Square rift trap with violet-green portal frame, central puffball mine, black route loop and neon snare teeth; one dense object in all quadrants. |

## Hybrid / Utility

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `moss_ring` | Utility, `1x1`, plain. | Compact flexible charm; should look like a neutral support pickup. | Mossy ring charm with circular moss edge and pale center. |
| `haste_wisp` | Utility/speed, `1x1`, plain. | Speed-forward item that must avoid reading as pure damage. | Compact speed leaf/flame emblem with one bright tip and one motion stripe, 2-3 large shapes only. |

## Character Shop Artifacts

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `thalla_sacred_thread` | Thalla signature, `1x2`. | Character-specific sacred thread motif; connects to Thalla's spore-thread/lash identity. | Glowing knot/charm above, long trailing thread and spore beads below. |
| `lomie_crystal_lattice` | Lomie signature, `2x1`. | Character-specific protection motif; should feel defensive and structured. | Left crystal frame and right crossing lattice complete one protective pattern. |
| `axilin_ferment_core` | Axilin signature, `1x2`. | Character-specific fermentation/alchemy motif. | Organic glass top, denser glowing liquid below, bubbles rising through both cells. |
| `kirt_venom_fang` | Kirt signature, `1x1`. | Compact strike charm tied to Kirt's measured precision. | Curved fang with a small venom dot, broad enough to avoid a skinny icon. |
| `morga_flash_seed` | Morga signature, `2x1`. | Character-specific speed/burst motif. | Seed body on the left, light trail and crackle extending right. |
| `dalamar_ashen_shard` | Dalamar signature, `1x2`. | Character-specific decay/entropy motif. | Broken crown above, tapering shard point and falling gray dust below. |
| `thalla_golden_veil_pin` | Thalla level-8 signature, `1x1`. | A smaller control charm tied to the Golden Veil and paralysis dust. | Sacred gold pin with a small trailing veil; pale cyan biostasis glint contained inside the silhouette. |
| `lomie_portal_dust_vial` | Lomie level-8 signature, `1x1`. | Portable portal-dust control charm. | Tiny vial of violet-green dust, white star-spores escaping through a cork, broad glass body. |
| `axilin_ginger_bite_root` | Axilin level-8 signature, `1x1`. | Ginger-root companion fantasy made into a compact strike item. | Angry mandrake-like ginger root charm with one bitten side and amber bubbles. |
| `kirt_mantrap_claws` | Kirt level-8 signature, `2x1`. | The requested mantrap-like claws: predatory, toxic, and readable as Kirt's pressure tool. | Paired carnivorous clamp-claws snapping shut, violet hinge, neon-green toothed inner lips, one horizontal object. |
| `morga_first_bloom_spur` | Morga level-8 signature, `1x1`. | Opener-tempo charm that carries Morga's first-bloom pressure. | Sharp bloom-spur bursting forward with a short flash trail, chunky flower-thorn silhouette. |
| `dalamar_pallid_moth_pin` | Dalamar level-8 signature, `1x1`. | Silent crypt moth charm with decay-control flavor. | Porcelain-white moth with black wing veins and green mold sparks, pinned by silence rather than a needle. |
| `thalla_first_host_locket` | Thalla mastery, `1x1`, level 12. | Forbidden memory of Ilve as a compact biostasis/control charm. | Warm gold locket with white nerve-mycelium clasp and a pale cyan stillness glint, one chunky cell. |
| `thalla_gold_oyster_crown` | Thalla mastery, `2x2`, level 16. | Heavy royal garden armor that feels like a throne and a living crown. | Golden oyster crown grown from layered caps and white mycelium, broad sacred block filling all quadrants. |
| `lomie_mirror_route_map` | Lomie mastery, `1x2`, level 12. | A defensive route-map that turns her soft-wall fantasy into a tall planning relic. | Tall black-violet mirror tablet with thick frame, 2-3 broad teal route lines, and a few large gate dots; avoid icy texture, cracks, and many tiny nodes. |
| `lomie_void_lattice_gate` | Lomie mastery, `2x2`, level 16. | Miniature void gate for late defensive-control builds. | Square green-violet lattice gate holding a black void center, one connected block with four corner knots. |
| `axilin_blue_vinegar_flask` | Axilin mastery, `1x2`, level 12. | Tall portal-vinegar stun flask, more dangerous than the normal ampoule. | Tall blue-violet vinegar flask with amber stopper, green fizz core, and chunky glass belly. |
| `axilin_ginger_overdrive` | Axilin mastery, `2x2`, level 16. | Volatile ginger engine for high-risk damage spikes. | Large ginger-red overdrive core with amber glass chambers and green pressure bubbles, dense block form. |
| `kirt_rainpuff_quiver` | Kirt mastery, `2x1`, level 12. | Living trap quiver for control-heavy Kirt builds. | Horizontal black-branch quiver packed with green puffballs and amber thorn binding, one wide object. |
| `kirt_black_wind_bowchip` | Kirt mastery, `2x2`, level 16. | Black Wind of the Abyss as a high-risk strike relic. | Heavy black-violet bow knot chip with neon green eye and amber string arcs, dense in all quadrants. |
| `morga_afterimage_crown` | Morga mastery, `2x1`, level 12. | Speed-control crown that appears in two places at once. | Two readable crown silhouettes, left solid and right translucent, connected by one white speed band; must not read as a flame smear. |
| `morga_bellstrike_calyx` | Morga mastery, `2x2`, level 16. | Opening-bell damage relic distinct from the normal control spore. | Large orange bell-flower calyx with white flash clapper and red damage petals, filling all quadrants. |
| `dalamar_throne_splinter` | Dalamar mastery, `1x2`, level 12. | Obsidian-throne armor shard for slow control builds. | Tall black obsidian splinter with white mold crown and ash-gray side plates, heavy vertical silhouette. |
| `dalamar_dead_gate_seal` | Dalamar mastery, `2x2`, level 16. | Dead City gate seal as a late control commitment. | Square bone-gray gate seal crumbling into ash, black keyhole center, white mold rim, one heavy block. |

## Signature Starters

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `spore_lash` | Starter/signature, `1x1`. | Thalla starter direction and approved style anchor. | Coiled lash with star/spore tip. |
| `settling_guard` | Starter/signature, `1x1`. | Lomie starter direction and approved style anchor. | Small shield cap resting on a flat base line. |
| `ferment_phial` | Starter/signature, `1x1`. | Axilin starter direction and approved style anchor. | Flask with bubbling fluid. |
| `measured_strike` | Starter/signature, `1x1`. | Kirt starter direction and precision motif. | Precise spear/marker with a horizontal balance line. |
| `flash_cap` | Starter/signature, `1x1`. | Morga starter direction and approved style anchor. | Small cap with speed sparks around it. |
| `entropy_shard` | Starter/signature, `1x1`. | Dalamar starter direction and entropy motif. | Angular dark shard with crossed fracture lines. |

## Bags

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `starter_bag` | Bag/container, `3x3`. | Default container fantasy for the inventory system. | Soft canvas starter bag with stitched upper flap, centered clasp, folds, and base seam across all nine cells. |
| `moss_pouch` | Bag/container, displayed `2x1` from legacy `1x2` data. | Small early container; it must match the game's landscape display orientation. | Horizontal mossy drawstring pouch/satchel spanning both cells, with mouth, tie, and rounded belly continuing left-to-right. |
| `amber_satchel` | Bag/container, `2x2`. | Medium container with warmer material language. | Amber leather satchel; handle/top flap span upper cells, amber clasp centered across lower body. |
| `trefoil_sack` | Bag/container, `3x2` T-mask. | Irregular bag that teaches non-rectangular container placement. | Three-lobed clover-like top pouch with one hanging lower lobe from the center; side lower cells are logical placement holes. |
| `birchbark_hook` | Bag/container, `3x2` L-mask. | Hook-shaped irregular container. | Birchbark strip with stitched top seam across top row and hooked bend descending from the left cell. |
| `hollow_log` | Bag/container, `3x2` J-mask. | Heavy organic irregular container. | Hollow log body running horizontally with right-side downward hook/branch end; lower-left cells are placement holes. |
| `twisted_stalk` | Bag/container, `3x2` S-mask. | Curving irregular container with strong silhouette. | Twisted stem sweeping right on top and left below, connected diagonally through the middle. |
| `spiral_cap` | Bag/container, `3x2` Z-mask. | Spiral irregular container; should read as a continuous cap shape. | Spiral mushroom cap moving right on upper row and continuing diagonally into a lower right spiral. |
| `mycelium_vine` | Bag/container, `1x4`. | Long vertical container, testing tall footprint readability. | Continuous braided mycelium vine with top tip/glowing node, long middle body, and lower tendril end. |
