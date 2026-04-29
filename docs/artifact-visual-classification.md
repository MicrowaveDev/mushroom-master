# Artifact Visual Classification

This document defines the color and shine language for artifact bitmap generation and UI rendering.

## Goal

Players should understand two things at a glance:

- **What class is this?** Use role color.
- **How cool or special is this?** Use shine tier.

Do not make the object art carry all meaning by itself. The bitmap, shop card, and grid cell should reinforce the same classification.

## Research Notes

RPG inventory systems commonly reserve color as a fast quality/classification signal. World of Warcraft's official manual describes item rarity/potency as readable from item color, and Blizzard's Diablo itemization posts repeatedly frame loot readability around making item upgrades easier to evaluate quickly. This pattern is useful because it lets players compare items before reading details.

For this game, pure rarity color would conflict with combat readability: players also need to know whether an artifact is damage, armor, stun, or bag. So Mushroom Master uses a two-channel system:

- **Hue = role/class.**
- **Shine = coolness/specialness.**

References:

- [World of Warcraft Classic Manual PDF](https://us.media.blizzard.com/manuals/wow/wow-classic-manual-enUS.pdf)
- [Diablo IV Season 4: Loot Reborn itemization overview](https://news.blizzard.com/diablo4/24077223/)
- [Diablo IV feature overview itemization section](https://news.blizzard.com/en-us/diablo4/23189677/diablo-iv-feature-overview)

## Role Colors

| Role | Purpose | Main Read | Prompt Palette |
| --- | --- | --- | --- |
| Damage | Attack, speed, armor tradeoffs | Hot / dangerous | amber, red-orange, burnt sienna, warm cream |
| Armor | Defense, protection, slow heavy items | Protected / grounded | moss green, olive, bark brown, muted stone, cream |
| Stun | Control, disruption, electricity/spores | Charged / unstable | pale gold, yellow-green, electric olive, smoky cream |
| Bag | Inventory expansion | Container / storage | canvas, amber leather, bark, moss cloth, mycelium fiber |

Role color is the strongest signal. A high-shine armor artifact should still read green/moss first, not gold.

## Shine Tiers

| Tier | Meaning | Source Rule | Visual Treatment |
| --- | --- | --- | --- |
| Plain | Basic shop item | normal price-1 item | matte, one small highlight, no glow |
| Bright | Better or larger item | price 2 or multi-cell | one strong highlight, modest contained glow |
| Radiant | Expensive/rare shop item | price 3, high-value bags | richer saturation, contained rim accent |
| Signature | Character identity item | `starterOnly` combat item or `characterItem` | distinctive emblem-like highlight, strongest contained shine |

Shine must not become texture. Do not add sparkle spray, noisy glow, realistic reflections, or baked shadows.

## Implementation Contract

The source of truth is:

```text
app/shared/artifact-visual-classification.js
```

Consumers:

- `app/scripts/next-artifact-image-prompts.js` includes role and shine instructions in generated image prompts.
- `web/src/components/ArtifactFigure.js` and `web/src/artifacts/render.js` add role/shine CSS classes to artifact figures.
- `web/src/components/prep/ShopZone.js` adds role/shine classes and a compact shine label to shop cards.

## Generation Rules

When regenerating bitmaps:

- Start with the role palette.
- Apply shine with highlight strength, saturation, and contained rim accents.
- Keep the icon chunky, flat, and readable at 48-64px per cell.
- Do not use photorealistic material rendering.
- Do not use loose particles or outside glow for shine.

Examples:

- `spore_needle`: damage + signature, red/orange cap and strong compact emblem highlight.
- `bark_plate`: armor + plain, moss/bark color with matte finish.
- `spark_spore`: stun + bright, gold/yellow orb with contained electric marks.
- `amber_satchel`: bag + radiant, warm container color with stronger polished highlight.
