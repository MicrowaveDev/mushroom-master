# Artifact Image Workspace

Local-only workspace for artifact image generation evidence.

- `raw/` stores full-size imagegen exports and other source images.
- `processed/` stores intermediate keyed/cropped candidates.
- `review/` stores local preview sheets and temporary visual checks.

These folders are ignored by git. The app-facing, optimized artifact bitmaps live separately in:

```text
web/public/artifacts/
```

Only commit `web/public/artifacts/*.png` after explicit production sign-off.

Default script outputs:

- `npm run game:artifacts:sheet` writes `review/contact-sheet.png` and `review/contact-sheet.manifest.json`.
- `.agent/tasks/artifact-simple-regeneration/process-latest.sh <artifact_id>` copies the newest imagegen export to `raw/<artifact_id>.source.png`, then writes the optimized app PNG.
- `.agent/tasks/artifact-imagegen-regeneration/split-imagegen-sheet.mjs` writes split raw sources into `raw/`.
- `.agent/tasks/artifact-simple-regeneration/make-contact-sheet.mjs` writes `review/simple-contact-sheet.png`.

Scripts use this workspace by default. Set `ARTIFACT_IMAGE_WORKSPACE=/absolute/path` only when you intentionally want a different local scratch location.
