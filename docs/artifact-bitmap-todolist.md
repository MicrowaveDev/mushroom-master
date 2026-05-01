# Artifact Bitmap Production Todo List

Goal: every artifact has a real painted bitmap that renders as one Backpack Battles-style ornament across its full grid footprint. The game renders the bitmap once as a continuous overlay above the footprint; shape masks control placement cells underneath.

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
- [ ] `trefoil_sack.png` - `trefoil_sack`, 3x2 T-mask. Three-lobed clover-like top pouch with one hanging lower lobe from the center; side lower cells are placement holes but the painted sack may have soft rounded overhang.
- [ ] `birchbark_hook.png` - `birchbark_hook`, 3x2 L-mask. Birchbark strip with stitched top seam across the top row and a hooked bend descending from the left cell.
- [ ] `hollow_log.png` - `hollow_log`, 3x2 J-mask. Hollow log body running horizontally with a right-side downward hook/branch end; lower-left cells are placement holes, not a rectangular art cut.
- [ ] `twisted_stalk.png` - `twisted_stalk`, 3x2 S-mask. Twisted stem sweeping right on top and left below, with a diagonal connection through the middle.
- [ ] `spiral_cap.png` - `spiral_cap`, 3x2 Z-mask. Spiral mushroom cap moving right on the upper row and continuing diagonally into a lower right spiral.
- [ ] `mycelium_vine.png` - `mycelium_vine`, 1x4. Continuous braided mycelium vine; tip and glowing node above, long body through the middle, lower tendril end.

## Notes

- `docs/artifact-art-direction.md` has the cell-by-cell composition notes.
- `app/scripts/generate-artifact-bitmaps.js` is now only useful for local mask/reference previews. It should not be used for production art unless we intentionally want placeholder assets again.
