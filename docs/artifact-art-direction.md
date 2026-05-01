# Artifact Art Direction

This document describes how artifact art should look when rendered as Backpack Battles-style puzzle pieces.

The important rule: **an artifact is one complete ornament/image across its whole footprint**. The game renders that bitmap once as a continuous overlay above the footprint; shape masks control which cells are usable underneath. Do not draw the same icon independently inside every occupied cell.

## Global Rules

- Render source art at `80px × 80px` per occupied grid cell.
  - `1×1` source: `80×80`
  - `2×1` source: `160×80`
  - `1×2` source: `80×160`
  - `2×2` source: `160×160`
  - `3×2` source: `240×160`
  - `1×4` source: `80×320`
  - `3×3` source: `240×240`
- The whole artifact should read as one object from a distance.
- Cell borders sit behind the object like puzzle slots; the artwork itself remains continuous above them.
- Keep the item centered inside its full footprint with only small outer breathing room.
- Avoid thin diagonal props floating in empty space. If an artifact is a needle, fang, blade, lash, or hook, make it a chunky ornament with a broad cap/head, guard, plate, ribbon, glow body, or aura so it fills the cell.
- For `1×1` source art, target 72-88% fill on both axes and at least 28% visible alpha coverage.
- For multi-cell source art, every occupied cell needs enough visible object mass to read as intentional.
- Irregular bag masks are placement rules, not clipping stencils. Let the icon stay organic and continuous; do not leave accidental blank occupied cells.
- Avoid tiny detail that disappears at Telegram mobile scale.
- Use the same object orientation for every rotation; rotation is handled by the game.

## Family Language

| Family | Palette | Shape Language | Materials |
|---|---|---|---|
| Damage | amber, orange, burnt sienna, dark brown | blades, fangs, hot caps, sharp diagonals | amber, chitin, lacquered mushroom shell |
| Armor | moss green, bark green, muted stone, cream | shields, plates, rings, shells, rounded mass | bark, stone, root, moss, loam |
| Stun | yellow-green, pale gold, electric olive, smoky cream | spores, lightning, glimmer caps, sacs, shards | glowing spores, dust, gills, static sacs |
| Bags | unique bag color plus warm canvas | containers, hooks, logs, vines, stitched ornaments | moss cloth, amber leather, bark, mycelium fiber |

## Cell Notation

For multi-cell pieces, cells are named by row and column:

```text
A B C
D E F
G H I
```

For a `2×1`, use `A B`. For a `1×2`, use `A / B`.

## Damage Artifacts

### Spore Needle (`spore_needle`) - 1×1

One-cell object: a small mushroom-headed needle or pin.

- Cell A: full needle, cap at top, dark stem descending diagonally, small spore glow near the cap.

### Sporeblade (`sporeblade`) - 1×1

One-cell object: short curved blade grown from spore-chitin.

- Cell A: blade diagonal from bottom-left to top-right, amber cutting edge, dark handle knot.

### Amber Fang (`amber_fang`) - 1×2

Tall object: one long translucent fang spanning both cells.

```text
A
B
```

- A: fang root and upper amber shine; object begins near top center.
- B: sharp tapered fang point; lower cell should clearly continue the same curve from A.

### Glass Cap (`glass_cap`) - 2×1

Wide object: a fragile glassy mushroom cap spanning both cells.

```text
A B
```

- A: left cap rim and underside gills, with the stem beginning near the seam.
- B: right cap rim and bright glass highlight; cap curvature continues from A.

### Fang Whip (`fang_whip`) - 2×1

Wide object: flexible whip with a fang tip.

```text
A B
```

- A: handle/root knot and first curve of the whip.
- B: whip tip with the fang head; curve must visibly continue from A across the seam.

### Burning Cap (`burning_cap`) - 2×2

Large object: hot mushroom cap with flame core.

```text
A B
C D
```

- A: left upper cap, ember cracks, first flame lick.
- B: right upper cap, hotter glow and red rim.
- C: lower stem/base and shadowed burn marks.
- D: lower flame tail and glowing underside; should connect to B and C.

