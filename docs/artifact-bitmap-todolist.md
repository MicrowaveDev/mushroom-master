# Artifact Bitmap Production Todo List

Goal: every artifact has a real painted bitmap that renders as one Backpack Battles-style ornament across its full grid footprint. Each occupied grid cell displays a sliced part of one complete image.

The previous SVG-derived PNG placeholders were removed from `web/public/artifacts/`. Real production PNGs should be generated one batch at a time and saved as:

```text
web/public/artifacts/{artifact_id}.png
```

Use this command to get the next missing batch:

```bash
npm run game:artifacts:next
```

The script skips files that already exist in `web/public/artifacts/`, so the workflow is:

1. Run `npm run game:artifacts:next`.
2. Generate the listed 10 images with the imagegen skill, using [`artifact-image-style-prompt.md`](artifact-image-style-prompt.md) as the shared style guide.
3. Copy each approved PNG into the exact output path.
4. Run `npm run game:artifacts:next` again until it reports that all artifacts are done.
5. Run `node --test tests/web/artifact-render.test.js`.
6. Run `npm run game:test:screens`.

## Global Generation Rules

- Use [`artifact-image-style-prompt.md`](artifact-image-style-prompt.md) as the base style prompt for every artifact.
- Style: simple readable fantasy inventory icon, not full concept art.
- Keep a clean bitmap silhouette: no scratch halo, no loose construction lines around the object, no background sketch noise.
- Follow strict footprint direction: horizontal artifacts must be horizontal, vertical artifacts must be vertical, square artifacts must be centered/blocky, irregular bags must follow the mask.
- Do not make flat vector icons, CSS-looking UI symbols, emoji, stickers, toy renders, or plain silhouettes.
- The image must be one complete artifact across the whole footprint. It should still read as one object after cell seams cut through it.
- Generate on a flat removable chroma-key background, preferably `#00ff00`, then remove the background locally before saving the final transparent PNG.
- No text, letters, watermarks, grid lines, cell borders, cast shadows, or frames.
- Empty cells in irregular bag footprints must be transparent in the final PNG.
- Keep enough padding that the object does not get clipped when sliced in the UI.

## Production Image Queue

### Damage

- [ ] `spore_needle.png` - `spore_needle`, 1x1. Small mushroom-headed needle or pin; cap at the top, dark stem descending diagonally, small spore glow near the cap.
- [ ] `sporeblade.png` - `sporeblade`, 1x1. Short curved blade grown from spore-chitin; amber cutting edge, dark handle knot, diagonal readable silhouette.
- [ ] `amber_fang.png` - `amber_fang`, 1x2. One long translucent amber fang spanning both cells; upper root and shine continue into a sharp lower point.
- [ ] `glass_cap.png` - `glass_cap`, 2x1. Fragile glassy mushroom cap spanning both cells; underside gills and stem begin near the seam, highlight continues across the cap.
- [ ] `fang_whip.png` - `fang_whip`, 2x1. Flexible whip with fang tip; handle/root knot on the left, curving whip body crossing the seam into a fang head.
- [ ] `burning_cap.png` - `burning_cap`, 2x2. Hot mushroom cap with flame core; ember cracks, red rim, lower stem/base, and flame glow form one large object.

### Armor

- [ ] `bark_plate.png` - `bark_plate`, 1x1. Square-ish bark armor plate; rounded bark slab, vertical grain, moss edge.
- [ ] `loam_scale.png` - `loam_scale`, 1x1. Single earthen scale; curved loam plate, heavy lower mass, small grit marks.
- [ ] `mycelium_wrap.png` - `mycelium_wrap`, 2x1. Braided mycelium band; loose root fibers on the left, knot or bead on the right, braid continues across the seam.
- [ ] `stone_cap.png` - `stone_cap`, 1x2. Heavy stone mushroom cap and stem; cracked cap in the upper cell, thick stone stem/base below.
- [ ] `root_shell.png` - `root_shell`, 2x2. Root-wrapped shield shell; upper shell plates, lower root tendrils, one continuous protective body.
- [ ] `truffle_bulwark.png` - `truffle_bulwark`, 2x2. Dense truffle shield; rough pore dome, raised lobe, moss and loam chips, grounded mass.

### Stun

- [ ] `shock_puff.png` - `shock_puff`, 1x1. Round puffball cloud with an electric crack through the center.
- [ ] `glimmer_cap.png` - `glimmer_cap`, 1x1. Small luminous mushroom cap with star-like glint and subtle stem.
- [ ] `dust_veil.png` - `dust_veil`, 1x2. Falling veil of spore dust; source cap/cloud above, drifting dust tail fading downward.
- [ ] `static_spore_sac.png` - `static_spore_sac`, 1x2. Hanging charged spore sac; upper neck and static nodes continue into swollen lower membrane.
- [ ] `thunder_gill.png` - `thunder_gill`, 2x1. Exposed mushroom gill with lightning veins; fan ribs continue from left cell into right cell.
- [ ] `spark_spore.png` - `spark_spore`, 2x2. Charged spore orb; pale glow, electric cracks, trailing sparks around one large orb.

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

### Signature Starters

- [ ] `spore_lash.png` - `spore_lash`, 1x1. Coiled lash with star/spore tip.
- [ ] `settling_guard.png` - `settling_guard`, 1x1. Small shield cap resting on a flat base line.
- [ ] `ferment_phial.png` - `ferment_phial`, 1x1. Flask with bubbling fluid.
- [ ] `measured_strike.png` - `measured_strike`, 1x1. Precise spear/marker with a horizontal balance line.
- [ ] `flash_cap.png` - `flash_cap`, 1x1. Small cap with speed sparks around it.
- [ ] `entropy_shard.png` - `entropy_shard`, 1x1. Angular dark shard with crossed fracture lines.

### Bags

- [ ] `starter_bag.png` - `starter_bag`, 3x3. Soft canvas starter bag; stitched upper flap, centered clasp, folds and base seam across all nine cells.
- [ ] `moss_pouch.png` - `moss_pouch`, 1x2. Mossy drawstring pouch; fabric rim above, rounded pouch belly and fibers below.
- [ ] `amber_satchel.png` - `amber_satchel`, 2x2. Amber leather satchel; handle and top flap span the upper cells, amber clasp centered across the lower body.
- [ ] `trefoil_sack.png` - `trefoil_sack`, 3x2 T-mask. Three-lobed clover-like top pouch with one hanging lower lobe from the center; side lower cells transparent.
- [ ] `birchbark_hook.png` - `birchbark_hook`, 3x2 L-mask. Birchbark strip with stitched top seam across the top row and a hooked bend descending from the left cell.
- [ ] `hollow_log.png` - `hollow_log`, 3x2 J-mask. Hollow log body running horizontally with a right-side downward hook/branch end; lower-left cells transparent.
- [ ] `twisted_stalk.png` - `twisted_stalk`, 3x2 S-mask. Twisted stem sweeping right on top and left below, with a diagonal connection through the middle.
- [ ] `spiral_cap.png` - `spiral_cap`, 3x2 Z-mask. Spiral mushroom cap moving right on the upper row and continuing diagonally into a lower right spiral.
- [ ] `mycelium_vine.png` - `mycelium_vine`, 1x4. Continuous braided mycelium vine; tip and glowing node above, long body through the middle, lower tendril end.

## Notes

- `docs/artifact-art-direction.md` has the cell-by-cell composition notes.
- `app/scripts/generate-artifact-bitmaps.js` is now only useful for local mask/reference previews. It should not be used for production art unless we intentionally want placeholder assets again.
