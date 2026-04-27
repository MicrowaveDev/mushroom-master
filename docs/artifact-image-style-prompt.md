# Artifact Image Style Prompt

Use this file as the shared style base for production artifact bitmaps.

These images are **small inventory icons**, not character illustrations. They must be simple, readable, and shaped to the artifact footprint. The goal is a clean Backpack Battles-style puzzle item: one clear ornament image rendered as a continuous overlay above the grid cells.

The style references are the two mushroom ornament images used in the PDF renderer:

```text
data/channel/assets/ornaments/top-right-mushroom.jpg
data/channel/assets/ornaments/bottom-left-mushroom.svg
```

Match these two ornament assets more than the character portraits or generic game-item art.

## Core Style

Generate one isolated artifact icon.

Visual style:
- simple readable mushroom-ornament inventory icon
- inspired specifically by `top-right-mushroom.jpg` and `bottom-left-mushroom.svg`, not by detailed character art
- flat/vector-like illustrated finish with a clean heavy outline
- thick dark brown or near-black contour, like `top-right-mushroom.jpg`
- large smooth color regions
- simple layered highlight shapes, not painterly rendering
- soft internal gradients are allowed only like `bottom-left-mushroom.svg`: smooth, controlled, and simple
- optional tiny dot clusters only like `top-right-mushroom.jpg`, kept sparse and near spots/seams
- high contrast between object and transparent background
- 2-5 main colors only
- one clear main silhouette
- minimal internal detail: only one or two readable accents
- no busy painterly texture
- no realistic light/shadow modeling
- no sketch scratches
- no construction lines
- no paper texture
- no loose particles outside the object silhouette unless the artifact itself is a contained glow/spark item
- no tiny details that disappear at 48-64px

The icon should look good when each grid cell is small. If a detail will not read at mobile size, omit it.

Footprint fill rules:
- the artifact silhouette must fill most of the footprint, not sit as a tiny emblem in the center
- 1x1 icons should fill about 72-88% of the cell on both axes
- multi-cell icons should fill about 82-94% of the total footprint along their main axis
- the visible non-transparent silhouette should cover at least about 28% of a 1x1 canvas
- the visible non-transparent silhouette should cover at least about 18% of every occupied cell in multi-cell artifacts
- leave only enough outer padding for background removal and the game's cell border
- every occupied cell must contain a readable part of the same continuous object
- for tall 1x2/1x3/1x4 artifacts, the image must remain visually connected across row boundaries
- for wide 2x1/3x1 artifacts, the image must remain visually connected across column boundaries
- avoid small separated symbols, repeated mini-icons, thin diagonal sticks, or a large blank area in any occupied cell

Important: do not make long skinny objects that only occupy a diagonal strip. Even needles, fangs, blades, lashes, and hooks must be stylized as chunky mushroom ornaments with a broad cap, head, guard, plate, glow body, ribbon, or aura integrated into the silhouette. The item may point diagonally only when its silhouette still fills the cell.

## Reference Style Cues

Use these visual cues from `top-right-mushroom.jpg`:

- heavy dark outline around the whole silhouette
- bold red/rose cap areas made from large flat shapes
- darker red shadow planes inside the cap, not realistic shading
- pale blue-white oval spots with thick dark outlines
- tiny dark dot clusters near spots, used sparingly
- a muted violet-gray stem with only a few simple internal strokes
- graphic vector look on white background

Use these visual cues from `bottom-left-mushroom.svg`:

- rounded mushroom clusters with smooth simplified forms
- blue, cyan, pale teal, cream, and white gradients
- soft radial highlight areas, but still vector-clean
- dark brown contour lines, not thin black sketch lines
- no gritty texture and no realistic material rendering

Shared reference rules:

- heavy dark outline around the whole silhouette
- bold flat or softly graded color regions
- simple internal contour lines, usually dark and sparse
- smooth highlight blobs instead of complex texture
- simple stems with 2-4 internal strokes
- no realistic depth, no photographic material, no soft cast shadow
- white/chroma-key background separation must be clean and graphic

For generated artifacts, translate these cues into the artifact material. For example:

- amber items use flat amber/orange shapes with dark contour and one cream highlight.
- bark/armor items use flat brown/green slabs with dark contour and a few grain lines.
- stun items use pale gold/yellow-green shapes with simple contained glow marks.
- bags use flat cloth/bark silhouettes with dark outline and one or two stitch/spot accents.
- any mushroom-cap-like item may borrow the red cap, pale oval spots, and dot-cluster language from `top-right-mushroom.jpg`.
- any mist/veil/glow item may borrow the soft blue/cream rounded gradient language from `bottom-left-mushroom.svg`.

## Shape Grammar

The artifact artwork must follow the footprint direction strictly. Do not let image generation invent diagonal or organic compositions when the footprint needs a straight icon.

### 1x1 Single Cell

Use one centered compact symbol.

Rules:
- centered object
- fills about 72-88% of the cell on both axes
- visible silhouette covers at least about 28% of the canvas
- clean outline
- no long skinny diagonal line; blade/needle items need a broad cap, guard, glow body, ribbon, or ornament mass
- no large empty corners caused by a thin object
- no floating secondary pieces

Good shapes:
- small cap
- shield plate
- shard
- ring
- seed
- puffball
- compact fang
- chunky capped needle
- short broad blade

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
- the top cell and bottom cell must both read as parts of one object, not separate small icons
- fill 82-94% of the canvas height and 70-88% of the canvas width
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
- The UI renders this bitmap once as a continuous overlay above the occupied cells.
- Do not draw separate repeated icons per cell.
- Do not draw grid borders.
- Do not draw cell backgrounds.
- Do not include the bag-cell outline; the game UI already draws cell borders.
- The artifact itself should be readable at cell size, with a clear silhouette in every occupied cell.

## Background And Transparency Workflow

Generate on a perfectly flat solid chroma-key background:

```text
#ff00ff
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

Do not use `#ff00ff` anywhere inside the artifact. Use this magenta key because many mushroom artifacts are green, yellow-green, moss, or teal.

After generation, remove the chroma-key background and save the final transparent PNG to:

```text
web/public/artifacts/{artifact_id}.png
```

## Family Language

Damage:
- amber, orange, red, burnt sienna, dark brown
- simple sharp silhouettes
- fangs, blades, caps, lashes
- use the red amanita ornament language when possible: dark outline, flat red/orange planes, cream highlights, small pale spots

Armor:
- moss green, bark green, muted stone, cream
- rounded protective silhouettes
- plates, shells, shields, rings, bark, moss
- use flat bark/stone planes, sparse dark grain lines, and one or two pale highlights

Stun:
- pale gold, yellow-green, electric olive, smoky cream
- simple contained glow shapes
- puffballs, sacs, gills, dust veils, sparks
- use flat pale-gold shapes with dark outline, not neon VFX or complex particles

Bags:
- one distinct bag color plus warm canvas/leather/bark
- clean container silhouettes
- stitched pouches, bark hooks, logs, vines
- use the same thick-outline ornament style, with simple stitch marks or oval patches

## Negative Prompt Checklist

Avoid:
- character concept art
- detailed paintings
- realistic props
- complex perspective
- glossy rendered mobile-game loot icons
- soft airbrushed highlights
- photorealistic mushrooms
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
- generic fantasy RPG item icons
- shiny gold bevels
- dense bubble fields

## Prompt Attachment

When generating an artifact, include this instruction in the prompt:

```text
Use docs/artifact-image-style-prompt.md as the style guide. Follow it exactly: simple small inventory icon matching data/channel/assets/ornaments/top-right-mushroom.jpg and data/channel/assets/ornaments/bottom-left-mushroom.svg. Use thick dark contour, flat or softly graded vector color regions, simple highlight shapes, sparse dark internal lines, high contrast, strict footprint direction, and a flat #ff00ff chroma-key background. The bitmap is rendered once as a continuous placement image above the grid cells, so horizontal artifacts must be strictly horizontal, vertical artifacts strictly vertical, square artifacts blocky/centered, and irregular bags must exactly follow the mask with transparent empty cells.
```
