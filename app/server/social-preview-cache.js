import fs from 'fs';
import path from 'path';
import { createSocialPreviewCacheService } from '@microwavedev/backpack-game-core/modules/social-preview';
import { renderPreview } from '../scripts/generate-social-preview.js';
import { log } from './lib/obs.js';
import { repoRoot } from '../shared/repo-root.js';

const webDist = path.join(repoRoot, 'web/dist');
const webPublic = path.join(repoRoot, 'web/public');
const baseImage = path.join(webPublic, 'marketing/character-key-art-base.png');
const publicPreview = path.join(webPublic, 'marketing/social-preview.jpg');
const cachedPreview = path.join(webDist, 'marketing/social-preview.jpg');

const socialPreviewCacheService = createSocialPreviewCacheService({
  renderPreview,
  outputPath: cachedPreview,
  renderOptions: {
    base: baseImage,
    out: cachedPreview,
    title: 'Mushroom Battles',
    subtitle: 'Pack artifacts. Watch the fight.',
    layout: 'middle-bottom',
    style: 'storybook'
  },
  ensureOutputDirectory({ outputPath }) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  },
  copyFallback() {
    if (fs.existsSync(publicPreview) && !fs.existsSync(cachedPreview)) {
      fs.copyFileSync(publicPreview, cachedPreview);
    }
    return fs.existsSync(cachedPreview);
  },
  logger: log,
  relativePath(targetPath) {
    return path.relative(repoRoot, targetPath);
  }
});

export async function ensureSocialPreviewCache() {
  return socialPreviewCacheService.ensureSocialPreviewCache();
}
