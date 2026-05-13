# Artifact Bitmap Production Todo List

Goal: every artifact has a real painted bitmap that renders as one Backpack Battles-style ornament across its full grid footprint. The game renders the bitmap once as a continuous overlay above the footprint; shape masks control placement cells underneath.

Canonical per-artifact purpose, motivation, type, and visual intent live in [artifact-image-reference.md](artifact-image-reference.md). Candidate expansion ideas live in [artifact-expansion-catalog.md](artifact-expansion-catalog.md); promote them into the canonical reference only when they are ready for live data, bitmap generation, and validation. Keep this file focused on production workflow, validation, and script-readable queue scaffolding.

The previous SVG-derived PNG placeholders were removed from `web/public/artifacts/`. Real production PNGs should be generated one batch at a time and saved as:

```text
web/public/artifacts/{artifact_id}.png
```

Raw imagegen exports and intermediate candidates are local-only and belong in:

```text
.agent/artifact-image-workspace/
```

Use `raw/` for full-size imagegen sources, `processed/` for keyed/cropped candidates, and `review/` for generated contact sheets, manifests, and temporary visual checks. Those folders are ignored by git. The app should only consume the optimized PNGs in `web/public/artifacts/`.

Use this command to get the next missing batch:

```bash
npm run game:artifacts:next
```

The script skips files that already exist in `web/public/artifacts/`, so the workflow is:

1. Run `npm run game:artifacts:next`.
2. Generate the listed 10 images with the imagegen skill, using [`artifact-image-style-prompt.md`](artifact-image-style-prompt.md) as the shared style guide.
3. Save raw imagegen outputs under `.agent/artifact-image-workspace/raw/`, then run the chroma-key/conversion helper to write each optimized app PNG into the exact output path.
4. Run `npm run game:artifacts:next` again until it reports that all artifacts are done.
5. Run `node --test tests/web/artifact-render.test.js`.
6. Run `npm run game:artifacts:validate -- artifact_id` for every newly generated PNG.
7. Run `npm run game:artifacts:sheet` to regenerate the deterministic all-artifacts review sheet.
8. Run `npm run game:artifacts:thumbnail-review` to regenerate the small-size readability sheet under `.agent/tasks/artifact-image-system/phase-1/raw/` while images are still candidate evidence.
9. Run `npm run game:test:screens`.

## Global Generation Rules

- Use [`artifact-image-style-prompt.md`](artifact-image-style-prompt.md) as the base style prompt for every artifact.
- Style: simple readable fantasy inventory sticker, not full concept art.
- Match the approved 2026-04-28 direction: `ferment_phial`, `flash_cap`, `kirt_venom_fang`, `settling_guard`, `spore_lash`, and `spore_needle`.
- Prefer chunky silhouettes, thick contour, flat cel-shaded color blocks, and one or two large accents.
- Simplify aggressively: if a detail will not read at 48-64px per cell, remove it.
- Keep a clean bitmap silhouette: no scratch halo, no loose construction lines around the object, no background sketch noise.
- Follow strict footprint direction: horizontal artifacts must be horizontal, vertical artifacts must be vertical, square artifacts must be centered/blocky, irregular bags must read as their intended mask shape.
- Do not make CSS-looking UI symbols, emoji, toy renders, or plain silhouettes.
- Do not make painterly realistic mushroom specimens, gritty bark/soil/leather/stone props, glossy loot icons, or dense tiny texture.
- The image must be one complete artifact across the whole footprint. It should read as one object over the grid cells.
- 1x1 icons must fill the cell, not float in the middle: target 72-88% footprint fill on both axes and at least 28% visible alpha coverage.
- Multi-cell icons must keep at least about 18% visible alpha coverage in every occupied cell.
- Avoid long skinny diagonal props. Even needles, fangs, blades, lashes, and hooks need broad ornament mass: cap/head, guard, glow body, ribbon, plate, or aura.
- Generate on a flat removable chroma-key background, preferably `#ff00ff`, then remove the background locally before saving the final transparent PNG.
- No text, letters, watermarks, grid lines, cell borders, cast shadows, or frames.
- Empty cells in irregular bag footprints are logical placement holes, not a required bitmap stencil. Prefer a continuous organic icon that visually suggests the mask; small overhang across empty cells is acceptable when it prevents broken cutouts.
- Do not repair irregular bag images by mechanically applying a rectangular empty-cell mask after generation. The chroma-key helper preserves visual overhang by default for irregular bags; `--organic-mask` and `--force-cell-mask` are only for intentional diagnostics/placeholders, not production sign-off.
- Keep enough transparent padding that the object does not get clipped when rendered over the footprint. No visible alpha should touch or sit nearly flush with the canvas edge; centered/blocky artifacts should have visually balanced left/right and top/bottom margins.
- If a converted PNG looks shifted or cut, inspect both the app-facing PNG alpha bounds and the raw imagegen source. Rerun the raw-to-bitmap conversion only when the raw contains the full object plus background; if the raw source is already clipped at an edge, reselect/regenerate the raw image or restore an approved archive candidate instead of reprocessing the same broken pixels.
- The chroma-key conversion helper should fail when a raw source touches the canvas edge. Treat that failure as a source problem, not a conversion problem; `--allow-clipped-source` is only for diagnostics.
- Detail/compression must be footprint-aware. Do not apply the same smoothing or quantization pass to 1x1, 2-cell, and 2x2 artifacts; normalize by the artifact's displayed grid cells so large pieces do not look blurrier or more compressed than small pieces.
- For bag artifacts, use the displayed bag shape from `getBagShape(artifact)` as the bitmap footprint. This matters for legacy rectangular bags such as `moss_pouch`, whose game display is 2x1 even though the persisted data is `width: 1`, `height: 2`.
- Use `npm run game:artifacts:normalize-detail -- artifact_id...` after chroma-key conversion when a target needs deterministic detail normalization. It preserves the displayed footprint dimensions and scales simplification by occupied cell count.

