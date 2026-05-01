# Phase 1 Evidence — Thumbnail QA

Status: PASS

## AC1.1

PASS. Added `npm run game:artifacts:thumbnail-review`, which generates a full-catalog thumbnail review PNG with transparent, real grid-cell, grayscale, and label/warning columns. Local output:

```text
.agent/tasks/artifact-image-system/phase-1/raw/thumbnail-review.png
```

## AC1.2

PASS. The sheet includes a grayscale column for every artifact at `32px`, `48px`, and `64px`.

## AC1.3

PASS. Two consecutive runs produced the same MD5:

```text
98a6ce35d3386f1ba1961a29612272d4
```

The script normalizes the Puppeteer screenshot through a deterministic PNG encoder before writing.

## AC1.4

PASS. No production artifact PNGs were modified by the script. The generated thumbnail review sheet is local evidence only while the image set is not production-approved.

## Commands Run

```bash
npm run game:artifacts:thumbnail-review
md5 .agent/tasks/artifact-image-system/phase-1/raw/thumbnail-review.png && npm run game:artifacts:thumbnail-review && md5 .agent/tasks/artifact-image-system/phase-1/raw/thumbnail-review.png
npm run game:artifacts:validate -- --all
npm run game:artifacts:sheet
node --test tests/web/artifact-render.test.js
```
