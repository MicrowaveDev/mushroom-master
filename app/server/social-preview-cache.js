import fs from 'fs';
import path from 'path';
import { renderPreview } from '../scripts/generate-social-preview.js';
import { log } from './lib/obs.js';
import { repoRoot } from '../shared/repo-root.js';

const webDist = path.join(repoRoot, 'web/dist');
const webPublic = path.join(repoRoot, 'web/public');
const baseImage = path.join(webPublic, 'marketing/character-key-art-base.png');
const publicPreview = path.join(webPublic, 'marketing/social-preview.jpg');
const cachedPreview = path.join(webDist, 'marketing/social-preview.jpg');

export async function ensureSocialPreviewCache() {
  fs.mkdirSync(path.dirname(cachedPreview), { recursive: true });

  try {
    await renderPreview({
      base: baseImage,
      out: cachedPreview,
      title: 'Mushroom Battles',
      subtitle: 'Pack artifacts. Watch the fight.',
      layout: 'middle-bottom',
      style: 'storybook'
    });
    log.info({
      kind: 'social_preview_cache',
      outcome: 'generated',
      path: path.relative(repoRoot, cachedPreview)
    });
  } catch (error) {
    if (fs.existsSync(publicPreview) && !fs.existsSync(cachedPreview)) {
      fs.copyFileSync(publicPreview, cachedPreview);
    }
    log.warn({
      kind: 'social_preview_cache',
      outcome: 'fallback',
      path: path.relative(repoRoot, cachedPreview),
      message: error.message
    });
  }
}