## Targeted Regeneration Review - 2026-05-09

See [artifact-regeneration-plan.md](artifact-regeneration-plan.md) for source of truth, implementation sequencing, completion notes, and verification commands.

Regenerated in the 2026-05-09 art pass:

- `lomie_mirror_route_map.png` - clean 1x2 black mirror tablet with only a few broad route lines.
- `golden_spore_mace.png` - solid 2x2 mace head with a few large spore bumps, not dense holes.
- `haste_wisp.png` - compact 1x1 speed leaf/flame emblem.
- `heartwood_splinter_bow.png` - one broad 2x1 heartwood bow, not a tiny decorated branch.
- `morga_afterimage_crown.png` - two readable crown silhouettes connected by one speed band.
- `moss_pouch.png` - footprint pipeline fixed first, then redrawn as a 2x1 displayed pouch/satchel.
- `obsidian_throne_chip.png` - broad 1x2 throne shard with simple mold crown, not gritty texture.

Quality watch:

- `spore_burst_arrow.png` - reprocessed with the deterministic footprint-aware detail normalizer; no redraw was needed in this pass.

Fusion note:

- `portal_cut_sickle.png` - current concept is now intentional: it is the first fusion-only result (`sporeblade` + `mirrorloop_knot`), so future redraws should preserve the fused portal-edge-plus-blade read.
- `riftfang_comet.png`, `biostasis_crown_seed.png`, `abyss_bow_knot.png`, and `opening_bell_spore.png` are also fusion-only results as of the recipe-catalog pass; future redraws should preserve their fused-result read rather than simplifying them into normal shop items.
- `reliquary_ash_crown.png`, `portal_vinegar_lens.png`, `deadwind_arrow.png`, `pressure_bloom_bulwark.png`, `snap_lullaby_bell.png`, and `riftpuff_snare.png` are the second fusion-only wave. Dedicated imagegen-created PNGs were generated in the 2026-05-13 continuation; future redraws should preserve their cross-domain fused-result read rather than simplifying them into normal shop items.
- `golden_thorn_aegis.png`, `soft_ash_hourglass.png`, `ginger_star_compass.png`, and `memory_flash_tendon.png` are the third fusion-only wave. They should read as lore-border artifacts first, not as alternate skins for their ingredient silhouettes.
- `porcelain_rotlight_lantern.png`, `vinegar_gate_chakram.png`, `voidflash_pauldron.png`, and `ramaria_throne_snare.png` are the fourth fusion-only wave. They use previously unused normal-shop ingredients to widen the recipe graph.

## Validation

Run the coverage validator before accepting an artifact image:

```bash
npm run game:artifacts:validate -- artifact_id
```

For a batch:

```bash
npm run game:artifacts:validate -- id_a id_b id_c
```

The validator checks coverage, freshness, and fitting problems that are hard to catch from the raw PNG:

- 1x1 artifacts must have enough visible alpha coverage and width/height fill.
- multi-cell artifacts must have enough visible content in every occupied cell.
- irregular bag masks must keep enough visible content in every occupied cell.
- irregular bag art must not show rectangular cutouts from empty mask cells; by default, the validator treats empty cells as layout holes and allows visual overhang in the PNG.
- PNG dimensions must divide cleanly by the artifact footprint.
- app-facing PNGs must keep safe alpha margins away from every canvas edge.
- centered multi-cell artifacts must not have strongly unbalanced margins that make the object appear shifted inside its footprint.
- by default, app-facing PNGs must be newer than the matching raw source in `.agent/artifact-image-workspace/raw/`.

