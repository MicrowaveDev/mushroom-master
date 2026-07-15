#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { escapeHtml, imageFileDataUrl } from '@microwavedev/backpack-game-core/tooling/image';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const DEFAULT_BASE = path.join(repoRoot, 'web/public/marketing/character-key-art-base.png');
const DEFAULT_TEMP_OUT = path.join(repoRoot, 'tmp/social-preview.png');
const PRODUCTION_OUT = path.join(repoRoot, 'web/public/marketing/social-preview.jpg');
const WIDTH = 1200;
const HEIGHT = 630;
const DEFAULT_LAYOUT = 'middle-bottom';
const DEFAULT_STYLE = 'storybook';
const LAYOUTS = [
  'left',
  'center',
  'bottom-band',
  'bottom-crest',
  'middle-bottom',
  'top-band',
  'top-crest',
  'center-band'
];
const STYLES = [
  'classic',
  'esports',
  'engraved',
  'arcane',
  'telegram',
  'storybook'
];

function parseArgs(argv) {
  const args = {
    base: DEFAULT_BASE,
    out: DEFAULT_TEMP_OUT,
    title: 'Mushroom Battles',
    subtitle: 'Pack artifacts. Watch the fight.',
    layout: DEFAULT_LAYOUT,
    style: DEFAULT_STYLE,
    allLayouts: false,
    allStyles: false,
    production: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      i += 1;
      return value;
    };

    if (arg === '--production' || arg === '--write-production') {
      args.production = true;
      args.out = PRODUCTION_OUT;
    } else if (arg === '--all-layouts') {
      args.allLayouts = true;
    } else if (arg === '--all-styles') {
      args.allStyles = true;
    } else if (arg === '--base') {
      args.base = path.resolve(repoRoot, readValue());
    } else if (arg === '--out') {
      args.out = path.resolve(repoRoot, readValue());
    } else if (arg === '--title') {
      args.title = readValue();
    } else if (arg === '--subtitle') {
      args.subtitle = readValue();
    } else if (arg === '--layout') {
      args.layout = readValue();
    } else if (arg === '--style') {
      args.style = readValue();
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return `Generate Mushroom Battles social preview art.

Usage:
  node app/scripts/generation/generate-social-preview.js [options]

Options:
  --out PATH              Output PNG path. Default: tmp/social-preview.png
  --production            Write web/public/marketing/social-preview.jpg
  --base PATH             Base key art image. Default: web/public/marketing/character-key-art-base.png
  --title TEXT            Title text. Default: Mushroom Battles
  --subtitle TEXT         Small supporting line. Default: Pack artifacts. Watch the fight.
  --layout MODE           Title layout: ${LAYOUTS.join(', ')}. Default: ${DEFAULT_LAYOUT}
  --style MODE            Title style: ${STYLES.join(', ')}. Default: ${DEFAULT_STYLE}
  --all-layouts           Render all title layouts beside --out for review
  --all-styles            Render all title styles beside --out for review
`;
}

function imageDataUrl(filePath) {
  return imageFileDataUrl(filePath);
}

function buildHtml({ base, title, subtitle, layout, style }) {
  const baseUrl = imageDataUrl(base);
  const layoutClass = `layout-${layout}`;
  const styleClass = `style-${style}`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      margin: 0;
      overflow: hidden;
      background: #160f18;
    }
    .preview {
      position: relative;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      isolation: isolate;
      font-family: Georgia, "Times New Roman", serif;
      color: #fff8df;
    }
    .art {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center center;
      transform: scale(1.025);
    }
    .vignette {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 66% 43%, rgba(255, 236, 172, 0.12), transparent 27%),
        linear-gradient(90deg, rgba(13, 9, 14, 0.72) 0%, rgba(20, 13, 18, 0.38) 33%, rgba(20, 13, 18, 0.04) 64%, rgba(13, 9, 14, 0.22) 100%),
        linear-gradient(0deg, rgba(10, 7, 9, 0.36) 0%, transparent 28%, rgba(10, 7, 9, 0.12) 100%);
    }
    .band {
      position: absolute;
      display: none;
      pointer-events: none;
    }
    .spore-frame {
      position: absolute;
      inset: 28px;
      border: 2px solid rgba(244, 213, 138, 0.56);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.18),
        0 14px 40px rgba(0, 0, 0, 0.35);
      border-radius: 28px;
    }
    .title-block {
      position: absolute;
      left: 58px;
      bottom: 56px;
      width: 560px;
      display: grid;
      gap: 12px;
      filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.62));
    }
    .layout-center .title-block {
      left: 50%;
      bottom: 42px;
      width: 880px;
      justify-items: center;
      text-align: center;
      transform: translateX(-50%);
    }
    .layout-center .title {
      font-size: 92px;
      line-height: 0.9;
      white-space: nowrap;
    }
    .layout-center .subtitle {
      max-width: 720px;
      font-size: 27px;
    }
    .layout-bottom-band .band,
    .layout-top-band .band,
    .layout-center-band .band {
      display: block;
      left: 0;
      right: 0;
      height: 150px;
      background:
        linear-gradient(90deg, rgba(11, 8, 11, 0.28), rgba(12, 8, 10, 0.74) 24%, rgba(12, 8, 10, 0.82) 50%, rgba(12, 8, 10, 0.74) 76%, rgba(11, 8, 11, 0.28)),
        linear-gradient(0deg, rgba(255, 222, 145, 0.08), rgba(255, 255, 255, 0.02));
      border-top: 1px solid rgba(245, 218, 156, 0.22);
      border-bottom: 1px solid rgba(245, 218, 156, 0.22);
      box-shadow: 0 18px 38px rgba(0, 0, 0, 0.28);
    }
    .layout-bottom-band .band {
      bottom: 44px;
      height: 164px;
    }
    .layout-top-band .band { top: 52px; }
    .layout-center-band .band { top: 240px; }
    .layout-bottom-band .title-block,
    .layout-top-band .title-block,
    .layout-center-band .title-block {
      left: 50%;
      width: 860px;
      justify-items: center;
      text-align: center;
      transform: translateX(-50%);
    }
    .layout-bottom-band .title-block { bottom: 58px; }
    .layout-top-band .title-block { top: 62px; bottom: auto; }
    .layout-center-band .title-block { top: 252px; bottom: auto; }
    .layout-bottom-band .title,
    .layout-top-band .title,
    .layout-center-band .title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 74px;
      font-weight: 1000;
      line-height: 0.9;
      text-transform: uppercase;
      white-space: nowrap;
      color: #fffaf1;
      -webkit-text-stroke: 3px rgba(54, 31, 12, 0.86);
      text-shadow:
        0 5px 0 #9c5f22,
        0 12px 24px rgba(0, 0, 0, 0.72),
        0 0 28px rgba(255, 200, 80, 0.42);
    }
    .layout-bottom-band .eyebrow,
    .layout-top-band .eyebrow,
    .layout-center-band .eyebrow {
      order: 2;
      margin-top: -4px;
      background: transparent;
      border: 0;
      padding: 0;
      color: #f7dc9b;
      font-size: 22px;
      letter-spacing: 0.2em;
      text-shadow: 0 4px 10px rgba(0, 0, 0, 0.68);
    }
    .layout-bottom-band .subtitle,
    .layout-top-band .subtitle,
    .layout-center-band .subtitle {
      display: none;
    }
    .layout-top-crest .title-block {
      top: 34px;
      bottom: auto;
      left: 50%;
      width: 760px;
      justify-items: center;
      text-align: center;
      transform: translateX(-50%);
      gap: 7px;
    }
    .layout-top-crest .title {
      padding: 14px 32px 18px;
      border-radius: 22px;
      border: 2px solid rgba(250, 222, 153, 0.62);
      background:
        linear-gradient(180deg, rgba(68, 38, 17, 0.82), rgba(23, 14, 12, 0.72)),
        radial-gradient(circle at 50% 0%, rgba(255, 218, 117, 0.38), transparent 48%);
      font-size: 69px;
      line-height: 0.88;
      color: #fff4cd;
      white-space: nowrap;
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.18),
        0 18px 36px rgba(0, 0, 0, 0.42);
    }
    .layout-top-crest .subtitle {
      max-width: none;
      font-size: 22px;
      padding: 7px 16px;
      border-radius: 999px;
    }
    .layout-bottom-crest .title-block {
      left: 50%;
      bottom: 34px;
      width: 780px;
      justify-items: center;
      text-align: center;
      transform: translateX(-50%);
      gap: 7px;
    }
    .layout-bottom-crest .title {
      padding: 14px 34px 18px;
      border-radius: 22px;
      border: 2px solid rgba(250, 222, 153, 0.62);
      background:
        linear-gradient(180deg, rgba(68, 38, 17, 0.86), rgba(23, 14, 12, 0.76)),
        radial-gradient(circle at 50% 0%, rgba(255, 218, 117, 0.38), transparent 48%);
      font-size: 70px;
      line-height: 0.88;
      color: #fff4cd;
      white-space: nowrap;
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.18),
        0 18px 36px rgba(0, 0, 0, 0.48);
    }
    .layout-bottom-crest .subtitle {
      max-width: none;
      font-size: 22px;
      padding: 7px 16px;
      border-radius: 999px;
    }
    .layout-middle-bottom .title-block {
      left: 50%;
      bottom: 48px;
      width: 940px;
      justify-items: center;
      text-align: center;
      transform: translateX(-50%);
      gap: 10px;
    }
    .layout-middle-bottom .title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 82px;
      font-weight: 1000;
      line-height: 0.88;
      text-transform: uppercase;
      white-space: nowrap;
      color: #fffaf1;
      -webkit-text-stroke: 3px rgba(46, 25, 10, 0.9);
      text-shadow:
        0 5px 0 #9c5f22,
        0 14px 28px rgba(0, 0, 0, 0.82),
        0 0 30px rgba(255, 209, 92, 0.5);
    }
    .layout-middle-bottom .eyebrow {
      order: 2;
      margin-top: -2px;
      background: rgba(18, 12, 10, 0.56);
      color: #ffe29d;
      font-size: 22px;
      letter-spacing: 0.2em;
    }
    .layout-middle-bottom .subtitle {
      display: none;
    }
    .eyebrow {
      width: max-content;
      max-width: 100%;
      padding: 8px 14px 7px;
      border: 1px solid rgba(245, 218, 156, 0.66);
      border-radius: 999px;
      background: rgba(29, 20, 16, 0.62);
      color: #f7d989;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 23px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .title {
      margin: 0;
      font-size: 82px;
      line-height: 0.92;
      letter-spacing: 0;
      color: #fff6d7;
      text-wrap: balance;
      -webkit-text-stroke: 2px rgba(63, 35, 18, 0.72);
      text-shadow:
        0 3px 0 #8b552a,
        0 9px 20px rgba(0, 0, 0, 0.68),
        0 0 22px rgba(253, 213, 112, 0.32);
    }
    .subtitle {
      width: fit-content;
      max-width: 500px;
      margin: 0;
      padding: 10px 16px;
      border-radius: 16px;
      border: 1px solid rgba(250, 224, 172, 0.38);
      background: rgba(31, 23, 16, 0.72);
      color: #f4e6c7;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.12;
      letter-spacing: 0;
    }
    .style-esports .title {
      font-family: Impact, Haettenschweiler, "Arial Black", Arial, Helvetica, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      color: #ffffff;
      -webkit-text-stroke: 3px rgba(26, 13, 8, 0.95);
      text-shadow:
        0 6px 0 #c86d19,
        0 13px 0 rgba(70, 30, 8, 0.78),
        0 20px 32px rgba(0, 0, 0, 0.82);
    }
    .style-esports .eyebrow {
      font-family: Arial, Helvetica, sans-serif;
      background: #f5b335;
      border-color: rgba(43, 24, 8, 0.88);
      color: #23140a;
      letter-spacing: 0.18em;
      box-shadow: 0 5px 0 rgba(74, 38, 10, 0.72);
    }
    .style-engraved .title {
      font-family: Georgia, "Times New Roman", serif;
      color: #fff3c0;
      -webkit-text-stroke: 1px rgba(52, 27, 9, 0.88);
      text-shadow:
        0 2px 0 #6f4218,
        0 -1px 0 rgba(255, 255, 255, 0.58),
        0 7px 18px rgba(0, 0, 0, 0.78),
        0 0 28px rgba(238, 176, 66, 0.46);
    }
    .style-engraved .title::first-letter {
      font-size: 1.12em;
    }
    .style-engraved .eyebrow {
      color: #f8df98;
      border-color: rgba(248, 223, 152, 0.74);
      background: rgba(39, 24, 12, 0.72);
    }
    .style-arcane .title {
      font-family: "Trebuchet MS", Arial, Helvetica, sans-serif;
      text-transform: uppercase;
      color: #eafcff;
      -webkit-text-stroke: 2px rgba(21, 12, 42, 0.92);
      text-shadow:
        0 4px 0 rgba(72, 33, 120, 0.9),
        0 10px 20px rgba(0, 0, 0, 0.78),
        0 0 30px rgba(129, 76, 255, 0.72),
        0 0 52px rgba(82, 218, 206, 0.38);
    }
    .style-arcane .eyebrow {
      color: #dcfff4;
      border-color: rgba(136, 250, 226, 0.65);
      background: rgba(39, 25, 73, 0.72);
      box-shadow: 0 0 22px rgba(102, 230, 212, 0.34);
    }
    .style-telegram .title {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 1000;
      text-transform: none;
      color: #f7fbff;
      -webkit-text-stroke: 0;
      text-shadow:
        0 3px 0 rgba(44, 110, 170, 0.86),
        0 12px 28px rgba(0, 0, 0, 0.84);
    }
    .style-telegram .title-block {
      filter: drop-shadow(0 8px 26px rgba(0, 0, 0, 0.72));
    }
    .style-telegram .eyebrow {
      color: #e9f7ff;
      border-color: rgba(165, 217, 255, 0.68);
      background: rgba(27, 95, 148, 0.72);
    }
    .style-storybook .title {
      font-family: Georgia, "Times New Roman", serif;
      text-transform: none;
      color: #fff8dc;
      -webkit-text-stroke: 1px rgba(68, 38, 18, 0.72);
      text-shadow:
        0 3px 0 #8c5c2b,
        0 9px 20px rgba(0, 0, 0, 0.7),
        0 0 18px rgba(255, 236, 167, 0.42);
    }
    .style-storybook .eyebrow {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 24px;
      letter-spacing: 0.1em;
      color: #f3dca0;
      background: rgba(40, 27, 17, 0.72);
    }
    .layout-bottom-crest.style-esports .title,
    .layout-bottom-crest.style-arcane .title,
    .layout-bottom-crest.style-telegram .title {
      padding-top: 12px;
      padding-bottom: 16px;
    }
    .layout-bottom-crest.style-telegram .title {
      background:
        linear-gradient(180deg, rgba(43, 115, 170, 0.9), rgba(16, 36, 62, 0.82)),
        radial-gradient(circle at 50% 0%, rgba(173, 226, 255, 0.36), transparent 50%);
      border-color: rgba(190, 232, 255, 0.7);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.22),
        0 18px 36px rgba(0, 0, 0, 0.48);
    }
    .layout-bottom-band.style-telegram .band,
    .layout-middle-bottom.style-telegram .band {
      background:
        linear-gradient(90deg, rgba(14, 49, 82, 0.28), rgba(20, 88, 146, 0.76) 25%, rgba(18, 92, 154, 0.84) 50%, rgba(20, 88, 146, 0.76) 75%, rgba(14, 49, 82, 0.28)),
        linear-gradient(0deg, rgba(175, 224, 255, 0.12), rgba(255, 255, 255, 0.03));
    }
  </style>
