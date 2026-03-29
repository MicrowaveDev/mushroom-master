# Telegram Mushroom Archiver

## Goal

This project turns a Telegram lore channel into a local structured archive and a generated lore artifact.

Primary goals:

- read source posts from a Telegram channel through the Telegram client API
- extract text from screenshot posts
- preserve non-screenshot image posts as actual image assets
- preserve character images and organize them as character-linked metadata with image pointers
- repost extracted screenshot text back into the channel as short `#<message-id>` OCR messages
- store channel content locally as markdown plus assets
- generate a Russian-first mushroom-lore markdown, HTML, and PDF digest from the stored material
- structure the generated lore into character-focused sections plus a separate general lore section
- use agent-assigned hashtags in source messages and archived markdown as the routing source for what belongs in general lore, which character dossier, what should act as generation instructions, or nowhere
- support cleanup and maintenance workflows for channel text and OCR repost content

The current target channel can be private and identified by exact dialog title, not only by public username.

## Current Implementation

Current lore output status:

- the project already generates `mushroom-lore.md`, `mushroom-lore.html`, and `mushroom-lore.pdf`
- the current generated lore is Russian-first
- character-image posts can now be recognized from message text and written into character manifests with JSON pointers to archived assets
- structured `# Character Profile: ...` source posts are now parsed deterministically into canonical character dossier sections
- textual lore from source markdown/OCR now has higher priority than character-image descriptions and manifest `visualDetails`
- character dossiers are generated via separate per-character API calls rather than a single combined request, because a single request produced uneven quality where some characters received detailed descriptions while others were underwritten
- short excluded OCR title cards can now be deterministically pulled into adjacent routed character context when they behave as header/setup cards rather than true excluded content
- generated character sections now pass through deterministic post-processing that preserves stable subsection ordering and can restore must-keep named entities from routed source files when generation compresses them away
- OCR-extracted text is now stored directly in the source message markdown under `## OCR` instead of in separate generated OCR files
- character data lives in per-character `manifest.json` files only; the redundant `character-index.json` has been removed
- lore regeneration is skipped when source content has not changed since the last run (content-hash-based check)
- previous lore output is backed up automatically before regeneration (up to 5 backups kept under `generated/backups/`)
- archived source markdown can now store routing tags under `## Hashtags`
- Telegram source messages can now be tagged through a script, and those tags are mirrored into archived markdown
- `#instructions` source messages are now collected into generation bundles and can deterministically control character order
- named character photos now also support structured visual metadata (`face`, `eyes`, `makeup`, `hair`, `headwear`, `outfit`, `colors`, `pose`, `mushroom motifs`, `visibility notes`) when the image analysis returns it
- the current generated structure is:
  - `General Lore`
  - one section per character or major entity
  - supporting subsections such as overview, appearance, abilities/traits, residence/domain (`Обитель и владения`), motives/role, and relationships/story hooks when supported by the source material
  - character images placed at the start of each character section

The repo currently implements these workflows:

- `npm run fetch`
  - incremental new-message processing
  - reads only source messages newer than the last archived source message
  - skips generated PDF lore posts and other generated repost content
  - skips already-processed screenshots
  - OCRs new screenshots
  - classifies image posts as `screenshot` or `photo`
  - posts new OCR text to the channel through the Telegram Bot API
  - preserves photo assets and includes them in local markdown
  - writes character manifests when character-linked image/text posts are present
  - reads `#instructions` source messages and carries them into the lore-generation request bundles
  - applies deterministic character ordering from instruction text like `Порядок персонажей: ...`
  - regenerates Russian `mushroom-lore.md`, `mushroom-lore.html`, and `mushroom-lore.pdf`
  - renders per-page preview images for the generated PDF under `generated/page-images/`
  - writes a page-image manifest for downstream review workflows
  - optionally posts the generated PDF back to the channel
  - does not reconcile deletions or edits to older Telegram source posts; use `npm run regenerate` for a full sync pass

- `npm run regenerate`
  - full local regeneration from Telegram state
  - refreshes source message markdown from the current channel content
  - removes local markdown/assets for source messages that no longer exist in Telegram
  - reuses existing OCR/photo artifacts when possible
  - rebuilds `source-routing.json`, including parsed instruction entries
  - parses structured character-profile posts into deterministic dossier data before lore generation
  - applies deterministic contextual routing for short title-card OCR fragments when they belong to an adjacent routed dossier
  - rebuilds Russian lore markdown, HTML, PDF, and page preview images
  - runs deterministic lore normalization after generation so stable subsection order and must-keep source names can be restored even if the model output compresses them

- `npm run update-text-message -- --id <messageId> --text "<new text>"`
  - edits a source text message in Telegram by message ID
  - preserves existing routing hashtags already attached to that Telegram message
  - refreshes the corresponding local markdown file
  - only applies to editable source text posts, not OCR reposts or media posts

- `npm run set-message-hashtags -- --id <messageId> --hashtags "#general_lore #character_thalla"`
  - appends or replaces routing hashtags on a Telegram source message
  - refreshes the corresponding local markdown file
  - stores hashtags in `## Hashtags`
  - keeps hashtags out of the lore text body in the archived markdown
  - supports `#instructions` as a first-class routing tag for editor-style generation rules