If it fails with low coverage or low width/height fill, regenerate the asset with a chunkier silhouette and less empty space. If it fails edge padding or margin balance, first inspect the raw source: reprocess with more padding when the raw is complete, or regenerate/reselect the raw when the source object itself is clipped.

## Local Archive

A local safety archive can be kept at:

```text
.agent/artifact-image-archives/
```

That directory is intentionally ignored by git. Use it to preserve an approved generated PNG set before iterating on replacement art. The archive should include:

- `images/` with the exact `web/public/artifacts/*.png` files from the approved pass;
- `contact-sheet.png` for fast visual review;
- `README.md` with the source path, count, validation commands, and SHA-256 checksums.

The 2026-04-28 production pass was archived locally as:

```text
.agent/artifact-image-archives/2026-04-28-production-pngs/
```

To restore that local archive into the app asset folder:

```bash
cp .agent/artifact-image-archives/2026-04-28-production-pngs/images/*.png web/public/artifacts/
npm run game:artifacts:validate -- --all
```

## Review Sheet

Use this deterministic contact sheet for visual review:

```bash
npm run game:artifacts:sheet
```

The script writes:

```text
.agent/artifact-image-workspace/review/contact-sheet.png
```

It groups artifacts by section, sorts artifact IDs alphabetically inside each section, embeds the current PNG files directly, and shows role/shine metadata from `app/shared/artifact-visual-classification.js`. Each artifact preview mirrors the placed-game model: only the artifact footprint cells render behind one uninterrupted bitmap overlay, empty mask cells stay hidden, and the artifact bitmap sits above the cells rather than being divided by them. The preview uses one fixed grid scale for every tile (`50px` cells, `8px` gap) so 1x1, 2x2, 3x2, 1x4, and 3x3 artifacts can be compared directly, while each tile reserves only the compact stage height needed for that artifact's own footprint. `--validate-only` enforces the compact stage dimensions; do not restore a global max-footprint preview stage just to align all card heights. It writes through a temporary PNG and fails if the generated bytes match the existing `contact-sheet.png`; that means the underlying artifact PNGs did not actually change. It also writes `.agent/artifact-image-workspace/review/contact-sheet.manifest.json` with every input PNG hash, the output hash, and changed artifact IDs. Use `--highlight-changed` to mark changed tiles in the rendered sheet, and use `--allow-unchanged` only when an identical deterministic rebuild is intentional. Do not rely on ad hoc `.agent` contact sheets for sign-off.

Use this deterministic thumbnail review sheet for mobile-size readability checks:

```bash
npm run game:artifacts:thumbnail-review
```

Until the image set is explicitly approved for production, the script writes local evidence to:

```text
.agent/tasks/artifact-image-system/phase-1/raw/thumbnail-review.png
```

The sheet renders every artifact at `32px`, `48px`, and `64px` on transparent background, the actual prep/grid cell background, and grayscale. It also shows role, shine, footprint, and warning markers derived from the shared visual classification metadata.

## Production Image Queue

The queue below is kept as workflow scaffolding for `npm run game:artifacts:next`. The durable design reference is [artifact-image-reference.md](artifact-image-reference.md); when changing per-artifact meaning or visual intent, update the reference first and keep the queue aligned.

### Damage

