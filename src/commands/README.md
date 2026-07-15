# Lore Command Routing

This directory contains Mushroom's product-specific Telegram and lore pipeline
entry points. Run commands from the repository root through npm aliases. Do not
invoke files here directly and do not move these commands to Backpack Game Core:
they depend on Mushroom lore formats, Telegram messages, OCR reposts, dossier
rendering, bot delivery, and product environment variables.

## Directory Routing

| Directory | Responsibility | Commands |
| --- | --- | --- |
| `workflows/` | End-to-end Telegram fetch and lore regeneration | `fetch`, `regenerate` |
| `analysis/` | Read-only prompt, PDF structure, and routing reports | `analyze:lore-prompt`, `analyze:pdf-structure`, `audit:untagged` |
| `maintenance/` | Telegram message, hashtag, OCR repost, and duplicate repair operations | `update-text-message`, `set-message-hashtags`, `set-ocr-hashtags`, `clear-message-hashtags`, `backfill-posted-message-ids`, `rebuild-ocr-reposts`, `clean-text-duplicates` |
| `diagnostics/` | Narrow live Telegram inspection | `debug:history`, `debug:message` |

Reusable implementation belongs in `src/lib/`. Environment parsing belongs in
`src/config/`. The `src/` root must contain directories only; do not add command
files back to it.

## Supported Invocation

```bash
npm run fetch
npm run regenerate -- --force --skip-download
npm run analyze:lore-prompt
npm run analyze:pdf-structure
npm run audit:untagged
```

Mutation commands accept their arguments after `--`:

```bash
npm run set-message-hashtags -- --id <messageId> --hashtags "#general_lore #character_thalla"
npm run set-ocr-hashtags -- --ids <id,id> --hashtags "#general_lore"
npm run clear-message-hashtags -- --ids <id,id>
npm run update-text-message -- --id <messageId> --text <newText>
```

Diagnostics access the live Telegram source and require the normal lore
environment:

```bash
npm run debug:history -- <limit>
npm run debug:message -- <messageId>
```

The command-family list remains machine-readable in
`app/scripts/command-manifest.json`, and `npm run scripts:docs:check` validates
that every package alias is classified and documented.

## Core Boundary

Core may own neutral filesystem, image, evidence, queue, and process helpers.
This directory owns final argument parsing, credentials, source selection,
mutation policy, output paths, user-facing logs, and exit behavior for the lore
product. See `vendor/backpack-game-core/docs/tooling-routing.md` before proposing
a new shared tooling command.
