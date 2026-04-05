import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import {
  extractSection,
  normalizeStructuredSectionBody,
  splitFourthLevelSections,
  splitParagraphs,
  splitThirdLevelSections,
  stripMarkdownImages
} from './markdown-parser.js';

const A4_VIEWPORT = {
  width: 794,
  height: 1123
};

const CHARACTER_SECTION_ORDER = [
  'Обзор',
  'Внешность',
  'Особенности',
  'Обитель и владения',
  'Мотивы и роль',
  'Связи и сюжетные линии'
];

const RENDER_TEMPLATES = {
  classic: {
    id: 'classic',
    filePrefix: 'mushroom-lore',
    pageImagesDirName: 'page-images'
  },
  'mushrooms-docs': {
    id: 'mushrooms-docs',
    filePrefix: 'mushrooms-docs',
    pageImagesDirName: 'page-images-mushrooms-docs'
  }
};

export function normalizeRenderTemplate(template) {
  const normalized = String(template || '').trim().toLowerCase();
  return RENDER_TEMPLATES[normalized] ? normalized : 'classic';
}

function getRenderTemplate(template) {
  return RENDER_TEMPLATES[normalizeRenderTemplate(template)];
}

function toDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim()
  )}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyCharacterIntroLayout(bodyHtml) {
  const charactersHeading = '<h2>Персонажи</h2>';
  const start = bodyHtml.indexOf(charactersHeading);
  if (start === -1) {
    return bodyHtml;
  }

  const before = bodyHtml.slice(0, start + charactersHeading.length);
  const after = bodyHtml.slice(start + charactersHeading.length);
  const transformed = after.replace(
    /<h3>([^<]+)<\/h3>\s*((?:<p><img[^>]+><\/p>)|(?:<div class="character-intro-gallery">[\s\S]*?<\/div>))\s*(?:<h4>Обзор<\/h4>\s*(<p>[\s\S]*?<\/p>))?/g,
    (_match, name, mediaBlock, overviewParagraph = '') => {
      const overviewBlock = overviewParagraph || '';

      return [
        '<section class="character-intro">',
        `  <div class="character-intro-media">${mediaBlock}</div>`,
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

  const cleaned = wrapped.replace(
    /(<section class="character-intro">[\s\S]*?<div class="character-intro-copy">[\s\S]*?)<h4>Обзор<\/h4>\s*/g,
    '$1'
  );

  return `${before}${cleaned}`;
}

function extractLeadingMediaBlocks(markdown) {
  let remaining = String(markdown || '').trim();
  const blocks = [];

  while (remaining) {
    const markdownImageMatch = remaining.match(/^!\[[^\]]*\]\([^)]+\)\s*/);
    if (markdownImageMatch) {
      blocks.push(markdownImageMatch[0].trim());
      remaining = remaining.slice(markdownImageMatch[0].length).trimStart();
      continue;
    }

    const galleryMatch = remaining.match(/^<div class="character-intro-gallery">[\s\S]*?<\/div>\s*/);
    if (galleryMatch) {
      blocks.push(galleryMatch[0].trim());
      remaining = remaining.slice(galleryMatch[0].length).trimStart();
      continue;
    }

    break;
  }

  return { blocks, remaining };
}

function movePrefaceIntoOverview(preface, sections) {
  const normalizedPreface = normalizeStructuredSectionBody(preface);
  if (!normalizedPreface) {
    return sections;
  }

  const overviewIndex = sections.findIndex((section) => section.title === 'Обзор');
  if (overviewIndex === -1) {
    return [
      {
        title: 'Обзор',
        body: normalizedPreface
      },
      ...sections
    ];
  }

  const nextSections = [...sections];
  nextSections[overviewIndex] = {
    ...nextSections[overviewIndex],
    body: [normalizedPreface, nextSections[overviewIndex].body].filter(Boolean).join('\n\n').trim()
  };
  return nextSections;
}

function orderCharacterSections(sections) {
  const known = [];
  const unknown = [];

  for (const title of CHARACTER_SECTION_ORDER) {
    const match = sections.find((section) => section.title === title);
    if (match?.body) {
      known.push(match);
    }
  }

  for (const section of sections) {
    if (!section?.body) {
      continue;
    }
    if (!CHARACTER_SECTION_ORDER.includes(section.title)) {
      unknown.push(section);
    }
  }

  return [...known, ...unknown];
}

function markdownToInlineHtml(markdown) {
  return marked.parseInline(String(markdown || '').trim());
}

function markdownToBlockHtml(markdown) {
  return marked.parse(String(markdown || '').trim());
}

function normalizeSummarySentence(text, maxLength = 220) {
  const clean = String(text || '')
    .replace(/[*_`#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) {
    return '';
  }
  if (clean.length <= maxLength) {
    return clean;
  }
  const sentenceMatch = clean.match(/^(.{1,220}?[.!?])(?:\s|$)/);
  if (sentenceMatch) {
    return sentenceMatch[1].trim();
  }
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function deriveCharacterSummary(overviewBody) {
  const paragraphs = splitParagraphs(normalizeStructuredSectionBody(overviewBody));
  const nonListParagraphs = paragraphs.filter((paragraph) => !/^\s*-\s+/m.test(paragraph));
  const styleParagraph = paragraphs.find((paragraph) => /^(Тема|Стиль)\s*:/im.test(paragraph));
  const conceptParagraph = nonListParagraphs[0] || paragraphs[0] || '';
  const items = [];

  if (conceptParagraph) {
    items.push({
      label: 'Концепция',
      value: normalizeSummarySentence(conceptParagraph)
    });
  }

  if (styleParagraph) {
    items.push({
      label: /^(Стиль)\s*:/im.test(styleParagraph) ? 'Стиль' : 'Тема',
      value: styleParagraph.replace(/^(Тема|Стиль)\s*:/im, '').trim()
    });
  }

  return items.filter((item) => item.value);
}

function parseLoreDocument(markdown, title) {
  const generalLoreMarkdown = extractSection(markdown, 'Общий лор');
  const generalLoreSections = splitThirdLevelSections(generalLoreMarkdown).map((section) => {
    const lines = section.content.split('\n');
    lines.shift();
    const body = lines.join('\n').trim();
    return {
      title: section.title,
      body,
      bodyHtml: markdownToBlockHtml(body)
    };
  });

  const charactersMarkdown = extractSection(markdown, 'Персонажи');
  const characters = splitThirdLevelSections(charactersMarkdown).map((section) => {
    const lines = section.content.split('\n');
    lines.shift();
    const rawBody = lines.join('\n').trim();
    const { blocks: mediaBlocks, remaining } = extractLeadingMediaBlocks(rawBody);
    const bodyWithoutImages = stripMarkdownImages(remaining);
    const { preface, sections: fourthLevelSections } = splitFourthLevelSections(bodyWithoutImages);
    const normalizedSections = movePrefaceIntoOverview(
      preface,
      fourthLevelSections
        .map((entry) => ({
          title: entry.title,
          body: normalizeStructuredSectionBody(entry.body)
        }))
        .filter((entry) => entry.body)
    );
    const orderedSections = orderCharacterSections(normalizedSections).map((entry) => ({
      ...entry,
      bodyHtml: markdownToBlockHtml(entry.body)
    }));
    const overviewSection = orderedSections.find((entry) => entry.title === 'Обзор');

    return {
      title: section.title,
      mediaHtml: mediaBlocks
        .map((block) => (block.startsWith('<div') ? block : markdownToBlockHtml(block)))
        .join('\n'),
      summaryItems: deriveCharacterSummary(overviewSection?.body || ''),
      sections: orderedSections
    };
  });

  return {
    title,
    generalLoreSections,
    characters
  };
}

function buildClassicHtml(title, bodyHtml, ornaments) {
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
        --ornament-top-right: url("${ornaments.topRight}");
        --ornament-bottom-left: url("${ornaments.bottomLeft}");
        --ornament-right-spray: url("${ornaments.rightSpray}");
        --ornament-watermark: url("${ornaments.watermark}");
      }
      * { box-sizing: border-box; }
      body {
        position: relative;
        margin: 0;
        padding: 18px;
        background:
          radial-gradient(circle at top, rgba(145, 105, 66, 0.18), transparent 34%),
          linear-gradient(180deg, #efe4ce 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
      }
      .page-ornament {
        position: fixed;
        pointer-events: none;
        z-index: 2;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        opacity: var(--ornament-opacity, 0.12);
        filter: saturate(0.82) sepia(0.08);
      }
      .page-ornament.top-right {
        top: 18px;
        right: -42px;
        width: 118px;
        height: 118px;
        --ornament-opacity: 0.18;
        background-image: var(--ornament-top-right);
      }
      .page-ornament.bottom-left {
        left: -58px;
        bottom: -8px;
        width: 210px;
        height: 160px;
        --ornament-opacity: 0.11;
        background-image: var(--ornament-bottom-left);
      }
      .page-ornament.right-spray {
        display: none;
        background-image: var(--ornament-right-spray);
        transform: rotate(-7deg);
      }
      .page-ornament.watermark {
        display: none;
        background-image: var(--ornament-watermark);
      }
      .page-ornament.watermark-late {
        display: none;
        background-image: var(--ornament-watermark);
      }
      main {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        max-width: 920px;
        z-index: 1;
        margin: 0 auto;
        background: var(--paper);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 34px 38px;
        box-shadow: 0 20px 60px rgba(63, 42, 21, 0.12);
      }
      main > * {
        position: relative;
        z-index: 1;
      }
      h1, h2, h3, h4 { color: var(--accent); line-height: 1.15; }
      h1 {
        font-size: 2.8rem;
        margin-bottom: 0.8rem;
        border-bottom: 2px solid rgba(123, 75, 42, 0.15);
        padding-bottom: 0.4rem;
      }
      h2 {
        position: relative;
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
        background: transparent;
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
        background: transparent;
      }
      .character-intro-media img {
        width: 100%;
        margin: 0 0 1rem;
      }
      .character-intro-gallery {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        gap: 0.8rem;
        width: 100%;
      }
      .character-intro-gallery img {
        flex: 0 1 calc(50% - 0.4rem);
        width: calc(50% - 0.4rem);
        max-width: calc(50% - 0.4rem);
        margin: 0;
      }
      .character-intro.is-portrait .character-intro-media {
        flex: 0 0 50%;
        max-width: 50%;
      }
      .character-intro.is-portrait .character-intro-media img {
        margin: 0;
      }
      .character-intro-copy {
        min-width: 0;
        background: transparent;
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
        .character-intro-gallery {
          gap: 0.6rem;
        }
        .character-intro-gallery img {
          width: calc(50% - 0.3rem);
          max-width: calc(50% - 0.3rem);
        }
      }
      @page {
        margin: 10mm 10mm;
      }
      @media print {
        body {
          padding: 0;
          background: var(--paper);
        }
        main {
          border-radius: 0;
          box-shadow: none;
          border: none;
          padding-bottom: 0;
        }
        .page-ornament.top-right {
          top: 7mm;
          right: -2mm;
          width: 23mm;
          height: 23mm;
          --ornament-opacity: 0.15;
        }
        .page-ornament.bottom-left {
          left: -11.5mm;
          bottom: 2mm;
          width: 36mm;
          height: 27mm;
          --ornament-opacity: 0.1;
        }
        .page-ornament.right-spray {
          display: none;
        }
        .page-ornament.watermark {
          display: none;
        }
        .page-ornament.watermark-late {
          display: none;
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
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }
        .character-dossier {
          break-inside: auto;
          page-break-inside: auto;
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }
        .character-dossier *,
        .character-intro-media,
        .character-intro-copy {
          background: transparent !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
        .character-intro.is-portrait {
          display: flex;
          align-items: flex-start;
        }
        .character-intro.is-portrait .character-intro-media {
          flex-basis: 50%;
          max-width: 50%;
        }
        .character-intro.is-portrait .character-intro-media img {
          max-height: 37vh;
        }
        .character-intro-gallery img {
          max-height: 35vh;
          object-fit: contain;
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
    <main>
      <div class="page-ornament top-right" aria-hidden="true"></div>
      <div class="page-ornament bottom-left" aria-hidden="true"></div>
      <div class="page-ornament right-spray" aria-hidden="true"></div>
      <div class="page-ornament watermark" aria-hidden="true"></div>
      <div class="page-ornament watermark-late" aria-hidden="true"></div>
      ${bodyHtml}
    </main>
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

function buildMushroomsDocsHtml(document, ornaments) {
  const generalLoreHtml = document.generalLoreSections
    .map((section, index) => `\
<article class="docs-topic">
  <div class="docs-index">${String(index + 1).padStart(2, '0')}</div>
  <div class="docs-topic-copy">
    <h3>${escapeHtml(section.title)}</h3>
    ${section.bodyHtml}
  </div>
</article>`)
    .join('\n');

  const characterProfilesHtml = document.characters
    .map((character) => {
      const summaryHtml = character.summaryItems.length > 0
        ? `<div class="docs-summary-grid">
            ${character.summaryItems.map((item) => `\
<div class="docs-summary-card">
  <span class="docs-summary-label">${escapeHtml(item.label)}</span>
  <p>${markdownToInlineHtml(item.value)}</p>
</div>`).join('\n')}
          </div>`
        : '';

      const sectionsHtml = character.sections
        .map((section, index) => `\
<section class="docs-profile-section">
  <div class="docs-index">${String(index + 1).padStart(2, '0')}</div>
  <div class="docs-profile-section-copy">
    <h3>${escapeHtml(section.title)}</h3>
    ${section.bodyHtml}
  </div>
</section>`)
        .join('\n');

      return `\
<article class="docs-profile">
  <header class="docs-profile-header${character.mediaHtml ? ' has-media' : ''}">
    ${character.mediaHtml ? `<div class="docs-profile-media">${character.mediaHtml}</div>` : ''}
    <div class="docs-profile-copy">
      <p class="docs-kicker">Mushrooms Documents</p>
      <h2>Профиль персонажа: ${escapeHtml(character.title)}</h2>
      ${summaryHtml}
    </div>
  </header>
  <div class="docs-profile-sections">
    ${sectionsHtml}
  </div>
</article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${document.title}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #090705;
        --paper: #14100d;
        --panel: rgba(31, 23, 17, 0.96);
        --panel-strong: rgba(24, 18, 13, 0.98);
        --ink: #f6e7c0;
        --muted: #cdb17a;
        --accent: #f4c56a;
        --accent-soft: rgba(244, 197, 106, 0.16);
        --line: rgba(244, 197, 106, 0.22);
        --line-strong: rgba(244, 197, 106, 0.4);
        --shadow: rgba(0, 0, 0, 0.35);
        --ornament-top-right: url("${ornaments.topRight}");
        --ornament-bottom-left: url("${ornaments.bottomLeft}");
        --ornament-watermark: url("${ornaments.watermark}");
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 18px;
        background:
          radial-gradient(circle at top, rgba(255, 205, 126, 0.12), transparent 28%),
          radial-gradient(circle at bottom left, rgba(191, 133, 55, 0.14), transparent 24%),
          linear-gradient(180deg, #0e0b08 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
      }
      .page-ornament {
        position: fixed;
        inset: auto;
        pointer-events: none;
        z-index: 0;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        filter: sepia(0.35) saturate(0.92);
      }
      .page-ornament.top-right {
        top: 8px;
        right: -28px;
        width: 160px;
        height: 160px;
        opacity: 0.12;
        background-image: var(--ornament-top-right);
      }
      .page-ornament.bottom-left {
        left: -34px;
        bottom: 16px;
        width: 220px;
        height: 190px;
        opacity: 0.08;
        background-image: var(--ornament-bottom-left);
      }
      .page-ornament.watermark {
        top: 34%;
        right: -14%;
        width: 420px;
        height: 420px;
        opacity: 0.04;
        background-image: var(--ornament-watermark);
      }
      main {
        position: relative;
        z-index: 1;
        max-width: 920px;
        margin: 0 auto;
        padding: 34px 36px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(255, 232, 186, 0.02), transparent 24%),
          var(--paper);
        box-shadow: 0 24px 70px var(--shadow);
      }
      .docs-cover {
        padding: 0.5rem 0 0.75rem;
        border-bottom: 1px solid var(--line);
      }
      .docs-kicker {
        margin: 0 0 0.45rem;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        font-size: 0.78rem;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1, h2, h3 {
        margin: 0;
        line-height: 1.08;
        color: var(--accent);
      }
      h1 {
        font-size: 2.7rem;
        max-width: 12ch;
      }
      .docs-section-shell {
        margin-top: 0.9rem;
      }
      .docs-section-shell > h2 {
        padding-bottom: 0.7rem;
        font-size: 1.7rem;
        border-bottom: 1px solid var(--line-strong);
      }
      .docs-topic,
      .docs-profile-section {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
      }
      .docs-topic {
        margin-top: 1.35rem;
        padding: 1.1rem 0 0;
        border-top: 1px solid rgba(244, 197, 106, 0.08);
      }
      .docs-index {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.3rem;
        padding: 0.2rem 0.55rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(255, 220, 147, 0.12), rgba(255, 220, 147, 0.04));
        color: var(--accent);
        font-family: "Courier New", monospace;
        font-size: 0.86rem;
        letter-spacing: 0.1em;
      }
      .docs-topic-copy h3,
      .docs-profile-section-copy h3 {
        margin-bottom: 0.7rem;
        font-size: 1.16rem;
      }
      p, li {
        font-size: 1rem;
        line-height: 1.72;
        color: #f3e5c2;
      }
      ul, ol {
        margin: 0.7rem 0 0.2rem 1.2rem;
        padding: 0;
      }
      li + li {
        margin-top: 0.3rem;
      }
      strong {
        color: var(--accent);
      }
      hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: 2rem 0;
      }
      blockquote {
        margin: 1rem 0 0;
        padding: 0.9rem 1rem;
        border-left: 3px solid var(--accent);
        background: rgba(255, 216, 145, 0.06);
        color: #f6e8bf;
      }
      code {
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
        background: rgba(255, 220, 147, 0.08);
      }
      .docs-profile {
        margin-top: 1.7rem;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }
      .docs-profile-header {
        display: block;
      }
      .docs-profile-header.has-media {
        display: grid;
        grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
        gap: 1.3rem;
        align-items: start;
      }
      .docs-profile-copy h2 {
        font-size: 1.78rem;
      }
      .docs-profile-media img {
        display: block;
        width: 100%;
        margin: 0;
        border-radius: 18px;
        border: 1px solid rgba(255, 218, 140, 0.18);
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.28);
      }
      .docs-profile-media .character-intro-gallery {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .docs-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.8rem;
        margin-top: 1rem;
      }
      .docs-summary-card {
        padding: 0.85rem 0.95rem;
        border: 1px solid rgba(255, 214, 134, 0.14);
        border-radius: 16px;
        background: rgba(255, 217, 145, 0.05);
      }
      .docs-summary-label {
        display: block;
        margin-bottom: 0.35rem;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        font-size: 0.76rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .docs-summary-card p {
        margin: 0;
      }
      .docs-profile-sections {
        margin-top: 1.35rem;
      }
      .docs-profile-section {
        padding-top: 1rem;
        margin-top: 1rem;
        border-top: 1px solid rgba(244, 197, 106, 0.1);
      }
      .docs-profile-section:first-child {
        margin-top: 0;
      }
      @media (max-width: 760px) {
        main {
          padding: 26px 22px;
        }
        .docs-profile-header.has-media {
          grid-template-columns: 1fr;
        }
        .docs-topic,
        .docs-profile-section {
          grid-template-columns: 1fr;
        }
        .docs-index {
          width: fit-content;
        }
      }
      @page {
        margin: 10mm 10mm;
      }
      @media print {
        body {
          padding: 0;
          background: var(--bg);
        }
        main {
          border-radius: 0;
          box-shadow: none;
        }
        .docs-cover,
        .docs-section-shell,
        .docs-profile-header {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .docs-profile {
          break-inside: auto;
          page-break-inside: auto;
        }
        .docs-profile-section,
        .docs-topic {
          break-inside: auto;
          page-break-inside: auto;
        }
        h1, h2, h3 {
          page-break-after: avoid;
          break-after: avoid-page;
        }
        p, li {
          orphans: 3;
          widows: 3;
        }
      }
    </style>
  </head>
  <body>
    <div class="page-ornament top-right" aria-hidden="true"></div>
    <div class="page-ornament bottom-left" aria-hidden="true"></div>
    <div class="page-ornament watermark" aria-hidden="true"></div>
    <main>
      <header class="docs-cover">
      <p class="docs-kicker">Mushrooms Documents</p>
        <h1>${escapeHtml(document.title)}</h1>
      </header>

      <section class="docs-section-shell">
        <h2>Общий лор</h2>
        ${generalLoreHtml}
      </section>

      <section class="docs-section-shell">
        <h2>Профили персонажей</h2>
        ${characterProfilesHtml}
      </section>
    </main>
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

async function readSvgDataUrl(filePath) {
  const svg = await fs.readFile(filePath, 'utf8');
  return toDataUrl(svg);
}

async function readAssetDataUrl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.svg') {
    return readSvgDataUrl(filePath);
  }

  const bytes = await fs.readFile(filePath);
  const mimeType =
    extension === '.png' ? 'image/png' :
    extension === '.webp' ? 'image/webp' :
    'image/jpeg';
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

async function loadOrnamentAssets(outputDir) {
  const ornamentsDir = path.join(outputDir, '..', 'assets', 'ornaments');

  return {
    topRight: await readAssetDataUrl(path.join(ornamentsDir, 'top-right-mushroom.jpg')),
    bottomLeft: await readSvgDataUrl(path.join(ornamentsDir, 'bottom-left-mushroom.svg')),
    rightSpray: await readSvgDataUrl(path.join(ornamentsDir, 'enokitake-mushroom.svg')),
    watermark: await readSvgDataUrl(path.join(ornamentsDir, 'champignons-entiers-et-coupes.svg'))
  };
}

async function renderPageImages(page, outputDir, template) {
  const pageImagesDir = path.join(outputDir, template.pageImagesDirName);
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
      template: template.id,
      pages: images.map((image) => ({
        pageNumber: image.pageNumber,
        fileName: image.fileName
      }))
    }, null, 2)}\n`,
    'utf8'
  );

  return { pageImagesDir, manifestPath, images };
}

function buildLoreArtifactTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function pruneOldVersionedArtifacts(outputDir, prefix, extension, keep = 10) {
  const entries = await fs.readdir(outputDir);
  const matches = entries
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(extension))
    .sort()
    .reverse();

  for (const name of matches.slice(keep)) {
    await fs.unlink(path.join(outputDir, name));
  }
}

export async function renderMarkdownToHtmlAndPdf(markdown, title, outputDir, options = {}) {
  const template = getRenderTemplate(options.template);
  const ornaments = await loadOrnamentAssets(outputDir);
  const bodyHtml = applyCharacterIntroLayout(marked.parse(markdown));
  const baseHtml = template.id === 'mushrooms-docs'
    ? buildMushroomsDocsHtml(parseLoreDocument(markdown, title), ornaments)
    : buildClassicHtml(title, bodyHtml, ornaments);
  const html = await inlineLocalImages(baseHtml, outputDir);
  const timestamp = buildLoreArtifactTimestamp();
  const htmlPath = path.join(outputDir, `${template.filePrefix}-${timestamp}.html`);
  const pdfPath = path.join(outputDir, `${template.filePrefix}-${timestamp}.pdf`);
  const latestHtmlPath = path.join(outputDir, `${template.filePrefix}.html`);
  const latestPdfPath = path.join(outputDir, `${template.filePrefix}.pdf`);

  await fs.writeFile(htmlPath, html, 'utf8');
  await fs.writeFile(latestHtmlPath, html, 'utf8');

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 120000 });
    const pageImageResult = await renderPageImages(page, outputDir, template);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true
    });
    await fs.copyFile(pdfPath, latestPdfPath);
    await pruneOldVersionedArtifacts(outputDir, template.filePrefix, '.html');
    await pruneOldVersionedArtifacts(outputDir, template.filePrefix, '.pdf');
    return {
      template: template.id,
      htmlPath,
      pdfPath,
      latestHtmlPath,
      latestPdfPath,
      ...pageImageResult
    };
  } finally {
    await browser.close();
  }
}
