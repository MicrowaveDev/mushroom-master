# UI / Renderer Design Rules

This repository currently has one primary UI surface:

1. The generated mushroom lore HTML/PDF dossier.
2. The page-image review output under `data/<channel>/generated/page-images/`.

Future mushroom UI work may add more screens, but design decisions should still start from this repository's actual needs: readable lore presentation, stable print layout, and a light pastel mushroom visual language.

## Core Principle: Print-First Readability

- Prefer document flow, section clarity, and print stability over app-like chrome.
- Keep layouts rich enough to feel intentional, but never so decorative that they weaken readability.
- Use whitespace to support hierarchy, not to create empty dead zones.
- The generated PDF and page images are the primary quality bar for visual changes.

## Visual Direction

- Default to a light pastel mushroom theme for future UI work.
- Favor soft creams, warm parchment, muted sage, pale moss, dusty peach, light amber, and gentle earth accents.
- Avoid dark-theme defaults unless a specific task explicitly calls for them.
- Decorative mushroom motifs, spores, and botanical ornaments should stay subtle and supportive.
- If ornamentation competes with headings, body text, or character images, reduce it.

## Layout Hierarchy

Prefer this hierarchy for dossier-like layouts:

1. Document title and short opening context.
2. Major section headings such as general lore and characters.
3. Character intro blocks with canonical image plus overview text.
4. Supporting subsections and body content.

Rules:

- Keep hierarchy shallow and obvious.
- Use heading scale, spacing, and separators before adding extra containers.
- Avoid nested framed boxes unless they communicate real structure.
- Preserve clear association between each character image and its matching overview text.

## Character Intro Rules

- Treat the character intro as the key visual unit for a dossier section.
- Keep the canonical manifest image with the correct character heading and overview.
- Support portrait images with a stable side-by-side layout when space allows.
- Fall back to stacked layout on narrow widths or when side-by-side presentation hurts readability.
- Avoid image sizing that creates oversized gaps, crowded text wrap, or broken page flow.

## Spacing and Density

- Aim for consistent vertical rhythm across headings, images, paragraphs, and section breaks.
- Major headings should feel clearly separated without wasting a large portion of a page.
- Intro blocks and separators should have enough margin to avoid collisions with nearby text.
- Watch for oversized whitespace near page bottoms, after headings, and around image-heavy sections.

## Typography

- Typography should feel like a field guide or illustrated dossier: calm, readable, and slightly literary.
- Headings may carry more personality, but body text should remain highly legible in print.
- Avoid tiny decorative text treatments that degrade in PDF export or page screenshots.
- Favor stable, print-friendly type choices over trendy UI typography.

## Color and CSS Rules

- Reuse repo-native renderer variables and styling patterns before introducing new color systems.
- Prefer light pastel values and warm neutrals over stark contrast or saturated dark surfaces.
- Use strong accent color sparingly for headings, dividers, and small emphasis points.
- Avoid large blocks of intense color behind reading text.
- Do not import another repo's SCSS tokens, component assumptions, or layout systems without verifying they exist here.

## Print and Page-Break Rules

- Treat print CSS as core product behavior.
- Avoid orphaned headings, detached subheadings, and split character intro blocks.
- Prefer deterministic renderer fixes using spacing and page-break controls over content hacks.
- When a layout issue shows up in screenshots, verify it in the generated HTML/PDF pair and fix it in renderer logic where possible.

## Responsive Expectations

- PDF output is primary, but HTML should remain readable in a browser at narrow widths.
- Character intro layouts should collapse cleanly on smaller screens.
- No horizontal overflow.
- Keep image scaling controlled so local HTML review is still useful.

## Review Checklist

When reviewing visual output, check:

1. Section hierarchy and page flow.
2. Character image and overview pairing accuracy.
3. Whitespace balance.
4. Awkward page breaks, orphans, and detached headings.
5. Image sizing, placement, and background treatment.
6. Whether ornamentation helps the page or only adds noise.
7. Whether the palette still reads as light pastel mushroom rather than dark, heavy, or generic.

## Adapting Guidance From Other Repos

- Do not paste app-dashboard guidance directly into this project.
- Translate outside guidance into repo-native terms: markdown structure, renderer CSS, Puppeteer print behavior, generated HTML/PDF files, and page-image review.
- If future UI surfaces are added, keep them consistent with the same mushroom-world visual direction unless product requirements clearly differ.
