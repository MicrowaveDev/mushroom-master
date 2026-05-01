#!/usr/bin/env bash
set -euo pipefail
id="$1"
latest=$(ls -t /Users/microwavedev/.codex/generated_images/*/*.png | head -1)
workspace="${ARTIFACT_IMAGE_WORKSPACE:-.agent/artifact-image-workspace}"
raw_dir="${workspace}/raw"
mkdir -p "$raw_dir"
raw_path="${raw_dir}/${id}.source.png"
cp "$latest" "$raw_path"
node .agent/tasks/artifact-simple-regeneration/chroma-key-artifact.mjs "$raw_path" "$id" "web/public/artifacts/${id}.png"
npm run game:artifacts:validate -- "$id"