- [ ] `spore_needle.png` - `spore_needle`, 1x1. Small mushroom-headed needle or pin; cap at the top, dark stem descending diagonally, small spore glow near the cap.
- [ ] `sporeblade.png` - `sporeblade`, 1x1. Short curved blade grown from spore-chitin; amber cutting edge, dark handle knot, diagonal readable silhouette.
- [ ] `amber_fang.png` - `amber_fang`, 1x2. One long translucent amber fang spanning both cells; upper root and shine continue into a sharp lower point.
- [ ] `glass_cap.png` - `glass_cap`, 2x1. Fragile glassy mushroom cap spanning both cells; underside gills and stem begin near the seam, highlight continues across the cap.
- [ ] `fang_whip.png` - `fang_whip`, 2x1. Flexible whip with fang tip; handle/root knot on the left, curving whip body crossing the seam into a fang head.
- [ ] `burning_cap.png` - `burning_cap`, 2x2. Hot mushroom cap with flame core; ember cracks, red rim, lower stem/base, and flame glow form one large object.
- [ ] `bubbling_grot_bomb.png` - `bubbling_grot_bomb`, 1x1. Volatile grotto spore bomb; round amber-red fungal flask, corked cap fuse, and contained green ferment bubbles.
- [ ] `sour_vinegar_ampoule.png` - `sour_vinegar_ampoule`, 1x1. Tiny blue-violet vinegar ampoule with amber stopper, sour vapor curl, and chunky one-cell silhouette.
- [ ] `overpressure_retort.png` - `overpressure_retort`, 2x2. Bulging amber retort about to pop; organic glass body, green pressure bubbles, one connected object filling all four cells.
- [ ] `green_star_sight.png` - `green_star_sight`, 1x1. Neon-green targeting sight charm with a violet arrow notch and broad star silhouette.
- [ ] `flashstep_tendon.png` - `flashstep_tendon`, 1x2. Living tendon pulled taut top-to-bottom, bright flash knots at both ends, orange-white motion glow inside the silhouette.
- [ ] `rotlight_lantern.png` - `rotlight_lantern`, 2x1. Horizontal bone lantern with warm gold rotlight inside and chunky side caps, filling both cells.
- [ ] `portal_cut_sickle.png` - `portal_cut_sickle`, 2x1. Fused sporeblade plus mirrorloop-knot result: broad amber void sickle crossing a violet portal edge, one joined blade across both cells.
- [ ] `ferment_sea_pearl.png` - `ferment_sea_pearl`, 2x2. Heavy amber pearl with green pressure bubbles and sour cracks, one round blocky body filling all quadrants.
- [ ] `spore_burst_arrow.png` - `spore_burst_arrow`, 2x1. Chunky arrow pod with violet shaft and green puffball warhead, connected left-to-right.
- [ ] `rustbone_key.png` - `rustbone_key`, 1x2. Tall black-bone key corroding into ash at the teeth, broad bow at top and heavy key bit below.
- [ ] `snaplight_husk.png` - `snaplight_husk`, 2x1. Split seed husk mid-snap with a bright contained flash line between two chunky halves.
- [ ] `amber_needle_swarm.png` - `amber_needle_swarm`, 2x2. Cluster of thick amber stingers orbiting one resin node, dense connected block rather than loose particles.
- [ ] `crownthorn_cleaver.png` - `crownthorn_cleaver`, 1x2. Vertical black-branch cleaver with green resin teeth, broad head and rooted handle.
- [ ] `heartwood_splinter_bow.png` - `heartwood_splinter_bow`, 2x1. Horizontal black heartwood bow with green resin string and one amber arrowbud, chunky across both cells.
- [ ] `blue_vinegar_chakram.png` - `blue_vinegar_chakram`, 2x1. Wide blue-violet vinegar chakram with amber stopper nodes and contained green fizz, broad ring silhouette.
- [ ] `first_bloom_cinder.png` - `first_bloom_cinder`, 1x1. Compact orange flower-coal with cap-like petals and one white flash slash, filling one cell.
- [ ] `dead_city_nail.png` - `dead_city_nail`, 1x2. Tall black-bone nail with ash cap at top and corroded tooth point below, thick vertical silhouette.
- [ ] `golden_spore_mace.png` - `golden_spore_mace`, 2x2. Heavy golden spore mace head with white mycelium haft and pale cyan biostasis marks, one blocky object.
- [ ] `riftfang_comet.png` - `riftfang_comet`, 2x1. Fused amber fang plus haste-wisp result: broad violet-amber fang comet with a thick green rift tail across both cells.
- [ ] `portal_vinegar_lens.png` - `portal_vinegar_lens`, 2x1. Fused sour-vinegar plus mirrorfloor result: wide blue-violet lens ring with amber acid core, black mirror rim, and contained green fizz.
- [ ] `deadwind_arrow.png` - `deadwind_arrow`, 2x2. Fused spore-burst arrow plus dead-city nail result: heavy cross-shaped arrow-nail relic with violet shaft, green puffball charge, black-bone nail spine, and ash cap.

### Armor

