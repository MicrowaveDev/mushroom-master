#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runSocialPreview, renderSocialPreview } from '@microwavedev/backpack-game-core/tooling/social-preview';
import puppeteer from 'puppeteer';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const launchBrowser = () => puppeteer.launch({ headless: 'new' });
export const renderPreview = (args) => renderSocialPreview({ ...args, style: args.style === 'telegram' ? 'sky' : args.style, launchBrowser });
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSocialPreview(process.argv.slice(2), {
    repoRoot, launchBrowser,
    base: path.join(repoRoot, 'web/public/marketing/character-key-art-base.png'),
    out: path.join(repoRoot, 'tmp/social-preview.png'),
    productionOut: path.join(repoRoot, 'web/public/marketing/social-preview.jpg'),
    title: 'Mushroom Battles', subtitle: 'Pack artifacts. Watch the fight.',
    styleAliases: { telegram: 'sky' }
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
