# Known Issues

Living list of known UX/visual issues in the Mushroom Battles web game / Mini App that an agent might otherwise treat as a fresh bug. When you encounter a symptom matching one of these, prefer the documented mitigation/context over re-investigating from scratch. When you fix one, remove the entry; when you discover a new recurring trap, add an entry here in the same change.

Scope: app-frontend (Vue web game / Mini App) and adjacent visual surfaces. Lore-pipeline issues belong elsewhere.

---

## Result-sheet content truncated when sheet hits its `max-height` cap

**Where:** Round-result bottom sheet (`.replay-result-sheet`) on the replay screen — the cream sheet that crowns the result with the mushroom decoration, hero block, reward chips, battle summary, and Continue button.

**Symptom:** When the sheet's content total height exceeds `max-height: min(73svh, 720px)`, content inside `.replay-sheet-body` (`overflow: auto`) becomes scrollable, but visually it can read as "random blocks truncated" — the user sees a half-cut card edge at the bottom of the sheet and may not realize it scrolls. Which block gets truncated depends on layout density (longer fighter names, additional reward chips, taller hero copy, achievement reveals), so the same screen can look fine in one session and clipped in another.

**Why it exists:** The sheet caps its overall height to keep the bottom-sheet pattern usable on small viewports (otherwise it pushes the chevron/grip off-screen). The cap is `min(73svh, 720px)` — i.e. 73% of the small-viewport stable height, capped at 720px on tall desktops. Inside, `.replay-sheet-body` scrolls, so content is not lost, just visually cut.

**Do not "fix" by:**
- Removing the `max-height` outright — the bottom sheet stops behaving as a sheet on short viewports and the toggle/chevron becomes unreachable.
- Setting the sheet to `overflow: hidden` again — collides with the mushroom decoration that overflows above `.replay-result-sheet::before` and is the entire point of the corner ornament. The toggle bar's own `border-radius: 22px 22px 0 0` and the body's `border-radius: 0 0 22px 22px` exist precisely *because* the parent doesn't clip; together they preserve the rounded sheet corners.
- Forcing each child block to be smaller via aggressive `font-size`/`padding` reductions — that fights the focused-result-panel typography rules in `.agent/workflows/ui-design.md`.

**Acceptable mitigations:**
- Tune the cap value itself (currently `73svh`), small bumps trade off bottom-sheet usability against truncation. Keep the `720px` desktop cap.
- Tighten *interior* rhythm: lower `.replay-sheet-body` `gap`, trim padding around the hero block, reduce the toggle bar height — the toggle was already slimmed from 58px to 36px for this reason.
- Cap focused content widths (already done — `.replay-sheet-body > *` capped at 540px) so vertical density doesn't grow with desktop width.
- For genuinely tall content (replay log mode), the sheet already swaps body content via `v-if`/`v-else`; if a new always-on block is added, audit total height first.

**If the user reports this:** confirm whether they're seeing it on a short viewport (mobile keyboard up, short laptop) or tall (desktop). On tall viewports the 720px cap is the bottleneck and bumping that may be appropriate; on short viewports the `svh` ratio is the bottleneck and tightening interior content is the right lever.

**Related files:**
- [web/src/styles.css `.replay-result-sheet`](../web/src/styles.css)
- [web/src/pages/ReplayScreen.js — `.replay-sheet-body` markup](../web/src/pages/ReplayScreen.js)
- [.agent/workflows/ui-design.md — Cap focused-result panels rule](../.agent/workflows/ui-design.md)