- [ ] `bark_plate.png` - `bark_plate`, 1x1. Square-ish bark armor plate; rounded bark slab, vertical grain, moss edge.
- [ ] `loam_scale.png` - `loam_scale`, 1x1. Single earthen scale; curved loam plate, heavy lower mass, small grit marks.
- [ ] `mycelium_wrap.png` - `mycelium_wrap`, 2x1. Braided mycelium band; loose root fibers on the left, knot or bead on the right, braid continues across the seam.
- [ ] `stone_cap.png` - `stone_cap`, 1x2. Heavy stone mushroom cap and stem; cracked cap in the upper cell, thick stone stem/base below.
- [ ] `root_shell.png` - `root_shell`, 2x2. Root-wrapped shield shell; upper shell plates, lower root tendrils, one continuous protective body.
- [ ] `truffle_bulwark.png` - `truffle_bulwark`, 2x2. Dense truffle shield; rough pore dome, raised lobe, moss and loam chips, grounded mass.
- [ ] `void_cocoon_spore.png` - `void_cocoon_spore`, 1x2. Tall armored void-cocoon spore; moss-green outer plates wrap a pale frozen core and dark central void slit.
- [ ] `hyphae_corset_lace.png` - `hyphae_corset_lace`, 2x1. Braided gold-white corset lace spanning both cells, protective knot on one side, invasive fibers on the other.
- [ ] `sound_eater_velvet.png` - `sound_eater_velvet`, 2x1. Folded white mold-velvet pad absorbing a black sound ripple across the whole horizontal footprint.
- [ ] `bone_cocoon_greaves.png` - `bone_cocoon_greaves`, 1x2. Tall bone-white leg armor wrapped in golden mycelium, strong upper plate and grounded lower greave.
- [ ] `mirrorfloor_shard.png` - `mirrorfloor_shard`, 1x1. Black mirror-glass shard reflecting cold portal light, wide enough to avoid a thin sliver.
- [ ] `star_spore_sash.png` - `star_spore_sash`, 2x1. Flowing indigo sash with white spore constellations, one connected ribbon across both cells.
- [ ] `trophy_helm_plate.png` - `trophy_helm_plate`, 1x1. Bitten metal plate patched with green resin, square enough to read as armor.
- [ ] `gingerroot_filter.png` - `gingerroot_filter`, 1x2. Tall root-filter cartridge with amber fluid draining through it, rooted top and heavy lower chamber.
- [ ] `voidglass_pauldron.png` - `voidglass_pauldron`, 1x2. Tall green-violet glass shoulder plate with a black slit, broad enough for one-cell width.
- [ ] `golden_garden_carapace.png` - `golden_garden_carapace`, 2x2. Broad shell grown from gold oyster caps and white mycelium, one heavy object filling all quadrants.
- [ ] `amber_resin_shield.png` - `amber_resin_shield`, 2x1. Wide amber shield with trapped bubbles and bark rim, strong horizontal face.
- [ ] `porcelain_mold_mask.png` - `porcelain_mold_mask`, 1x1. White porcelain face shard with black eye hollow and green mold sparks, chunky mask silhouette.
- [ ] `living_bark_latch.png` - `living_bark_latch`, 1x1. Small bark clasp that looks like it is breathing, moss hinge and cream highlight.
- [ ] `reliquary_bone_buckle.png` - `reliquary_bone_buckle`, 1x1. Compact gold-bone buckle with a sacred knot and moss-green clasp, square readable silhouette.
- [ ] `soft_wall_tile.png` - `soft_wall_tile`, 2x1. Wide translucent pale-green wall tile with crystal rim and one soft bend line across both cells.
- [ ] `ferment_glass_bracer.png` - `ferment_glass_bracer`, 1x2. Tall amber glass bracer with green ferment bubbles, heavy cuff at top and lower pressure chamber.
- [ ] `thornhide_scale.png` - `thornhide_scale`, 1x1. Square black-bark scale with one green resin thorn and cream highlight, compact and protective.
- [ ] `flashcap_knee_guard.png` - `flashcap_knee_guard`, 1x2. Vertical orange flashcap knee guard with moss strap and white speed stripe, connected top-to-bottom.
- [ ] `obsidian_throne_chip.png` - `obsidian_throne_chip`, 1x2. Tall black obsidian throne shard with white mold crown and gray ash edge, broad vertical mass.
- [ ] `pressure_bloom_bulwark.png` - `pressure_bloom_bulwark`, 2x2. Fused grotto bomb plus amber-resin shield result: large amber shield-flower swollen with green pressure bubbles, bark-rimmed petals, and a heavy lower guard.

### Stun

