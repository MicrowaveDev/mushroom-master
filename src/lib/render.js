import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

function buildHtml(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3ecdc;
        --paper: #fffaf1;
        --ink: #2a2218;
        --muted: #6d5f4b;
        --accent: #7b4b2a;
        --border: rgba(70, 45, 18, 0.18);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 48px;
        background:
          radial-gradient(circle at top, rgba(145, 105, 66, 0.18), transparent 34%),
          linear-gradient(180deg, #efe4ce 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 920px;
        margin: 0 auto;
        background: var(--paper);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 56px;
        box-shadow: 0 20px 60px rgba(63, 42, 21, 0.12);
      }
      h1, h2, h3 { color: var(--accent); line-height: 1.15; }
      h1 {
        font-size: 2.8rem;
        margin-bottom: 0.8rem;
        border-bottom: 2px solid rgba(123, 75, 42, 0.15);
        padding-bottom: 0.4rem;
      }
      h2 { margin-top: 2rem; font-size: 1.5rem; }
      p, li { font-size: 1.05rem; line-height: 1.75; }
      blockquote {
        border-left: 4px solid rgba(123, 75, 42, 0.35);
        margin-left: 0;
        padding-left: 1rem;
        color: var(--muted);
      }
      img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 1.5rem 0;
        border-radius: 18px;
        box-shadow: 0 12px 30px rgba(63, 42, 21, 0.14);
      }
      code {
        background: rgba(123, 75, 42, 0.08);
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
      }
      @page {
        margin: 22mm 16mm;
      }
    </style>
  </head>
  <body>
    <main>${bodyHtml}</main>
  </body>
</html>`;
}

async function inlineLocalImages(html, outputDir) {
  const matches = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g));
  let result = html;

  for (const match of matches) {
    const source = match[1];
    if (/^(https?:|data:)/i.test(source)) {
      continue;
    }

    const imagePath = path.resolve(outputDir, source);
    const bytes = await fs.readFile(imagePath);
    const extension = path.extname(imagePath).toLowerCase();
    const mimeType =
      extension === '.png' ? 'image/png' :
      extension === '.webp' ? 'image/webp' :
      'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`;
    result = result.replace(source, dataUrl);
  }

  return result;
}

export async function renderMarkdownToHtmlAndPdf(markdown, title, outputDir) {
  const bodyHtml = await inlineLocalImages(marked.parse(markdown), outputDir);
  const html = buildHtml(title, bodyHtml);
  const htmlPath = path.join(outputDir, 'mushroom-lore.html');
  const pdfPath = path.join(outputDir, 'mushroom-lore.pdf');

  await fs.writeFile(htmlPath, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    });
  } finally {
    await browser.close();
  }

  return { htmlPath, pdfPath };
}
