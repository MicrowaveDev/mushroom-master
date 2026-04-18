# Mushroom Master Repository Instructions

- This repo is a Telegram archive and lore-generation pipeline. Follow `AGENTS.md` in the repo root for the full review and routing workflow.
- Prefer deterministic fixes before prompt changes: hashtag routing, source markdown normalization, OCR cleanup, and renderer/layout fixes should come before changing lore prompts.
- Use source tags as the authoritative routing signal. Prefer explicit hashtags over heuristic character matching.
- Apply hashtag changes with the local scripts, not just prose. Common commands are `npm run set-message-hashtags -- --id <messageId> --hashtags "#general_lore #character_key"` and `npm run set-ocr-hashtags`.
- For generated-output review, prioritize `data/<channel>/generated/page-images/`, `data/<channel>/generated/page-images/manifest.json`, `data/<channel>/generated/mushroom-lore.md`, and `data/<channel>/characters/*/manifest.json`.
- Use `npm run analyze:pdf-structure` as the default verification command when changes affect generated lore or PDF structure.