- [ ] `shock_puff.png` - `shock_puff`, 1x1. Round puffball cloud with an electric crack through the center.
- [ ] `glimmer_cap.png` - `glimmer_cap`, 1x1. Small luminous mushroom cap with star-like glint and subtle stem.
- [ ] `dust_veil.png` - `dust_veil`, 1x2. Falling veil of spore dust; source cap/cloud above, drifting dust tail fading downward.
- [ ] `static_spore_sac.png` - `static_spore_sac`, 1x2. Hanging charged spore sac; upper neck and static nodes continue into swollen lower membrane.
- [ ] `thunder_gill.png` - `thunder_gill`, 2x1. Exposed mushroom gill with lightning veins; fan ribs continue from left cell into right cell.
- [ ] `spark_spore.png` - `spark_spore`, 2x2. Charged spore orb; pale glow, electric cracks, trailing sparks around one large orb.
- [ ] `reliquary_biostasis_seal.png` - `reliquary_biostasis_seal`, 1x1. Golden reliquary seal; mushroom-cap stamp with a sacred white biostasis knot and contained pale cyan glints.
- [ ] `root_ash_censer.png` - `root_ash_censer`, 2x1. Horizontal root-ash censer; dark root handles, ash-cream ritual bowl, and carved pale spiral marks.
- [ ] `triple_knot_seed.png` - `triple_knot_seed`, 2x1. Three lattice bulbs joined on one black twig, violet void visible through the cells, white spores kept inside the silhouette.
- [ ] `rainpuff_mine.png` - `rainpuff_mine`, 2x1. Low puffball mine with green fuse, violet spore pressure line, broad horizontal body.
- [ ] `afterimage_cap.png` - `afterimage_cap`, 2x1. Cap smeared into two flash silhouettes across the footprint, left origin and right afterimage connected by light.
- [ ] `ash_library_urn.png` - `ash_library_urn`, 2x2. Square ceremonial urn of gray artifact dust, black lid, pale mold seal, one heavy object filling all quadrants.
- [ ] `body_memory_splinter.png` - `body_memory_splinter`, 1x1. Warm flesh-gold shard wrapped in white nerve mycelium, compact but not needle-thin.
- [ ] `ramaria_snare.png` - `ramaria_snare`, 1x2. Tall branching coral-fungus snare with neon green tips and connected lower root.
- [ ] `ashen_heart_smoke.png` - `ashen_heart_smoke`, 1x2. Vertical plume from a tiny bone censer, gray-white smoke with a dense readable silhouette.
- [ ] `silent_bell_mold.png` - `silent_bell_mold`, 2x2. Bell-shaped mold mass, black clapper swallowed by white fuzz, one blocky object filling all quadrants.
- [ ] `crystal_rift_chime.png` - `crystal_rift_chime`, 1x2. Tall crystal chime with split violet-green light and thick dark rim.
- [ ] `biostasis_crown_seed.png` - `biostasis_crown_seed`, 2x2. Fused reliquary seal plus triple-knot result: heavy crown seed pod with three knot bulbs, sacred gold base, and pale cyan biostasis glints.
- [ ] `spore_snow_globe.png` - `spore_snow_globe`, 1x1. Tiny globe of gray-white spore snow over black roots, round clear silhouette.
- [ ] `forgotten_crossroads_ring.png` - `forgotten_crossroads_ring`, 2x1. Ring split between violet void and gold mycelium teeth, stretched as one horizontal emblem.
- [ ] `spore_lullaby_conch.png` - `spore_lullaby_conch`, 2x1. Horizontal pale-gold fungal conch with white spore curls kept inside the outline and dark lip.
- [ ] `mirrorloop_knot.png` - `mirrorloop_knot`, 1x1. Compact black-violet loop knot with green mirror highlight and one pale spore bead.
- [ ] `ginger_spark_bottle.png` - `ginger_spark_bottle`, 1x2. Tall ginger-shaped amber bottle with yellow spark cork and green fizz core, chunky vertical form.
- [ ] `abyss_bow_knot.png` - `abyss_bow_knot`, 2x2. Fused heartwood bow plus mirrorloop-knot result: heavy black-violet bow knot with a green resin eye and amber string arcs, filling all quadrants.
- [ ] `opening_bell_spore.png` - `opening_bell_spore`, 2x2. Fused afterimage cap plus first-bloom cinder result: bell-shaped orange spore with a white flash clapper, broad base, and contained yellow glow.
- [ ] `entropy_scepter_tip.png` - `entropy_scepter_tip`, 1x2. Tall ash-gray scepter tip with porcelain crown and black shard core, thick enough for one-cell width.
- [ ] `reliquary_ash_crown.png` - `reliquary_ash_crown`, 2x2. Fused root-ash censer plus reliquary buckle result: heavy gold-and-ash crown seed with white mold rim, black root bowl, and pale cyan stillness marks.
- [ ] `snap_lullaby_bell.png` - `snap_lullaby_bell`, 2x1. Fused spore-lullaby conch plus snaplight husk result: horizontal pale-gold bell-conch cracked by orange snap flash, broad lip on the left and speed slash on the right.
- [ ] `riftpuff_snare.png` - `riftpuff_snare`, 2x2. Fused crystal-rift chime plus rainpuff mine result: square rift trap with violet-green portal frame, central puffball mine, black route loop, and neon snare teeth.
- [ ] `golden_thorn_aegis.png` - `golden_thorn_aegis`, 2x2. Heavy golden oyster shield with black-bark thorn rim, green resin teeth, and white mycelium seams, one compact block-filling aegis.
- [ ] `soft_ash_hourglass.png` - `soft_ash_hourglass`, 2x1. Wide translucent pale-green hourglass tile with gray spore snow suspended inside and black root grains gathering at both ends.
- [ ] `ginger_star_compass.png` - `ginger_star_compass`, 2x2. Amber ginger compass wrapped in an indigo star-spore sash, green fizz needle and white constellation dots, filling all quadrants.
- [ ] `memory_flash_tendon.png` - `memory_flash_tendon`, 1x2. Tall flesh-gold tendon with orange-white flash knots and a warm memory shard embedded in the center, vertical and chunky.
- [ ] `porcelain_rotlight_lantern.png` - `porcelain_rotlight_lantern`, 2x2. Square porcelain mask-lantern with warm rotlight core, black eye vents, white mold rim, and amber glow plates filling all quadrants.
- [ ] `vinegar_gate_chakram.png` - `vinegar_gate_chakram`, 2x2. Broad blue-violet acid chakram with rustbone key teeth across the center, amber stopper nodes, green fizz slashes, and a heavy circular silhouette.
- [ ] `voidflash_pauldron.png` - `voidflash_pauldron`, 2x2. Bulky green-violet glass pauldron with orange flashcap fins, black void slit, white speed stripe, and one connected shoulder-armor mass.
- [ ] `ramaria_throne_snare.png` - `ramaria_throne_snare`, 2x2. Black obsidian throne shard tangled in coral ramaria branches, neon green tips, white mold crown, and a square trap silhouette.

