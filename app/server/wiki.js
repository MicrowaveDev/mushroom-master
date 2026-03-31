import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';

const rootDir = path.resolve('/Users/microwavedev/workspace/mushroom-master/wiki');

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

export async function getWikiEntry(section, slug) {
  const entry = await readPage(section, slug);
  return {
    ...entry,
    related: entry.related ? entry.related.split(',').map((value) => value.trim()).filter(Boolean) : []
  };
}