- `npm run clean-text-duplicates`
  - deterministic cleanup over local markdown plus Telegram sync
  - removes known non-lore/meta tails like `Хочешь ли ты...` and `AI responses may include mistakes. Learn more`
  - removes short prompt leftovers like `расскажи`, `добавь`, and speculative question tails that are not lore
  - removes cross-message duplicate fragments when one message only contains a partial version and a fuller version exists elsewhere
  - trims boundary carry-over between adjacent OCR messages, including mid-sentence overlaps
  - updates local markdown
  - updates or deletes bot-posted OCR reposts in the channel to match the cleaned local state
  - writes a cleanup report

- `npm run backfill-posted-message-ids`
  - legacy compatibility command
  - separate OCR repost metadata is no longer stored, so the command currently writes a no-op report only

- `npm run rebuild-ocr-reposts`
  - deletes the current live OCR repost set from the channel
  - recreates OCR reposts from local markdown in source-message order
  - updates local OCR repost metadata to match the new live Telegram posts
  - keeps OCR reposts with empty cleaned text deleted
  - writes a rebuild report

- `npm run analyze:lore-prompt`
  - generates a saved report with prompt-quality findings and revised prompt suggestions
  - should be used to improve completeness and section quality of the current character/general-lore digest

- `npm run analyze:pdf-structure`
  - generates a saved deterministic review packet for layout and structure inspection
  - reviews source message markdown plus rendered page screenshots from `generated/page-images/`
  - includes a reusable `Review Instructions` checklist for future agent review passes
  - should be used to improve section hierarchy and presentation of the current Russian dossier output

- `npm run audit:untagged`
  - generates a deterministic report of source files that still lack explicit routing hashtags
  - highlights likely fragments vs substantive files and shows a short preview for faster agent tagging passes
  - should be used before lore review to reduce heuristic fallback and make routing authoritative

## Channel Content Rules

Current behavior by content type:

- Source text messages:
  - can be edited through the update script
  - can carry agent-assigned routing hashtags
  - can be refreshed from Telegram during regeneration
  - are created locally as new markdown files when new Telegram text messages appear
  - are removed locally if the source Telegram message is deleted
  - can carry `#instructions` to steer generation behavior such as character order

- Screenshot posts:
  - are OCR’d
  - get reposted as bot messages like `#51`
  - existing OCR reposts are treated as immutable during normal fetch/regenerate flows
  - cleanup can still synchronize existing repost content when deterministic cleanup changes the local OCR text
  - if cleanup reduces an OCR repost to empty text, that live bot repost is deleted and its local metadata is left empty

- Photo posts:
  - are preserved as image assets
  - are referenced in message markdown
  - can be attached to a character when the message text identifies that character
  - are indexed in per-character JSON manifests with pointers to archived image files
  - can store structured visual details for character imagery when the analyzer is able to extract them
  - are treated as lower-priority descriptive input than textual lore when both exist for the same character
  - are placed at the intro of the matching character section in the generated lore when a matching character is recognized
  - are embedded into the generated lore HTML/PDF

## Requirements

- Node.js 20+
- Telegram client credentials from https://my.telegram.org
- a Telegram string session in `CLIENT_TOKEN`
- OpenAI API access
- a Telegram bot token if OCR reposts and PDF delivery should post into the channel

## Setup

1. Install dependencies:

```bash
npm install
```

2. Fill in `.env`.

Required:

- `CLIENT_TOKEN`
- `OPENAI_API_KEY`
- `TG_CLIENT_API_ID`
- `TG_CLIENT_API_HASH`
- `CHANNEL_USERNAME`

Optional:

- `TELEGRAM_BOT_TOKEN`
- `BOT_SEND_TO_CHANNEL`
- `ADMIN_CHAT_IDS`
- `MESSAGE_LIMIT`
- `OPENAI_OCR_MODEL`
- `OPENAI_LORE_MODEL`

Notes:

- `CHANNEL_USERNAME` can be a public username, a `https://t.me/...` link, or the exact Telegram dialog title of a private channel.
- `MESSAGE_LIMIT=0` means process all source posts.
- OCR reposts and PDF posting work best when the bot is an admin in the channel.

## Commands

```bash
npm run fetch
npm run regenerate
npm run update-text-message -- --id 123 --text "New text"
npm run set-message-hashtags -- --id 123 --hashtags "#general_lore #character_thalla"
npm run backfill-posted-message-ids
npm run rebuild-ocr-reposts
npm run clean-text-duplicates
npm run analyze:lore-prompt
npm run analyze:pdf-structure
npm run audit:untagged
```

## Output Layout

Generated data is stored under `data/<channel>/`:

- `messages/`
  - per-source-message markdown
  - may include `## Hashtags` for lore-routing metadata
  - may include `## OCR` with extracted screenshot text (embedded directly, no separate OCR files)
- `assets/`
  - downloaded screenshot and photo assets
