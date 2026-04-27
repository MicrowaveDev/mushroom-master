# Sound Design Recommendations

Scope: recommendations only. The game currently exposes hooks for sound and haptics, but no sound assets are bundled yet.

## Existing Hooks

The result screen emits browser events that can be wired to audio later:

- `mushroom:achievement-unlock`
- `mushroom:season-tier-up`

These are also paired with Telegram haptic calls when Telegram WebApp haptics are available.

## Sound Set

Keep all sounds short, soft, and non-fatiguing. This game lives in a Telegram-sized loop, so repeated run endings must feel rewarding without becoming noisy.

| Event | File Suggestion | Length | Direction |
|---|---:|---:|---|
| Achievement unlock | `achievement-unlock.ogg` | 0.6-0.9s | Soft chime, tiny spore sparkle, warm wood click |
| Already-earned badge reveal | `achievement-earned.ogg` | 0.25-0.45s | Muted tick, low mycelium pulse |
| Season progress fill | `season-progress.ogg` | 0.8-1.2s | Gentle rising organic shimmer |
| Season tier-up | `season-tier-up.ogg` | 1.1-1.6s | Bigger bloom, layered chime, subtle bass lift |
| Diamond tier-up variant | `season-diamond.ogg` | 1.3-1.8s | Glassy crystalline bloom, still warm |
| Result screen settle | `recap-settle.ogg` | 0.3-0.5s | Soft UI thump, parchment/wood tone |
| Button tap confirmation | `ui-tap.ogg` | 0.08-0.14s | Dry wooden tap, very quiet |

Recommended formats:

- Primary: `.ogg`
- Fallback: `.mp3`
- Keep each file under ~80 KB if possible.
- Normalize around `-16 LUFS` integrated, with peaks below `-1 dB`.

## Resources

Good places to source or generate sounds:

- [Freesound](https://freesound.org/) - good for natural clicks, chimes, forest textures. Check license per asset.
- [OpenGameArt](https://opengameart.org/) - useful for UI packs and game-ready effects.
- [Kenney Audio](https://kenney.nl/assets?q=audio) - clean permissive UI sounds.
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/) - easy ambient/chime sourcing, check terms.
- [Sonniss GDC Bundles](https://sonniss.com/gameaudiogdc) - large free game audio packs, more browsing required.
- AI sound tools such as ElevenLabs Sound Effects, Stable Audio, or similar can work well for one-shot UI sounds.

## Prompt To Paste

Use this prompt for an AI sound generator:

```text
Create a cohesive set of short fantasy UI sound effects for a cozy mushroom autobattler game called "Mycelium Autobattler".

Style:
- organic, warm, tactile, magical
- mycelium, spores, bark, soft chimes, tiny crystals, parchment, wood
- not sci-fi, not orchestral, not horror
- no melody longer than a tiny motif
- no vocals
- no loud whooshes
- no harsh transients
- suitable for frequent mobile gameplay in Telegram

Generate these separate one-shot sounds:
1. achievement-unlock: 0.7 seconds, soft spore sparkle with a warm chime and tiny wooden click
2. achievement-earned: 0.35 seconds, muted low mycelium pulse, quieter than the unlock
3. season-progress: 1.0 second, gentle rising organic shimmer for a progress bar filling
4. season-tier-up: 1.4 seconds, satisfying magical bloom with layered soft chimes and subtle low warmth
5. season-diamond: 1.6 seconds, crystalline version of tier-up, bright but not sharp
6. recap-settle: 0.4 seconds, soft parchment and wood UI settle
7. ui-tap: 0.1 seconds, quiet dry wooden tap

Export each sound separately as clean, loop-free one-shot audio. Leave a tiny fade-out tail. Normalize consistently for mobile UI use.
```

## Selection Checklist

Before adding files to the repo:

- Sounds still feel good after hearing them 20 times.
- Achievement unlock and season tier-up are clearly different.
- The tier-up sound feels more important than a normal achievement.
- Nothing masks speech bubbles or replay combat feedback.
- Sounds are pleasant at low phone volume.
- Reduced-motion or future accessibility settings can disable them.

## Implementation Notes For Later

When assets exist, add a tiny audio helper that:

- Preloads the seven files after first user interaction.
- Listens to `mushroom:achievement-unlock` and `mushroom:season-tier-up`.
- Respects reduced motion / future sound settings.
- Uses low default volume, around `0.35`.
- Fails silently when autoplay restrictions block playback.
