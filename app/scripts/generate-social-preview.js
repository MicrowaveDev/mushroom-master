#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const DEFAULT_BASE = path.join(repoRoot, 'web/public/marketing/character-key-art-base.png');
const DEFAULT_TEMP_OUT = path.join(repoRoot, 'tmp/social-preview.png');
const PRODUCTION_OUT = path.join(repoRoot, 'web/public/marketing/social-preview.png');
const WIDTH = 1200;
const HEIGHT = 630;
const LAYOUTS = ['left', 'center', 'top-band', 'top-crest', 'center-band'];

function parseArgs(argv) {
  const args = {
    base: DEFAULT_BASE,
    out: DEFAULT_TEMP_OUT,
    title: 'Mushroom Battles',
    subtitle: 'Pack artifacts. Watch the fight.',
    layout: 'left',
    allLayouts: false,
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
  node app/scripts/generate-social-preview.js [options]

Options:
  --out PATH              Output PNG path. Default: tmp/social-preview.png
  --production            Write web/public/marketing/social-preview.png
  --base PATH             Base key art image. Default: web/public/marketing/character-key-art-base.png
  --title TEXT            Title text. Default: Mushroom Battles
  --subtitle TEXT         Small supporting line. Default: Pack artifacts. Watch the fight.
  --layout MODE           Title layout: ${LAYOUTS.join(', ')}. Default: left
  --all-layouts           Render all title layouts beside --out for review
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function imageDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function buildHtml({ base, title, subtitle, layout }) {
  const baseUrl = imageDataUrl(base);
  const layoutClass = `layout-${layout}`;
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
    .layout-top-band .band { top: 52px; }
    .layout-center-band .band { top: 240px; }
    .layout-top-band .title-block,
    .layout-center-band .title-block {
      left: 50%;
      width: 860px;
      justify-items: center;
      text-align: center;
      transform: translateX(-50%);
    }
    .layout-top-band .title-block { top: 62px; bottom: auto; }
    .layout-center-band .title-block { top: 252px; bottom: auto; }
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
  </style>
</head>
<body>
  <main class="preview ${layoutClass}">
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

async function renderPreview(args) {
  if (!LAYOUTS.includes(args.layout)) {
    throw new Error(`Invalid --layout "${args.layout}". Use one of: ${LAYOUTS.join(', ')}.`);
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
    await page.screenshot({ path: args.out, type: 'png' });
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
    const ext = path.extname(args.out) || '.png';
    const stem = path.join(path.dirname(args.out), path.basename(args.out, ext));
    for (const layout of LAYOUTS) {
      const out = `${stem}-${layout}${ext}`;
      await renderPreview({ ...args, layout, out });
      console.log(`generated review social preview: ${path.relative(repoRoot, out)}`);
    }
  } else {
    await renderPreview(args);
    const label = args.production ? 'production social preview' : 'temporary social preview';
    console.log(`generated ${label}: ${path.relative(repoRoot, args.out)}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
