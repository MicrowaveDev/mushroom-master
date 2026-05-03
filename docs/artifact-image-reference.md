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

## Armor

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `bark_plate` | Armor, `1x1`, plain. | Basic defensive pickup; must be clearly protective at tiny size. | Square-ish rounded bark armor slab with vertical grain and moss edge. |
| `loam_scale` | Armor, `1x1`, plain. | Small earthy defense piece, more organic than `bark_plate`. | Single curved loam plate with heavy lower mass and minimal grit marks. |
| `mycelium_wrap` | Armor, `2x1`, bright. | Wide defensive band; should read as binding/protection across cells. | Braided mycelium band with loose fibers on the left and knot or bead on the right. |
| `stone_cap` | Armor, `1x2`, bright. | Tall heavy defense piece with grounded mass. | Cracked stone mushroom cap in upper cell, thick stone stem/base below. |
| `root_shell` | Armor, `2x2`, bright. | Large protective body that anchors defensive builds. | Root-wrapped shield shell; upper shell plates and lower root tendrils form one continuous protective mass. |
| `truffle_bulwark` | Armor, `2x2`, bright/radiant defensive commitment. | The densest shield fantasy, with visible bulk and tradeoff weight. | Dense truffle shield; rough pore dome, raised lobe, moss and loam chips, grounded mass. |

## Stun

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `shock_puff` | Stun, `1x1`, plain. | Basic disruption charm; should read as a puff and an electric crack. | Round puffball cloud with a contained electric crack through the center. |
| `glimmer_cap` | Stun, `1x1`, plain. | Small luminous control item. | Luminous mushroom cap with star-like glint and subtle stem. |
| `dust_veil` | Stun, `1x2`, bright. | Vertical soft-control piece; should feel drifting but not wispy/noisy. | Source cap/cloud above, falling veil of spore dust fading downward. |
| `static_spore_sac` | Stun, `1x2`, bright. | Charged hanging control item. | Upper neck and static nodes continue into swollen lower membrane. |
| `thunder_gill` | Stun, `2x1`, bright. | Wide control piece with a readable fan shape. | Exposed mushroom gill with lightning veins; fan ribs continue left-to-right. |
| `spark_spore` | Stun, `2x2`, bright. | Large control commitment; should feel charged but contained. | One large charged spore orb with pale glow, electric cracks, and a few contained sparks. |

## Hybrid / Utility

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `moss_ring` | Utility, `1x1`, plain. | Compact flexible charm; should look like a neutral support pickup. | Mossy ring charm with circular moss edge and pale center. |
| `haste_wisp` | Utility/speed, `1x1`, plain. | Speed-forward item that must avoid reading as pure damage. | Fast leaf-like flame with angled wisp, motion streak, and bright tip. |

## Character Shop Artifacts

| ID | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- |
| `thalla_sacred_thread` | Thalla signature, `1x2`. | Character-specific sacred thread motif; connects to Thalla's spore-thread/lash identity. | Glowing knot/charm above, long trailing thread and spore beads below. |
| `lomie_crystal_lattice` | Lomie signature, `2x1`. | Character-specific protection motif; should feel defensive and structured. | Left crystal frame and right crossing lattice complete one protective pattern. |
| `axilin_ferment_core` | Axilin signature, `1x2`. | Character-specific fermentation/alchemy motif. | Organic glass top, denser glowing liquid below, bubbles rising through both cells. |
| `kirt_venom_fang` | Kirt signature, `1x1`. | Compact strike charm tied to Kirt's measured precision. | Curved fang with a small venom dot, broad enough to avoid a skinny icon. |
| `morga_flash_seed` | Morga signature, `2x1`. | Character-specific speed/burst motif. | Seed body on the left, light trail and crackle extending right. |
| `dalamar_ashen_shard` | Dalamar signature, `1x2`. | Character-specific decay/entropy motif. | Broken crown above, tapering shard point and falling gray dust below. |

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
| `moss_pouch` | Bag/container, `1x2`. | Small vertical pouch; simple early container shape. | Mossy drawstring pouch with fabric rim above and rounded pouch belly/fibers below. |
| `amber_satchel` | Bag/container, `2x2`. | Medium container with warmer material language. | Amber leather satchel; handle/top flap span upper cells, amber clasp centered across lower body. |
| `trefoil_sack` | Bag/container, `3x2` T-mask. | Irregular bag that teaches non-rectangular container placement. | Three-lobed clover-like top pouch with one hanging lower lobe from the center; side lower cells are logical placement holes. |
| `birchbark_hook` | Bag/container, `3x2` L-mask. | Hook-shaped irregular container. | Birchbark strip with stitched top seam across top row and hooked bend descending from the left cell. |
| `hollow_log` | Bag/container, `3x2` J-mask. | Heavy organic irregular container. | Hollow log body running horizontally with right-side downward hook/branch end; lower-left cells are placement holes. |
| `twisted_stalk` | Bag/container, `3x2` S-mask. | Curving irregular container with strong silhouette. | Twisted stem sweeping right on top and left below, connected diagonally through the middle. |
| `spiral_cap` | Bag/container, `3x2` Z-mask. | Spiral irregular container; should read as a continuous cap shape. | Spiral mushroom cap moving right on upper row and continuing diagonally into a lower right spiral. |
| `mycelium_vine` | Bag/container, `1x4`. | Long vertical container, testing tall footprint readability. | Continuous braided mycelium vine with top tip/glowing node, long middle body, and lower tendril end. |
