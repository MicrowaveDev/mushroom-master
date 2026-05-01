#!/usr/bin/env bash
set -euo pipefail
id="$1"
latest=$(ls -t /Users/microwavedev/.codex/generated_images/*/*.png | head -1)
node .agent/tasks/artifact-simple-regeneration/chroma-key-artifact.mjs "$latest" "$id" "web/public/artifacts/${id}.png"
npm run game:artifacts:validate -- "$id"
