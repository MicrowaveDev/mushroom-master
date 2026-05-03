# Season Rank Image Reference

This is the canonical per-rank visual reference for production season rank emblems. Use it to review, regenerate, or compare rank bitmap images.

Global style lives in [season-image-style-prompt.md](season-image-style-prompt.md). Generation workflow and validation live in [season-image-todolist.md](season-image-todolist.md). Runtime rank data lives in `app/shared/season-levels.json`.

Production PNGs live at:

```text
web/public/season-ranks/{rank_id}.png
```

## Shared Contract

- Rank emblems are season progression badges, not achievements.
- Each rank should read as a premium circular medallion with one clear center glyph.
- The four ranks must be distinguishable by palette and center motif at small UI sizes.
- The emblem should fill a `192x192` transparent canvas with safe transparent margins.
- Do not use text, letters, SVG fallback motifs, or generic RPG medal templates as the source.

## Ranks

| Rank ID | Name | Type / Purpose | Motivation | Visual Target |
| --- | --- | --- | --- | --- |
| `bronze` | Bronze | Entry rank, `minPoints: 0`. | The first visible mark of the season; rewards participation and the start of a path through the Deep Ring. | Warm copper / burnt amber medallion, thick dark contour, single cream mushroom-cap or cap-dot center. |
| `silver` | Silver | Mid rank, `minPoints: 8`. | The player's path has become stable enough for silver mycelium threads to hold it. | Cool steel / pale platinum medallion, deep slate contour, two small white cap-dots or short cap glyphs. |
| `gold` | Gold | High rank, `minPoints: 18`. | A strong run trail is now visible even beneath the roots. | Rich gold / warm amber medallion, dark walnut contour, chunky ivory star or sun glyph at center. |
| `diamond` | Diamond | Top rank, `minPoints: 30`. | The season path has compressed into a hard knot that endured the ring's pressure. | Cool teal / pale cyan medallion, deep navy contour, faceted icy white gem or four-point knot glyph. |
