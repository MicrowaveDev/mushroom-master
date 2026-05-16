# Mushroom Battles Character Key Art Concept

**Purpose:** replace the current social preview image, which reads like a decorative mushroom trim, with character-centered key art that sells Mushroom Battles as a cast-driven auto-battler.

**Primary use cases:**
- Telegram link preview for `https://mushroombattles.com/`
- Open Graph / Twitter preview image
- Web landing/auth hero background or upper card image
- Store-like promotional art for future Telegram Mini App presentation

## Current Problem

The current preview image is polished but communicates "fungal ornament" more than "character battle game." It does not show the playable cast, combat fantasy, or collectible roster appeal. Character-centered games usually lead with a tight cast composition: faces, silhouettes, weapons, roles, and clear faction identity.

The target should feel closer to a hero roster splash: several strong characters arranged as a group, with one or two central figures larger, side characters overlapping behind, and enough negative space for title/copy overlays if needed.

## Canon Guardrails

The cast must stay within the Mushroom Battles visual contract:

- The heroines are mushroom-elves, not humans wearing mushroom accessories.
- Visible ears must be elf ears.
- The group must read as one fungal circle / system, not unrelated fantasy skins.
- Shared motifs: spores, fungal caps, mycelium threads, black-tree biology, living textiles, organic magic.
- Tone: dark-fairytale fungal fantasy, not hard sci-fi and not generic medieval fantasy.
- Avoid official game/IP lookalikes. The reference images are composition references only.

## Recommended Cast Strategy

Use **five foreground heroines** for the strongest first read:

- **Thalla** as the central sovereign: gold, white, bone, sacred fungal regalia, calm danger.
- **Lomie** near center or upper side: deep green, indigo, violet portal spores, wide mushroom cap silhouette.
- **Kirt** as high-energy side figure: black/violet/neon green, Ramaria antlers, bow posture.
- **Dalamar** as severe contrast: white/black/ash, entropy scepter, porcelain stillness.
- **Axilin** as warm chaos: amber, ginger hair, fermentation flasks, alchemist posture.

Use **Morga** only in roster-strip or six-character variants. She is playable and visually energetic, but the older canon design requirements still define the primary circle as five. If included, she should sit on the outer edge as a fast red-orange striker, not steal the central read from Thalla/Lomie/Kirt.

## Composition Requirements

### Variant A: Premium Hero Splash

Wide 16:9 composition. Thalla in the center-front, Lomie and Kirt flanking with stronger gestures, Dalamar and Axilin slightly behind. Characters overlap shoulders and props like a game splash screen. The background should be abstract Mycelium: black tree silhouette, luminous spores, organic amber/violet/green light, no detailed landscape.

Best for: Telegram preview, website hero, first marketing asset.

### Variant B: Vertical Roster Panels

Six narrow color panels, one character per panel, inspired by character roster celebration posters. Each panel has its own palette but shared fungal texture. No text inside the image, so the app can overlay title separately. Faces and upper bodies are most important; weapons/props can crop.

Best for: experimentation, social posts, carousel, character-select vibe.

### Variant C: Dark Fairy-Tale Circle

More painterly and atmospheric. The cast forms a semicircle around a glowing mycelium ring. Thalla still central, but the system/circle identity is emphasized over action poses. More premium and lore-heavy, less arcade.

Best for: final brand key art if the game should feel mysterious and polished.

### Variant D: Sketch-to-Key-Art Bridge

Preserve the current sketchbook concept-art language, but arrange the cast like production key art. Cream paper texture, loose construction lines, richer color accents, overlapping full-body/three-quarter figures. This may integrate best with the existing portraits.

Best for: near-term asset because it matches the current character art style.

## Crop And Layout Rules

- Master artwork should be **16:9** or wider-safe. Recommended production size: `1600x900` or `1920x1080`.
- Important faces must fit inside the center-safe area because Telegram and social previews crop unpredictably.
- Do not put essential details in the bottom 12% or outer 8% edges.
- Avoid baked-in title text for generated experiments. Add "Mushroom Battles" in HTML/CSS or design tooling later for reliability.
- Keep contrast strong at thumbnail size. The viewer should understand "fantasy character roster" at 320px wide.