## Armor Artifacts

### Bark Plate (`bark_plate`) - 1×1

One-cell object: square-ish bark armor plate.

- Cell A: bark slab with vertical grain, rounded corners, moss edge.

### Loam Scale (`loam_scale`) - 1×1

One-cell object: single earthen scale.

- Cell A: curved loam scale, heavy bottom, small grit marks.

### Mycelium Wrap (`mycelium_wrap`) - 2×1

Wide object: braided mycelium band.

```text
A B
```

- A: left half of braided belt, loose root fibers entering from edge.
- B: right half, binding knot or bead; braid continues seamlessly from A.

### Stone Cap (`stone_cap`) - 1×2

Tall object: heavy stone mushroom cap and stem.

```text
A
B
```

- A: stone cap top, cracks and moss.
- B: thick stone stem/base; cracks from A continue downward.

### Root Shell (`root_shell`) - 2×2

Large object: root-wrapped shield shell.

```text
A B
C D
```

- A: upper-left shell plate and root edge.
- B: upper-right shell plate, highlight and bark ridge.
- C: lower-left root tendrils wrapping under.
- D: lower-right shell closure; roots from C continue around it.

### Truffle Bulwark (`truffle_bulwark`) - 2×2

Large object: dense truffle shield.

```text
A B
C D
```

- A: upper truffle dome with rough pores.
- B: raised armored lobe, darker edge.
- C: heavy lower mass and grounded shadow.
- D: secondary lobe with moss/loam chips; one continuous truffle body.

## Stun Artifacts

### Shock Puff (`shock_puff`) - 1×1

One-cell object: round puffball with lightning split.

- Cell A: puffball cloud, electric crack through center.

### Glimmer Cap (`glimmer_cap`) - 1×1

One-cell object: small luminous cap.

- Cell A: glowing cap with star-like glint, subtle stem.

### Dust Veil (`dust_veil`) - 1×2

Tall object: falling veil of spore dust.

```text
A
B
```

- A: source cap/cloud and bright suspended dust.
- B: drifting veil tail, dust trail fading downward from A.

### Static Spore Sac (`static_spore_sac`) - 1×2

Tall object: hanging charged spore sac.

```text
A
B
```

- A: sac neck and upper swollen membrane, bright static nodes.
- B: lower sac body, lightning trace continuing from A, rounded heavy bottom.

### Thunder Gill (`thunder_gill`) - 2×1

Wide object: exposed mushroom gill with lightning veins.

```text
A B
```

- A: left gill fan and first lightning vein.
- B: right gill fan and second vein; gill ribs continue from A.

### Spark Spore (`spark_spore`) - 2×2

Large object: charged spore orb.

```text
A B
C D
```

- A: upper-left orb edge and pale glow.
- B: upper-right sparks and highlight.
- C: lower-left electric crack entering the core.
- D: lower-right orb edge and trailing sparks.

## Hybrid / Utility

### Moss Ring (`moss_ring`) - 1×1

One-cell object: mossy ring charm.

- Cell A: circular ring, moss texture around edge, pale center.

### Haste Wisp (`haste_wisp`) - 1×1

One-cell object: fast leaf-like flame.

- Cell A: angled wisp/leaf, motion streak, bright tip.

## Character Shop Artifacts

### Thalla's Sacred Thread (`thalla_sacred_thread`) - 1×2

Tall object: sacred spore thread.

```text
A
B
```

- A: glowing knot or charm at the top, thread begins curling.
- B: long trailing thread, spore beads continuing from A.

### Lomie's Crystal Lattice (`lomie_crystal_lattice`) - 2×1

Wide object: protective crystal lattice.

```text
A B
```

- A: left crystal frame, first diagonal lattice line.
- B: right crystal frame, crossing lattice line completing the pattern.

### Axilin's Ferment Core (`axilin_ferment_core`) - 1×2

Tall object: bubbling ferment core.

```text
A
B
```

- A: glass/organic core top with bubbles.
- B: denser lower liquid glow, bubbles rising from B into A.