### Hybrid / Utility

- [ ] `moss_ring.png` - `moss_ring`, 1x1. Mossy ring charm; circular moss texture around the edge with a pale center.
- [ ] `haste_wisp.png` - `haste_wisp`, 1x1. Fast leaf-like flame; angled wisp, motion streak, bright tip.

### Character Shop Artifacts

- [ ] `thalla_sacred_thread.png` - `thalla_sacred_thread`, 1x2. Thalla sacred spore thread; glowing knot/charm above, long trailing thread and spore beads below.
- [ ] `lomie_crystal_lattice.png` - `lomie_crystal_lattice`, 2x1. Lomie protective crystal lattice; left crystal frame and right crossing lattice complete one pattern.
- [ ] `axilin_ferment_core.png` - `axilin_ferment_core`, 1x2. Axilin bubbling ferment core; organic glass top, denser glowing liquid below, bubbles rising through both cells.
- [ ] `kirt_venom_fang.png` - `kirt_venom_fang`, 1x1. Kirt compact venom fang charm; curved fang with a small venom dot.
- [ ] `morga_flash_seed.png` - `morga_flash_seed`, 2x1. Morga bright flash seed; seed body on the left, light trail and crackle extending right.
- [ ] `dalamar_ashen_shard.png` - `dalamar_ashen_shard`, 1x2. Dalamar dark ash shard; broken crown above, tapering shard point and falling gray dust below.
- [ ] `thalla_golden_veil_pin.png` - `thalla_golden_veil_pin`, 1x1. Sacred gold pin with a small trailing veil and contained pale cyan biostasis glint.
- [ ] `lomie_portal_dust_vial.png` - `lomie_portal_dust_vial`, 1x1. Tiny vial of violet-green portal dust, white star-spores escaping through a cork, broad glass body.
- [ ] `axilin_ginger_bite_root.png` - `axilin_ginger_bite_root`, 1x1. Angry mandrake-like ginger root charm with one bitten side and amber bubbles.
- [ ] `kirt_mantrap_claws.png` - `kirt_mantrap_claws`, 2x1. Paired carnivorous clamp-claws snapping shut, violet hinge, neon-green toothed inner lips, one horizontal object.
- [ ] `morga_first_bloom_spur.png` - `morga_first_bloom_spur`, 1x1. Sharp bloom-spur bursting forward with a short flash trail, chunky flower-thorn silhouette.
- [ ] `dalamar_pallid_moth_pin.png` - `dalamar_pallid_moth_pin`, 1x1. Porcelain-white moth with black wing veins and green mold sparks, pinned by silence rather than a needle.
- [ ] `thalla_first_host_locket.png` - `thalla_first_host_locket`, 1x1. Warm gold locket with white nerve-mycelium clasp and a pale cyan stillness glint, one chunky cell.
- [ ] `thalla_gold_oyster_crown.png` - `thalla_gold_oyster_crown`, 2x2. Golden oyster crown grown from layered caps and white mycelium, broad sacred block filling all quadrants.
- [ ] `lomie_mirror_route_map.png` - `lomie_mirror_route_map`, 1x2. Tall black mirror map with green route lines and a crystal frame, broad enough for one-cell width.
- [ ] `lomie_void_lattice_gate.png` - `lomie_void_lattice_gate`, 2x2. Square green-violet lattice gate holding a black void center, one connected block with four corner knots.
- [ ] `axilin_blue_vinegar_flask.png` - `axilin_blue_vinegar_flask`, 1x2. Tall blue-violet vinegar flask with amber stopper, green fizz core, and chunky glass belly.
- [ ] `axilin_ginger_overdrive.png` - `axilin_ginger_overdrive`, 2x2. Large ginger-red overdrive core with amber glass chambers and green pressure bubbles, dense block form.
- [ ] `kirt_rainpuff_quiver.png` - `kirt_rainpuff_quiver`, 2x1. Horizontal black-branch quiver packed with green puffballs and amber thorn binding, one wide object.
- [ ] `kirt_black_wind_bowchip.png` - `kirt_black_wind_bowchip`, 2x2. Heavy black-violet bow knot chip with neon green eye and amber string arcs, dense in all quadrants.
- [ ] `morga_afterimage_crown.png` - `morga_afterimage_crown`, 2x1. Orange flash crown split into left origin and right afterimage, connected by a white speed band.
- [ ] `morga_bellstrike_calyx.png` - `morga_bellstrike_calyx`, 2x2. Large orange bell-flower calyx with white flash clapper and red damage petals, filling all quadrants.
- [ ] `dalamar_throne_splinter.png` - `dalamar_throne_splinter`, 1x2. Tall black obsidian splinter with white mold crown and ash-gray side plates, heavy vertical silhouette.
- [ ] `dalamar_dead_gate_seal.png` - `dalamar_dead_gate_seal`, 2x2. Square bone-gray gate seal crumbling into ash, black keyhole center, white mold rim, one heavy block.

