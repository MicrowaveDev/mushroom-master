# Repository Instructions

## Source Review Workflow

When reviewing or improving lore in this repository:

- Do the review as an agent task, not as an OpenAI API prompt.
- Read `data/<channel>/messages/*.md` first only when source understanding is still missing for the current review cycle.
- If the source markdown files were already analyzed earlier in the same review cycle, do not re-read all of them again before reviewing the generated lore and page images.
- In that case, reuse the prior source understanding and review the current result against:
  - `data/<channel>/generated/mushroom-lore.md`
  - `data/<channel>/characters/*/manifest.json`
  - `data/<channel>/generated/page-images/`
- After reviewing the generated result, explicitly decide whether the issue is best fixed by:
  - source hashtag routing
  - deterministic markdown normalization / contextual routing
  - deterministic post-generation preservation of required names/details
  - renderer/layout logic
  - lore generation prompt changes
- Prefer adjusting deterministic rules when the output drops or misplaces source-grounded named entities, weaknesses, artifacts, locations, or short title-card facts that are already present in the archived markdown.

## Hashtag Routing Rules

Agent-assigned hashtags are the authoritative routing source for lore inclusion and character grouping.

Use these hashtags in source Telegram messages and archived markdown:

- `#general_lore`
  - include this message in compact general world context
- `#character_<key>`
  - include this message in the dossier for that character
  - example: `#character_thalla`
- `#exclude_lore`
  - exclude this message from lore generation entirely

Rules:

- If explicit hashtags are present, prefer them over heuristic mention matching.
- If a source message is still untagged, treat it as pending separation and keep it available as broad fallback context until it is tagged.
- Hashtags belong in the source Telegram message text/caption and must also appear under `## Hashtags` in the archived markdown.
- Lore text itself should not keep the hashtags; they are routing metadata, not narrative content.

## Tagging Workflow

After analysis, apply routing by calling the local tagging script instead of only describing the desired tags in prose.

Use:

- `npm run set-message-hashtags -- --id <messageId> --hashtags "#general_lore #character_thalla"`

Expected behavior:

- updates the live Telegram source message
- refreshes the corresponding archived markdown file
- stores the tags under `## Hashtags`

When tagging:

- prefer concise stable character keys such as `thalla`, `lomie`, `kirt`
- use `#general_lore` only when the message materially contributes to world context
- use `#exclude_lore` for noise, maintenance content, generated artifacts, or source content that should not feed lore generation

## PDF Review Workflow

When reviewing the generated lore result visually:

- Treat `data/<channel>/generated/page-images/` as the primary visual review input.
- Read `data/<channel>/generated/page-images/manifest.json` to get page order.
- Use `data/<channel>/generated/mushroom-lore.md` only as a supporting normalized output when a visual issue needs root-cause analysis.
- Treat `data/<channel>/characters/*/manifest.json` as the canonical source for which image belongs to which character.

## Review Priorities

When inspecting the generated lore and page images, prioritize:

1. Whether source-tagged content appears in the correct general-lore or character section.
2. Whether each character intro keeps the correct image with the correct overview text relative to the source markdown and character manifests.
3. Section hierarchy and page flow.
4. Whitespace balance and oversized empty regions.
5. Awkward page breaks, orphaned headings, detached subsections, and image sizing/background issues.

## Fix Strategy

When proposing or applying fixes:

1. Prefer deterministic hashtag routing and markdown normalization before prompt changes.
2. Prefer deterministic post-generation preservation rules before prompt changes when the generated markdown drops required names or compresses away short source-grounded entities.
3. Prefer deterministic renderer/layout fixes before prompt changes for visual issues.
4. Prefer source markdown and OCR text over manifest/image-description fields when resolving character content.
5. Do not add a new OpenAI API review step for page-image inspection; keep that as an agent review workflow.
6. When a deterministic preservation rule is added or adjusted, review the regenerated result for overreach:
   - accidental insertion of low-value quoted fragments
   - duplicated names
   - names restored into the wrong subsection
   - stylistic bloat that should instead be handled by narrower matching rules
7. If a deterministic rule restores too much, narrow the matching logic or add explicit allow/deny behavior before weakening the prompt.
8. If you change canonical character image manifests or other generated-only lore inputs without changing source Telegram content, regenerate with `npm run regenerate -- --force` so HTML/PDF/page-images bypass the source-hash cache.
9. After any forced regeneration, verify freshness before reviewing visuals: confirm `generated/mushroom-lore.html`, `generated/mushroom-lore.pdf`, and the relevant files under `generated/page-images/` have modification times newer than the regeneration start time, then inspect those freshly written files rather than relying on a previously opened viewer snapshot.
10. If you only need to re-check renderer/layout/style/prompt effects against already archived local inputs, use `npm run regenerate -- --force --skip-download` to skip the Telegram download phase while rebuilding from stored markdown/manifests. That mode should still upload the resulting PDF through the bot/channel delivery path.

## Review Outputs

If asked to review the generated result, produce:

- findings ordered by severity
- likely root cause for each issue
- whether the issue contradicts the source markdown/tags or only the generated/normalized output
- whether the fix belongs in hashtag routing, deterministic markdown normalization, renderer CSS, or lore generation
- whether the fix should instead go into deterministic post-generation preservation / must-keep entity handling
- concise next-step recommendations