</head>
<body>
  <main class="preview ${layoutClass} ${styleClass}">
    <img class="art" src="${baseUrl}" alt="" />
    <div class="vignette"></div>
    <div class="band"></div>
    <div class="spore-frame"></div>
    <section class="title-block" aria-label="${escapeHtml(title)}">
      <div class="eyebrow">Auto-Battler</div>
      <h1 class="title">${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
    </section>
  </main>
</body>
</html>`;
}

export async function renderPreview(args) {
  if (!LAYOUTS.includes(args.layout)) {
    throw new Error(`Invalid --layout "${args.layout}". Use one of: ${LAYOUTS.join(', ')}.`);
  }
  if (!STYLES.includes(args.style)) {
    throw new Error(`Invalid --style "${args.style}". Use one of: ${STYLES.join(', ')}.`);
  }
  if (!fs.existsSync(args.base)) {
    throw new Error(`Base image not found: ${path.relative(repoRoot, args.base)}`);
  }
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(buildHtml(args), { waitUntil: 'networkidle0' });
    const ext = path.extname(args.out).toLowerCase();
    const type = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png';
    await page.screenshot({
      path: args.out,
      type,
      quality: type === 'jpeg' ? 85 : undefined
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args.allLayouts) {
    if (args.production) {
      throw new Error('--all-layouts cannot be combined with --production');
    }
    if (args.allStyles) {
      throw new Error('--all-layouts cannot be combined with --all-styles');
    }
    const ext = path.extname(args.out) || '.png';
    const stem = path.join(path.dirname(args.out), path.basename(args.out, ext));
    for (const layout of LAYOUTS) {
      const out = `${stem}-${layout}${ext}`;
      await renderPreview({ ...args, layout, out });
      console.log(`generated review social preview: ${path.relative(repoRoot, out)}`);
    }
  } else if (args.allStyles) {
    if (args.production) {
      throw new Error('--all-styles cannot be combined with --production');
    }
    const ext = path.extname(args.out) || '.png';
    const stem = path.join(path.dirname(args.out), path.basename(args.out, ext));
    for (const style of STYLES) {
      const out = `${stem}-${args.layout}-${style}${ext}`;
      await renderPreview({ ...args, style, out });
      console.log(`generated review social preview: ${path.relative(repoRoot, out)}`);
    }
  } else {
    await renderPreview(args);
    const label = args.production ? 'production social preview' : 'temporary social preview';
    console.log(`generated ${label}: ${path.relative(repoRoot, args.out)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
