#!/usr/bin/env bash
set -euo pipefail
id="$1"
latest=$(
  find /Users/microwavedev/.codex/generated_images -name '*.png' -type f -exec stat -f '%m %N' {} + \
    | sort -nr \
    | sed -n '1s/^[0-9][0-9]* //p'
)
if [[ -z "$latest" ]]; then
  echo "No generated image found under /Users/microwavedev/.codex/generated_images" >&2
  exit 1
fi
workspace="${ARTIFACT_IMAGE_WORKSPACE:-.agent/artifact-image-workspace}"
raw_dir="${workspace}/raw"
mkdir -p "$raw_dir"
raw_path="${raw_dir}/${id}.source.png"
cp "$latest" "$raw_path"
node .agent/tasks/artifact-simple-regeneration/chroma-key-artifact.mjs "$raw_path" "$id" "web/public/artifacts/${id}.png"
npm run game:artifacts:normalize-detail -- "$id"
npm run game:artifacts:validate -- "$id"
