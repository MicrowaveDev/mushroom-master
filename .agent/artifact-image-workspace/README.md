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

Scripts use this workspace by default. Set `ARTIFACT_IMAGE_WORKSPACE=/absolute/path` only when you intentionally want a different local scratch location.