### Kirt's Venom Fang (`kirt_venom_fang`) - 1×1

One-cell object: compact fang charm.

- Cell A: curved fang, small venom dot, balanced shape.

### Morga's Flash Seed (`morga_flash_seed`) - 2×1

Wide object: bright seed with speed streak.

```text
A B
```

- A: seed body and first flash line.
- B: light trail and crackle; flash should clearly originate from A.

### Dalamar's Ashen Shard (`dalamar_ashen_shard`) - 1×2

Tall object: dark ash shard.

```text
A
B
```

- A: broken shard crown with ash glow.
- B: tapering shard point, gray dust falling from A.

## Character Signature Starters

### Spore Lash (`spore_lash`) - 1×1

- Cell A: coiled lash with star/spore tip.

### Settling Guard (`settling_guard`) - 1×1

- Cell A: small shield cap resting on a flat base line.

### Ferment Phial (`ferment_phial`) - 1×1

- Cell A: flask with bubbling fluid.

### Measured Strike (`measured_strike`) - 1×1

- Cell A: precise spear/marker with horizontal balance line.

### Flash Cap (`flash_cap`) - 1×1

- Cell A: small cap with speed sparks around it.

### Entropy Shard (`entropy_shard`) - 1×1

- Cell A: angular dark shard with crossed fracture lines.

## Bags

Bags should read as containers, not combat items. Their art may be more decorative and textile-like, but each occupied cell still contributes to one full object.

### Starter Bag (`starter_bag`) - 3×3

```text
A B C
D E F
G H I
```

- A/B/C: upper flap, stitched rim, soft canvas highlights.
- D/E/F: central body, clasp centered around E, folds continue through D and F.
- G/H/I: lower pouch body, base seam, subtle shadow.

### Moss Pouch (`moss_pouch`) - 1×2

```text
A
B
```

- A: drawstring mouth, mossy fabric rim.
- B: rounded pouch belly, moss fibers continuing from A.

### Amber Satchel (`amber_satchel`) - 2×2

```text
A B
C D
```

- A/B: handle and top flap spanning the seam.
- C/D: satchel body with amber clasp centered between cells.

### Trefoil Sack (`trefoil_sack`) - 3×2 T-shape

```text
A B C
. E .
```

- A/B/C: three-lobed clover-like top pouch.
- E: hanging lower lobe/string continuation from B.
- The side cells are placement holes. The icon should still read as a T-mask, but soft rounded overhang is acceptable and preferable to rectangular cutouts.

### Birchbark Hook (`birchbark_hook`) - 3×2 L-shape

```text
A B C
D . .
```

- A/B/C: long birchbark strip with stitched top seam.
- D: hooked bend descending from A; should look like the strip turns downward.

### Hollow Log (`hollow_log`) - 3×2 J-shape

```text
A B C
. . F
```

- A/B/C: hollow log body running horizontally.
- F: right-side downward hook/branch end continuing from C.

### Twisted Stalk (`twisted_stalk`) - 3×2 S-shape

```text
. B C
D E .
```

- B/C: upper twisted stem sweeping right.
- D/E: lower stem sweeping left; E connects visually to B.

### Spiral Cap (`spiral_cap`) - 3×2 Z-shape

```text
A B .
. E F
```

- A/B: upper cap spiral moving right.
- E/F: lower cap spiral moving right; B connects diagonally into E.

### Mycelium Vine (`mycelium_vine`) - 1×4

```text
A
B
C
D
```

- A: vine tip and small glowing node.
- B/C: continuous braided vine body with small root fibers.
- D: lower tendril end; must clearly continue from C.

## Asset Naming

If authored assets are added later, use:

```text
web/public/artifacts/{artifact_id}.webp
web/public/artifacts/{artifact_id}@2x.webp
```

For irregular bags, the game uses the artifact `shape` mask for collision and placement. The bitmap may include organic overhang into mask-empty cells when that preserves a continuous icon; do not force transparent rectangular holes into generated art.