## Production Acceptance Criteria

- At least three characters are immediately readable at preview size.
- Thalla, Lomie, and Kirt have clear silhouettes and distinct palettes.
- The image does not look like Fortnite/Overwatch or any existing IP; only the roster-composition logic is borrowed.
- No warped hands/faces in the central figures.
- No accidental text, watermark, logos, UI, or fake app buttons.
- No generic human-only cast; mushroom traits must be visible.
- Works under a dark blue Telegram preview card and a warm beige website surface.

## Experiment Prompts

Generated review experiments should stay in `.agent/key-art-experiments/` until a final direction is selected. Once selected, copy the final base image into `web/public/marketing/character-key-art-base.png`, then run `npm run game:social-preview` for a temporary check or `npm run game:social-preview -- --production` to write the production Open Graph/Twitter image at `web/public/marketing/social-preview.png`.

### Prompt A: Premium Hero Splash

Use case: stylized-concept
Asset type: social preview / game key art
Primary request: Create wide promotional key art for an original fantasy auto-battler called Mushroom Battles. Show a cast of five mushroom-elf heroines arranged like a character-centered game splash screen.
Scene/backdrop: abstract living fungal world, black mycelium tree silhouette, luminous spores, organic amber/violet/green light rays, soft atmospheric depth.
Subject: Thalla central-front, regal gold-white sovereign with glowing golden mycelium and elf ears; Lomie beside her with a huge green-indigo mushroom cap and violet portal spores; Kirt with purple hair, neon green Ramaria antlers, black punk archer outfit and bow; Dalamar severe porcelain-white and black entropy priestess with ash scepter; Axilin amber red-haired fermentation alchemist with flasks and warm chaotic energy.
Style/medium: high-end stylized game key art, painterly anime fantasy, polished but not photorealistic.
Composition/framing: 16:9 wide, overlapping half-body to three-quarter characters, Thalla largest in center, strong readable silhouettes, faces inside center-safe area, no text.
Lighting/mood: cinematic spore glow, premium, dramatic, inviting.
Constraints: original characters only, visible elf ears where ears are shown, fungal traits integrated into body/costume/magic, no logos, no text, no watermark.
Avoid: sci-fi armor, modern guns, copied Overwatch/Fortnite designs, generic humans, chibi, excessive darkness.

### Prompt B: Six-Panel Roster

Use case: stylized-concept
Asset type: character roster social preview
Primary request: Create a wide six-panel roster artwork for Mushroom Battles, showing six original mushroom-elf heroines in vertical color bands.
Scene/backdrop: each panel uses a different fungal-biological texture and palette, all tied together by spores and mycelium threads.
Subject: Thalla gold-white sovereign; Lomie green-indigo portal guide; Kirt black-violet-neon toxic archer; Dalamar white-black ash entropy priestess; Axilin amber ginger alchemist; Morga red-orange fast striker with flash-cap energy.
Style/medium: polished anime fantasy roster poster, crisp faces, game character promo art.
Composition/framing: 16:9 wide, six vertical panels, upper-body focus, each character cropped dynamically but readable, no text.
Lighting/mood: bright collectible roster energy with fungal magic accents.
Constraints: original characters only, elf ears visible when possible, no text, no logos, no watermark.
Avoid: direct resemblance to existing game characters, sci-fi bodysuits, human-only designs, cluttered backgrounds.

### Prompt C: Dark Fairy-Tale Circle

Use case: stylized-concept
Asset type: premium brand key art
Primary request: Create atmospheric key art for Mushroom Battles showing five original mushroom-elf heroines as an allied fungal circle.
Scene/backdrop: dark-fairytale Mycelium chamber, black tree roots, glowing mycelium ring, floating spores, amber/violet/green bioluminescence.
Subject: Thalla central and regal; Lomie with portal spores and mushroom cap silhouette; Kirt crouched or angled with toxic bow; Dalamar still and severe with ash; Axilin warm and volatile with alchemy flasks.
Style/medium: painterly fantasy illustration, rich organic textures, premium lore-forward game art.
Composition/framing: wide 16:9, semicircle arrangement, Thalla central, other figures arranged by color contrast, readable at thumbnail size, no text.
Lighting/mood: mysterious, elegant, slightly dangerous, fungal sacredness.
Constraints: mushroom traits integrated, visible elf ears where shown, no text, no watermark, no copied IP.
Avoid: horror gore, muddy dark palette, generic medieval armor, simple decorative mushrooms replacing character identity.

