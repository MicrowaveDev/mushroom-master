import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const A4_VIEWPORT = {
  width: 794,
  height: 1123
};

function applyCharacterIntroLayout(bodyHtml) {
  const charactersHeading = '<h2>Персонажи</h2>';
  const start = bodyHtml.indexOf(charactersHeading);
  if (start === -1) {
    return bodyHtml;
  }

  const before = bodyHtml.slice(0, start + charactersHeading.length);
  const after = bodyHtml.slice(start + charactersHeading.length);
  const transformed = after.replace(
    /<h3>([^<]+)<\/h3>\s*<p>(<img[^>]+>)<\/p>\s*(?:<h4>Обзор<\/h4>\s*(<p>[\s\S]*?<\/p>))?/g,
    (_match, name, imageTag, overviewParagraph = '') => {
      const overviewBlock = overviewParagraph
        ? `<h4>Обзор</h4>${overviewParagraph}`
        : '';

      return [
        '<section class="character-intro">',
        `  <div class="character-intro-media">${imageTag}</div>`,
        '  <div class="character-intro-copy">',
        `    <h3>${name}</h3>`,
        `    ${overviewBlock}`,
        '  </div>',
        '</section>'
      ].join('');
    }
  );

  const wrapped = transformed
    .split(/<hr>/)
    .map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) {
        return chunk;
      }
      if (!trimmed.includes('class="character-intro"')) {
        return chunk;
      }
      return `<section class="character-dossier">${trimmed}</section>`;
    })
    .join('<hr>');

  return `${before}${wrapped}`;
}

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
        padding: 18px;
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
        padding: 34px 38px;
        box-shadow: 0 20px 60px rgba(63, 42, 21, 0.12);
      }
      h1, h2, h3, h4 { color: var(--accent); line-height: 1.15; }
      h1 {
        font-size: 2.8rem;
        margin-bottom: 0.8rem;
        border-bottom: 2px solid rgba(123, 75, 42, 0.15);
        padding-bottom: 0.4rem;
      }
      h2 {
        margin-top: 2.8rem;
        font-size: 1.7rem;
        padding-top: 0.6rem;
        border-top: 1px solid rgba(123, 75, 42, 0.18);
        page-break-before: auto;
      }
      h3 { margin-top: 1.8rem; font-size: 1.28rem; }
      h4 {
        margin-top: 1.2rem;
        font-size: 1rem;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      p, li { font-size: 1.05rem; line-height: 1.75; }
      hr {
        border: 0;
        border-top: 1px solid rgba(123, 75, 42, 0.14);
        margin: 2rem 0;
      }
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
      .character-intro {
        display: block;
        margin: 1.4rem 0 1.8rem;
      }
      .character-dossier {
        padding: 0.4rem 0 0.8rem;
      }
      .character-dossier .character-intro {
        margin-top: 0;
      }
      .character-intro.is-portrait {
        display: flex;
        align-items: flex-start;
        gap: 1.4rem;
      }
      .character-intro-media {
        max-width: 100%;
      }
      .character-intro-media img {
        width: 100%;
        margin: 0 0 1rem;
      }
      .character-intro.is-portrait .character-intro-media {
        flex: 0 0 28%;
        max-width: 28%;
      }
      .character-intro.is-portrait .character-intro-media img {
        margin: 0;
      }
      .character-intro-copy {
        min-width: 0;
      }
      .character-intro-copy h3 {
        margin-top: 0.2rem;
        margin-bottom: 0.8rem;
      }
      .character-intro-copy h4 {
        margin-top: 0;
        margin-bottom: 0.45rem;
      }
      .character-intro-copy p {
        margin-top: 0;
      }
      code {
        background: rgba(123, 75, 42, 0.08);
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
      }
      @media (max-width: 760px) {
        .character-intro {
          display: block;
        }
        .character-dossier {
          padding-top: 0.2rem;
        }
        .character-intro-media {
          max-width: 100%;
        }
        .character-intro-media img {
          max-width: 360px;
          margin-bottom: 1rem;
        }
      }
      @page {
        margin: 10mm 10mm;
      }
      @media print {
        body {
          padding: 0;
        }
        main {
          border-radius: 16px;
          box-shadow: none;
        }
        h2 {
          page-break-after: avoid;
          break-after: avoid-page;
        }
        h3, h4 {
          page-break-after: avoid;
          break-after: avoid-page;
        }
        h2 + h3,
        h3 + img,
        h3 + p,
        h3 + img + h4,
        h3 + h4 {
          page-break-before: avoid;
          break-before: avoid-page;
        }
        img {
          page-break-inside: avoid;
          break-inside: avoid;
          page-break-before: avoid;
          break-before: avoid-page;
          max-height: 42vh;
          object-fit: contain;
        }
        .character-intro {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .character-dossier {
          break-inside: auto;
          page-break-inside: auto;
        }
        .character-intro.is-portrait {
          display: flex;
          align-items: flex-start;
        }
        .character-intro.is-portrait .character-intro-media {
          flex-basis: 28%;
          max-width: 28%;
        }
        .character-intro.is-portrait .character-intro-media img {
          max-height: 32vh;
        }
        .character-intro.is-landscape .character-intro-media img,
        .character-intro:not(.is-portrait) .character-intro-media img {
          max-height: 30vh;
          width: auto;
          max-width: 100%;
        }
        p, li {
          orphans: 3;
          widows: 3;
        }
      }
    </style>
  </head>
  <body>
    <main>${bodyHtml}</main>
    <script>
      for (const intro of document.querySelectorAll('.character-intro')) {
        const img = intro.querySelector('.character-intro-media img');
        if (!img) continue;
        const apply = () => {
          const portrait = img.naturalHeight > img.naturalWidth;
          intro.classList.toggle('is-portrait', portrait);
          intro.classList.toggle('is-landscape', !portrait);
        };
        if (img.complete) {
          apply();
        } else {
          img.addEventListener('load', apply, { once: true });
        }
      }
    </script>
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
      extension === '.svg' ? 'image/svg+xml' :
      extension === '.png' ? 'image/png' :
      extension === '.webp' ? 'image/webp' :
      'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${bytes.toString('base64')}`;
    result = result.replace(source, dataUrl);
  }

  return result;
}

