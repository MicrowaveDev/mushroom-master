import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import { createWikiServicePort } from '@microwavedev/backpack-game-core/server/ports/mushroom/platform';
import { repoRoot } from '../shared/repo-root.js';
import { WIKI_TIER_THRESHOLDS } from './game-data.js';

const wikiServicePort = createWikiServicePort({
  rootDir: path.resolve(repoRoot, 'wiki'),
  readFile: fs.readFile,
  readDirectory: fs.readdir,
  joinPath: path.join,
  parseMarkdown: marked.parse,
  lexMarkdown: marked.lexer,
  sections: ['characters', 'factions', 'locations', 'glossary'],
  gatedSection: 'characters',
  tierThresholds: WIKI_TIER_THRESHOLDS,
  summarizeEntry: (entry) => ({
    slug: entry.slug,
    section: entry.section,
    titleRu: entry.title_ru,
    titleEn: entry.title_en,
    summaryRu: entry.summary_ru,
    summaryEn: entry.summary_en,
    imagePath: entry.image
  })
});

export const {
  getWikiHome,
  getWikiEntry
} = wikiServicePort;