### Prompt D: Sketchbook Key Art

Use case: stylized-concept
Asset type: preview experiment matching current portrait style
Primary request: Create wide concept-art key art for Mushroom Battles using the current sketchbook portrait language, but arranged like a polished character game splash.
Scene/backdrop: cream sketchbook paper with faint blue construction lines, light spore washes, subtle mycelium arcs behind the cast.
Subject: five original mushroom-elf heroines: gold-white Thalla central, green-indigo Lomie, black-violet-neon Kirt, white-black Dalamar, amber Axilin.
Style/medium: expressive anime-inspired concept sketch, loose orange and graphite construction lines, watercolor color accents, not fully polished.
Composition/framing: 16:9 wide, overlapping three-quarter/full-body figures, central faces clear, dynamic but readable, no text.
Lighting/mood: elegant rough concept art, alive and premium, not unfinished placeholder.
Constraints: original characters only, visible elf ears where ears show, no text, no logo, no watermark.
Avoid: messy scribble noise, chibi proportions, photorealism, direct copying of current portrait poses.

## Reference-Inspired Prompt Variations

These prompts were written after reviewing event/key-art references where the cast sits around, behind, or above a strong title area. They are kept for reuse even though the current production preview uses Prompt A as its base.

### Prompt E: Emblem Arc Poster

Use case: stylized-concept
Asset type: raw social preview base art variation
Primary request: Create wide promotional key art for an original fantasy auto-battler called Mushroom Battles, inspired by game event posters where characters arc around a central emblem/title area. Do not copy any existing game/IP; use only the composition idea.
Scene/backdrop: bright open Mycelium sky-chamber with a pale circular fungal emblem shape in the center, blue-violet spore mist on one side and amber-gold fungal glow on the other, black mycelium branch silhouettes framing the top.
Subject: original mushroom-elf heroines arranged in a circular action arc around the center: Thalla gold-white sovereign with glowing mycelium, Lomie green-indigo portal guide with broad mushroom cap, Kirt black-violet-neon toxic archer with Ramaria antlers, Dalamar white-black ash entropy priestess, Axilin amber ginger alchemist with flasks, Morga red-orange flash striker.
Style/medium: polished stylized game key art, anime-fantasy illustration, dynamic and clean, high readability at thumbnail size.
Composition/framing: 16:9 wide, characters distributed around the outer thirds and corners, leave a clear central safe area for title overlay, energetic diagonal poses, no text.
Lighting/mood: bright promotional energy, celebratory, premium, magical spores.
Constraints: original characters only, visible elf ears where ears show, fungal traits integrated into body/costume/magic, no logos, no text, no watermark.
Avoid: sci-fi armor, modern guns, direct Overwatch/Fortnite resemblance, generic humans, cluttering the central title-safe area.

### Prompt F: Chapter Poster Flank