async function renderPageImages(page, outputDir) {
  const pageImagesDir = path.join(outputDir, 'page-images');
  await fs.rm(pageImagesDir, { recursive: true, force: true });
  await fs.mkdir(pageImagesDir, { recursive: true });

  await page.setViewport(A4_VIEWPORT);
  await page.emulateMediaType('print');

  const metrics = await page.evaluate(() => ({
    scrollWidth: Math.ceil(document.documentElement.scrollWidth),
    scrollHeight: Math.ceil(document.documentElement.scrollHeight)
  }));

  const pageCount = Math.max(1, Math.ceil(metrics.scrollHeight / A4_VIEWPORT.height));
  const images = [];

  for (let index = 0; index < pageCount; index += 1) {
    const clipHeight = Math.min(
      A4_VIEWPORT.height,
      Math.max(1, metrics.scrollHeight - (index * A4_VIEWPORT.height))
    );
    const fileName = `page-${String(index + 1).padStart(2, '0')}.png`;
    const filePath = path.join(pageImagesDir, fileName);
    await page.screenshot({
      path: filePath,
      clip: {
        x: 0,
        y: index * A4_VIEWPORT.height,
        width: Math.min(A4_VIEWPORT.width, metrics.scrollWidth),
        height: clipHeight
      }
    });
    images.push({
      pageNumber: index + 1,
      fileName,
      path: filePath
    });
  }

  const manifestPath = path.join(pageImagesDir, 'manifest.json');
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify({
      width: A4_VIEWPORT.width,
      height: A4_VIEWPORT.height,
      pageCount,
      pages: images.map((image) => ({
        pageNumber: image.pageNumber,
        fileName: image.fileName
      }))
    }, null, 2)}\n`,
    'utf8'
  );

  return { pageImagesDir, manifestPath, images };
}

export async function renderMarkdownToHtmlAndPdf(markdown, title, outputDir) {
  const bodyHtml = applyCharacterIntroLayout(
    await inlineLocalImages(marked.parse(markdown), outputDir)
  );
  const html = buildHtml(title, bodyHtml);
  const htmlPath = path.join(outputDir, 'mushroom-lore.html');
  const pdfPath = path.join(outputDir, 'mushroom-lore.pdf');

  await fs.writeFile(htmlPath, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pageImageResult = await renderPageImages(page, outputDir);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    });
    return { htmlPath, pdfPath, ...pageImageResult };
  } finally {
    await browser.close();
  }
}
