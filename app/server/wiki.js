import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import { repoRoot } from '../shared/repo-root.js';
import { WIKI_TIER_THRESHOLDS } from './game-data.js';

const rootDir = path.resolve(repoRoot, 'wiki');

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return { meta: {}, body: content.trim() };
  }

  const end = content.indexOf('\n---\n', 4);
  if (end === -1) {
    return { meta: {}, body: content.trim() };
  }

  const rawMeta = content.slice(4, end).trim().split('\n');
  const meta = {};
  for (const line of rawMeta) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) {
      continue;
    }
    meta[key.trim()] = rest.join(':').trim();
  }

  return {
    meta,
    body: content.slice(end + 5).trim()
  };
}

// Split a markdown body on <!-- tier:N --> markers.
// Returns [{tier: number, markdown: string}].
// If no markers exist, returns a single section at tier 0.
function parseTierSections(body) {
  const tierRegex = /<!-- tier:(\d+) -->/g;
  const sections = [];
  let lastIndex = 0;
  let lastTier = null;
  let match;

  while ((match = tierRegex.exec(body)) !== null) {
    if (lastTier !== null) {
      const text = body.slice(lastIndex, match.index).trim();
      if (text) sections.push({ tier: lastTier, markdown: text });
    }
    lastTier = parseInt(match[1], 10);
    lastIndex = match.index + match[0].length;
  }

  if (lastTier !== null) {
    const text = body.slice(lastIndex).trim();
    if (text) sections.push({ tier: lastTier, markdown: text });
  }

  if (sections.length === 0) {
    return [{ tier: 0, markdown: body.trim() }];
  }

  return sections;
}

async function readPage(section, slug) {
  const filePath = path.join(rootDir, section, slug, 'page.md');
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = parseFrontmatter(content);
  return {
    slug,
    section,
    ...parsed.meta,
    markdown: parsed.body,
    html: marked.parse(parsed.body)
  };
}

async function readSection(section) {
  const dirPath = path.join(rootDir, section);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const pages = await Promise.all(slugs.map((slug) => readPage(section, slug)));
  return pages.sort((left, right) => Number(left.order || 999) - Number(right.order || 999));
}

export async function getWikiHome() {
  const [characters, factions, locations, glossary] = await Promise.all([
    readSection('characters'),
    readSection('factions'),
    readSection('locations'),
    readSection('glossary')
  ]);

  return {
    characters: characters.map(summarizeEntry),
    factions: factions.map(summarizeEntry),
    locations: locations.map(summarizeEntry),
    glossary: glossary.map(summarizeEntry)
  };
}

function summarizeEntry(entry) {
  return {
    slug: entry.slug,
    titleRu: entry.title_ru,
    titleEn: entry.title_en,
    summaryRu: entry.summary_ru,
    summaryEn: entry.summary_en,
    imagePath: entry.image
  };
}

// mycelium defaults to Infinity so non-authenticated callers (and non-character
// sections) always see everything.
export async function getWikiEntry(section, slug, mycelium = Infinity) {
  const entry = await readPage(section, slug);
  const rawSections = parseTierSections(entry.markdown);

  const isCharacter = section === 'characters';

  const sections = rawSections.map(({ tier, markdown }) => {
    const threshold = WIKI_TIER_THRESHOLDS[tier] ?? 0;
    const locked = isCharacter && mycelium < threshold;
    return {
      tier,
      threshold,
      locked,
      html: locked ? null : marked.parse(markdown)
    };
  });

  // html = joined visible content (used by tests and legacy callers)
  const html = sections
    .filter((s) => !s.locked)
    .map((s) => s.html)
    .join('\n');

  return {
    ...entry,
    html,
    sections,
    related: entry.related ? entry.related.split(',').map((value) => value.trim()).filter(Boolean) : []
  };
}