### Signature Starters

- [ ] `spore_lash.png` - `spore_lash`, 1x1. Coiled lash with star/spore tip.
- [ ] `settling_guard.png` - `settling_guard`, 1x1. Small shield cap resting on a flat base line.
- [ ] `ferment_phial.png` - `ferment_phial`, 1x1. Flask with bubbling fluid.
- [ ] `measured_strike.png` - `measured_strike`, 1x1. Precise spear/marker with a horizontal balance line.
- [ ] `flash_cap.png` - `flash_cap`, 1x1. Small cap with speed sparks around it.
- [ ] `entropy_shard.png` - `entropy_shard`, 1x1. Angular dark shard with crossed fracture lines.

### Bags

- [ ] `starter_bag.png` - `starter_bag`, 3x3. Soft canvas starter bag; stitched upper flap, centered clasp, folds and base seam across all nine cells.
- [ ] `moss_pouch.png` - `moss_pouch`, displayed 2x1. Horizontal mossy drawstring pouch/satchel; mouth, tie, and rounded belly continue left-to-right across both cells.
- [ ] `amber_satchel.png` - `amber_satchel`, 2x2. Amber leather satchel; handle and top flap span the upper cells, amber clasp centered across the lower body.
- [ ] `trefoil_sack.png` - `trefoil_sack`, 3x2 T-mask. Three-lobed clover-like top pouch with one hanging lower lobe from the center; side lower cells are placement holes but the painted sack may have soft rounded overhang.
- [ ] `birchbark_hook.png` - `birchbark_hook`, 3x2 L-mask. Birchbark strip with stitched top seam across the top row and a hooked bend descending from the left cell.
- [ ] `hollow_log.png` - `hollow_log`, 3x2 J-mask. Hollow log body running horizontally with a right-side downward hook/branch end; lower-left cells are placement holes, not a rectangular art cut.
- [ ] `twisted_stalk.png` - `twisted_stalk`, 3x2 S-mask. Twisted stem sweeping right on top and left below, with a diagonal connection through the middle.
- [ ] `spiral_cap.png` - `spiral_cap`, 3x2 Z-mask. Spiral mushroom cap moving right on the upper row and continuing diagonally into a lower right spiral.
- [ ] `mycelium_vine.png` - `mycelium_vine`, 1x4. Continuous braided mycelium vine; tip and glowing node above, long body through the middle, lower tendril end.

## Notes

- `docs/artifact-art-direction.md` has the cell-by-cell composition notes.
- `app/scripts/generate-artifact-bitmaps.js` is now only useful for local mask/reference previews. It should not be used for production art unless we intentionally want placeholder assets again.
