# Artifact Image Style Prompt

Use this file as the shared style base for production artifact bitmaps.

These images are **small inventory icons**, not character illustrations. They must be simple, readable, and shaped to the artifact footprint. The goal is a clean Backpack Battles-style puzzle item: one clear ornament image sliced by grid cells.

## Core Style

Generate one isolated artifact icon.

Visual style:
- simple readable fantasy inventory icon
- inspired by the mushroom character world, but much simpler than character art
- warm hand-painted finish with clean ink outline
- high contrast between object and transparent background
- 2-4 main colors only
- one clear main silhouette
- minimal internal detail: only one or two readable accents
- no busy painterly texture
- no sketch scratches
- no construction lines
- no paper texture
- no loose particles outside the object silhouette unless the artifact itself is a contained glow/spark item
- no tiny details that disappear at 48-64px

The icon should look good when each grid cell is small. If a detail will not read at mobile size, omit it.

## Shape Grammar

The artifact artwork must follow the footprint direction strictly. Do not let image generation invent diagonal or organic compositions when the footprint needs a straight icon.

### 1x1 Single Cell

Use one centered compact symbol.

Rules:
- centered object
- fills about 70-85% of the cell
- clean outline
- no long diagonal that touches corners unless the artifact description requires a blade/needle
- no floating secondary pieces

Good shapes:
- small cap
- shield plate
- shard
- ring
- seed
- puffball
- compact fang

### Horizontal Rectangles: 2x1, 3x1

Use a strictly horizontal object.

Rules:
- main axis must be left-to-right
- object should be close to a straight band, blade, cap, strap, gill, branch, or whip
- left cell and right cell must both contain meaningful parts of the same object
- avoid tall central blobs that make one cell look empty
- avoid strong diagonal composition
- avoid vertical dangling details outside the footprint

Good shapes:
- horizontal mushroom cap
- straight fang/whip/strap
- braided band
- crystal lattice bar
- gill fan stretched horizontally
- log/stem segment

### Vertical Rectangles: 1x2, 1x3, 1x4

Use a strictly vertical object.

Rules:
- main axis must be top-to-bottom
- object should be close to a straight column, vine, fang, shard, sac, veil, or stem
- every occupied cell must contain a visible continuation of the same object
- avoid wide side branches
- avoid diagonal pose
- avoid large empty middle cells

Good shapes:
- long fang
- hanging sac
- vertical shard
- falling dust veil
- straight vine
- cap-and-stem column

### Square Blocks: 2x2, 3x3

Use one centered blocky object.

Rules:
- object should fill the square footprint evenly
- silhouette should be broadly round, shield-like, pouch-like, cap-like, or block-like
- all four quadrants should contain meaningful image content
- avoid thin diagonal items that leave two quadrants empty
- avoid complex scenes

Good shapes:
- large cap
- shield shell
- truffle bulwark
- satchel body
- charged orb
- starter bag

### Irregular Bag Masks

Use a simple bag/container silhouette that exactly follows the occupied cells.

Rules:
- the object must be designed for the mask shape, not a normal bag pasted into it
- occupied cells contain solid connected bag/body material
- empty cells contain only chroma-key background and become transparent
- no straps, glow, dust, stitching, or loose decorations may enter empty cells
- use straight horizontal/vertical segments where the mask is straight
- use rounded corners only inside occupied cells

Mask-specific guidance:
- T-mask (`trefoil_sack`): straight three-lobed top bar plus centered lower lobe.
- L-mask (`birchbark_hook`): horizontal top bar with a straight left downward hook.
- J-mask (`hollow_log`): horizontal top bar with a straight right downward hook.
- S-mask (`twisted_stalk`): upper-right bar connected to lower-left bar through the middle.
- Z-mask (`spiral_cap`): upper-left bar connected diagonally/stepped into lower-right bar, but still simple and readable.
- 1x4 vine (`mycelium_vine`): straight vertical vine, not a twisting scenic plant.

## Placement Image Rules

The generated bitmap is the **placement image** used by the grid.

- It must be one full image for the artifact footprint.
- The UI slices this bitmap across occupied cells.
- Do not draw separate repeated icons per cell.
- Do not draw grid borders.
- Do not draw cell backgrounds.
- Do not include the bag-cell outline; the game UI already draws cell borders.
- The artifact itself should be readable if split into cell-sized slices.

## Background And Transparency Workflow

Generate on a perfectly flat solid chroma-key background:

```text
#00ff00
```

Background requirements:
- one uniform color
- no paper texture
- no gradients
- no cast shadow
- no contact shadow
- no floor plane
- no reflection
- no lighting variation
- no watermark
- no text

Do not use `#00ff00` anywhere inside the artifact.

After generation, remove the chroma-key background and save the final transparent PNG to:

```text
web/public/artifacts/{artifact_id}.png
```

## Family Language

Damage:
- amber, orange, burnt sienna, dark brown
- simple sharp silhouettes
- fangs, blades, caps, lashes

Armor:
- moss green, bark green, muted stone, cream
- rounded protective silhouettes
- plates, shells, shields, rings, bark, moss

Stun:
- pale gold, yellow-green, electric olive, smoky cream
- simple contained glow shapes
- puffballs, sacs, gills, dust veils, sparks

Bags:
- one distinct bag color plus warm canvas/leather/bark
- clean container silhouettes
- stitched pouches, bark hooks, logs, vines

## Negative Prompt Checklist

Avoid:
- character concept art
- detailed paintings
- realistic props
- complex perspective
- diagonal composition unless the artifact is explicitly a needle/blade
- paper background
- shadow
- text
- watermark
- grid/cell separators
- separate repeated icon per cell
- lots of particles
- thin loose strokes around the icon
- noisy sketch halo
- complicated tiny ornament detail
- colors blending into transparency

## Prompt Attachment

When generating an artifact, include this instruction in the prompt:

```text
Use docs/artifact-image-style-prompt.md as the style guide. Follow it exactly: simple small inventory icon, clean outline, high contrast, strict footprint direction, flat #00ff00 chroma-key background. The bitmap is the placement image sliced by grid cells, so horizontal artifacts must be strictly horizontal, vertical artifacts strictly vertical, square artifacts blocky/centered, and irregular bags must exactly follow the mask.
```