Use case: stylized-concept
Asset type: social preview base key art variation
Primary request: Create wide promotional key art for an original fantasy auto-battler called Mushroom Battles, inspired by bold chapter/key-art posters where four to five full-height characters flank a central title-safe zone. Do not copy any existing game/IP; use only the composition principle.
Scene/backdrop: high-contrast abstract fungal stage with warm amber-orange behind the left side and deep violet-blue behind the right side, giant blurred mushroom cap shapes and glowing mycelium strokes behind the cast.
Subject: four strongest foreground mushroom-elf heroines: Thalla central-left gold-white sovereign with luminous mycelium and sacred fungal regalia; Kirt front-right black-violet-neon archer with green Ramaria antlers and bow; Lomie back-right with broad green-indigo mushroom cap and portal glow; Axilin left with ginger hair, amber alchemist cloak and flasks. Optional Dalamar ghosted in the background as white-black ash silhouette.
Style/medium: polished stylized game promo art, crisp anime fantasy, bold clean shapes, rich color blocking, premium but not photorealistic.
Composition/framing: 16:9 wide, large characters from thigh-up, title-safe zone around lower center, characters overlap behind the future logo, strong diagonal poses, no text.
Lighting/mood: punchy launch-season energy, high contrast, warm vs cool split, magical fungal glow.
Constraints: original characters only, visible elf ears where ears show, mushroom traits integrated into body/costume/magic, no logos, no text, no watermark.
Avoid: direct Fortnite resemblance, sci-fi weapons, modern clothing, generic human fashion, clutter over the lower-center title area.

### Prompt G: Roster Showdown

Use case: stylized-concept
Asset type: social preview base key art variation
Primary request: Create ultra-wide roster showdown key art for an original fantasy auto-battler called Mushroom Battles, inspired by crossover showdown posters with many characters standing across the horizon and a strong lower-center title-safe zone. Do not copy any existing game/IP; use only the broad lineup/title-zone composition.
Scene/backdrop: split fungal battlefield background, amber-gold spore storm on the left, deep blue-violet portal mist on the right, black mycelium roots and giant mushrooms behind, subtle central glow for a future title.
Subject: six original mushroom-elf heroines in a horizontal lineup: Axilin amber alchemist with ginger hair and potion flasks at left; Dalamar severe white-black ash priestess with entropy scepter; Thalla central gold-white sovereign with glowing mycelium; Kirt dynamic toxic archer with purple hair and green Ramaria antlers; Lomie portal guide with broad green-indigo mushroom cap; Morga red-orange flash striker at right. Distinct silhouettes, elf ears visible where possible.
Style/medium: polished stylized anime-fantasy game key art, cinematic, readable faces, premium social banner.
Composition/framing: 16:9 wide, characters span the width with central figures larger, lower-center area kept open/darker for title overlay, no text.
Lighting/mood: energetic versus/showdown energy, collectible roster appeal, bright character contrast.
Constraints: original characters only, fungal traits integrated into body/costume/magic, no logos, no text, no watermark.
Avoid: direct Fortnite resemblance, sci-fi guns, cartoon mascots, human-only cast, too much clutter in the lower-center title area.

## Current Production Prompt

The current committed base image at `web/public/marketing/character-key-art-base.png` was generated from Prompt A: Premium Hero Splash. The production social preview at `web/public/marketing/social-preview.png` is generated by compositing the stylized title with:

```bash
npm run game:social-preview -- --production
```

For local review without touching the production asset:

```bash
npm run game:social-preview
```

For title-placement review sheets inspired by event/game-name overlays:

```bash
npm run game:social-preview -- --all-layouts --out tmp/social-preview-variations/layout.png
```

Supported title layouts: `left`, `center`, `bottom-band`, `bottom-crest`, `middle-bottom`, `top-band`, `top-crest`, and `center-band`.
Supported title styles: `classic`, `esports`, `engraved`, `arcane`, `telegram`, and `storybook`.

For the current key art, prefer bottom or lower-middle title placement. The characters' faces fill the upper third, so top overlays are useful as experiments but are more likely to cover the roster. Quick bottom-focused checks:

```bash
npm run game:social-preview -- --layout bottom-band --out tmp/social-preview-variations/bottom-band.png
npm run game:social-preview -- --layout bottom-crest --out tmp/social-preview-variations/bottom-crest.png
npm run game:social-preview -- --layout middle-bottom --out tmp/social-preview-variations/middle-bottom.png
```

For font/style exploration on a single placement:

```bash
npm run game:social-preview -- --layout bottom-band --all-styles --out tmp/social-preview-variations/style.png
npm run game:social-preview -- --layout bottom-crest --all-styles --out tmp/social-preview-variations/style.png
npm run game:social-preview -- --layout middle-bottom --all-styles --out tmp/social-preview-variations/style.png
```
