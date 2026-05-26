# Home Field Scale Contract

Date: 2026-05-26

Home Field assets must feel like they were authored for the same map, camera, and renderer. The source canvas size is not the same thing as the in-scene visual footprint.

## Camera And Runtime Scale

- Runtime map: `1792x1024`
- Terrain tile: `256x256`
- Initial proof map: `7 x 4` terrain tiles
- Camera: elevated top-down 2.5D, orthographic-ish game hub view
- Character runtime frame: `64x64`
- Chibi readable body target: about `48-64px` tall in mobile review

Every terrain tile, prop, exit, and chibi must use this same camera. Do not mix straight-on portrait, side-view platformer, realistic object render, icon, card art, or full-scene illustration angles into the same batch.

## Source Size Rules

- Terrain cells are final `256x256` tile images.
- Grass-family source is a larger shared meadow image, at least `1024x768`, cropped into `256x256` tiles by the producer.
- Most small/medium props use a `256x256` transparent source canvas.
- Large exits use a `512x512` transparent source canvas.
- Tall mushrooms may use a `256x512` transparent source canvas.
- Chibi proof sources may be generated larger for quality only when the workflow says so, but the current runtime sheet remains `64x64` frames.

When a source is larger than its runtime read, keep the art simple. Extra pixels are for cleaner alpha and shape control, not for more tiny detail.

## Visual Footprint Rules

Within the source canvas, the object should occupy the same relative scale it will have on the field:

- Small field tokens, such as tiny mushroom clusters, sprouts, and fallen branches: readable at `32-52px`; keep them compact, low, and simple.
- Bush clusters and weird garden props: readable at `48-80px`; use a few broad masses, not many small segments.
- Lanterns and signposts: readable at `56-96px`; keep a clear bottom anchor and one main silhouette.
- Large exits: read as landmark props, taller than chibis but not full-screen illustrations; keep a bottom-center anchor.
- Terrain detail: ground texture only; chibis and props must stay more visually important than grass.

Do not fill a `256x256` source canvas edge-to-edge unless the asset is intentionally a terrain tile. Transparent object-layer props need breathing room and a clear bottom-center anchor.

## Batch Consistency Rules

For a generation batch, all outputs must share:

- same elevated top-down 2.5D camera
- same warm dark storybook outline treatment for object-layer assets
- same muted moss/teal/amber/violet palette family
- same lighting direction and contrast level
- same detail budget at mobile scale
- same source canvas size for assets in the same family, unless the manifest explicitly declares a different size

Reject a candidate if it is individually attractive but looks like a different game, a different zoom level, a different camera angle, or a different asset class when placed in the Home Field preview.