- `characters/`
  - one folder per detected character/entity
  - `manifest.json` with image pointers, source-message references, `completenessTier`, and structured profile data when available
  - this is the single source of truth for character data
- `generated/`
  - `source-routing.json`
    - records parsed `#instructions` entries
    - records general-lore files, character-routed files, and pending unclassified files
  - `general-lore-context.md`
    - the compact shared general-lore section generated first and then passed into character dossier requests
  - `mushroom-lore.md`
  - `mushroom-lore.html`
  - `mushroom-lore.pdf`
  - `.source-hash` — content hash of source inputs; regeneration is skipped when unchanged
  - `backups/` — automatic backups of previous lore output before regeneration (up to 5 kept)
  - `page-images/`
    - one PNG per rendered PDF page
    - `manifest.json` with page ordering and filenames for review tooling
- `generated/reports/`
  - duplicate cleanup report
  - OCR rebuild report
  - lore prompt analysis report
  - PDF structure analysis report
  - untagged routing audit report

## Current Limitations

- Hashtag-driven routing is now the intended source of truth, but older untagged archives can still fall back to heuristic routing until an agent classifies them.
- `npm run fetch` is now optimized for new-message ingestion; if older Telegram posts were edited or deleted, run `npm run regenerate` to reconcile the archive.
- `#instructions` currently supports deterministic character ordering, but broader instruction types still need explicit parsing rules before they can be relied on.
- Deterministic duplicate cleanup is currently heuristic-based and can be aggressive when a message is only a partial duplicate of a fuller one.
- Character grouping is improving, but remains mixed while the archive transitions from heuristic routing to explicit agent-applied hashtags.
- Structured character-profile extraction is now deterministic, but broader character assembly is still mixed: rich single-profile characters work better than characters assembled from many lore fragments.
- Character photo manifests still depend on model-generated vision output, and some figurine images remain visually under-described even with high-detail analysis and structured `visualDetails` support.
- Structured `visualDetails` are implemented in the pipeline, but current sample figurine images still often come back with `null` visual detail fields.
- Characters without strong structured text profiles can still end up under-detailed if their relevant source files have not yet been explicitly tagged.
- Deterministic post-generation preservation is intentionally narrow and may still need rule tuning when it misses an important named entity or restores too much low-value quoted text.
- The generated PDF is functional, but the renderer still needs additional layout tuning for long lore sections and image-heavy outputs.
- Page preview images are generated from the print HTML layout via Puppeteer viewport clipping, so they are intended as review proxies for the PDF pages rather than a byte-perfect PDF rasterization.
- Telegram disconnect can still end with a harmless timeout after work completes.

## TODO

- Make hashtag routing fully authoritative for lore generation and reduce the remaining heuristic fallback paths once the archive is tagged.
- Add a deterministic audit/report command for untagged source markdown so agent review can classify newly arrived files quickly.
- Make character assembly more deterministic so aliases, image posts, and profile posts resolve to the same entity without relying mainly on prompt interpretation.
- Finish tightening split generation so compact general context plus per-character file groups consistently produce rich character dossiers.
- Expand `#instructions` parsing beyond character order so section-order, emphasis, and omission rules can be applied deterministically.
- Refine deterministic post-generation preservation so must-keep names are restored with less manual allow/deny tuning and without reintroducing low-value quoted fragments.
- Improve character-image analysis so face, makeup, eyes, and outfit details are captured more reliably for figurine photos, especially when the current structured `visualDetails` response is empty.
- Enrich per-character manifests further with stronger deterministic fields and merge rules on top of the current structured visual metadata.
- Make the HTML/PDF renderer reflect the dossier structure more strongly with a table of contents, better section breaks, and cleaner long-form character layouts.
- Make deterministic duplicate cleanup less aggressive so it prefers keeping the best unique remainder instead of allowing an OCR block to collapse to empty.
- Add stronger distinction between lore-bearing repetition and legitimately separate but similar fragments.
- Use cleanup results during lore generation so already-pruned OCR text is always the canonical source.
- Refine the lore prompt based on the saved analysis report and test against the current channel corpus.
- Refine the HTML/PDF renderer based on the saved PDF analysis report, especially section hierarchy, page breaks, captions, and image placement.
- Strengthen deterministic post-processing of generated lore so character dossiers always use the canonical manifest image and stable subsection ordering even when the model output drifts.
- Improve page-image generation further if exact PDF raster fidelity becomes necessary for visual QA.
- Add end-to-end regression checks for:
  - text message update
  - OCR repost creation
  - cleanup sync back into Telegram
  - photo preservation in PDF

## Review Guidance

When analyzing a generated lore result:

- first compare the output against the already-tagged source markdown and `generated/source-routing.json`
- if a named entity, weakness, artifact, hall, relic, exhibit, or short title-card fact is missing, prefer checking deterministic routing / normalization / post-generation preservation before changing prompts
- after adjusting a deterministic rule, regenerate and verify both:
  - the missing source-grounded detail now appears
  - the rule did not overreach by restoring low-value fragments, duplicate names, or names into the wrong subsection
- only prefer prompt tuning first when the source detail is already present in the routed bundle and the remaining problem is primarily prose quality, density, or section balance
