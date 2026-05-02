// Per-domain helpers for the season-image pipeline (rank emblems +
// achievement badges). Mirrors artifact-sheet-helpers.js. Asset-agnostic
// primitives live in lib/bitmap-image-toolkit.js.

import fs from 'node:fs';
import path from 'node:path';
import { seasonLevels } from '../shared/season-levels.js';
import achievements from '../shared/run-achievements.json' with { type: 'json' };
import { repoRoot, escapeHtml } from './lib/bitmap-image-toolkit.js';

export { repoRoot, escapeHtml };
export const seasonRankDir = path.join(repoRoot, 'web', 'public', 'season-ranks');
export const achievementDir = path.join(repoRoot, 'web', 'public', 'achievements');

export const seasonSectionOrder = [
  'Season Ranks',
  'General Achievements',
  'Character Achievements'
];

const characterOrder = ['thalla', 'lomie', 'axilin', 'kirt', 'morga', 'dalamar'];
const characterAccent = Object.fromEntries(characterOrder.map((id) => [id, id]));

export function buildSeasonImageEntries() {
  const entries = [];

  for (const level of seasonLevels) {
    entries.push({
      id: `rank_${level.id}`,
      kind: 'rank',
      rankId: level.id,
      section: 'Season Ranks',
      type: 'rank',
      accent: level.id,
      name: level.name,
      lore: level.lore,
      outputDir: seasonRankDir,
      outputFileName: `${level.id}.png`,
      outputPath: path.join(seasonRankDir, `${level.id}.png`)
    });
  }

  for (const achievement of achievements.general || []) {
    const isSeasonTier = achievement.id.startsWith('season_');
    entries.push({
      id: `ach_${achievement.id}`,
      kind: 'achievement',
      achievementId: achievement.id,
      section: 'General Achievements',
      type: isSeasonTier ? 'season' : 'general',
      accent: isSeasonTier ? achievement.id.replace('season_', '').split('_')[0] : 'general',
      name: achievement.name,
      lore: achievement.lore,
      criteria: achievement.criteria || {},
      outputDir: achievementDir,
      outputFileName: `${achievement.id}.png`,
      outputPath: path.join(achievementDir, `${achievement.id}.png`)
    });
  }

  for (const characterId of characterOrder) {
    for (const achievement of achievements.characters?.[characterId] || []) {
      entries.push({
        id: `ach_${achievement.id}`,
        kind: 'achievement',
        achievementId: achievement.id,
        section: 'Character Achievements',
        characterId,
        type: 'character',
        accent: characterAccent[characterId] || 'character',
        name: achievement.name,
        lore: achievement.lore,
        criteria: achievement.criteria || {},
        outputDir: achievementDir,
        outputFileName: `${achievement.id}.png`,
        outputPath: path.join(achievementDir, `${achievement.id}.png`)
      });
    }
  }

  return entries;
}

export function buildSeasonSections() {
  const all = buildSeasonImageEntries();
  const sections = new Map(seasonSectionOrder.map((section) => [section, []]));
  for (const entry of all) {
    if (!sections.has(entry.section)) sections.set(entry.section, []);
    sections.get(entry.section).push(entry);
  }
  for (const items of sections.values()) {
    items.sort((a, b) => {
      // Stable order: ranks by minPoints; achievements alphabetical inside their section.
      if (a.kind === 'rank' && b.kind === 'rank') {
        const order = ['bronze', 'silver', 'gold', 'diamond'];
        return order.indexOf(a.rankId) - order.indexOf(b.rankId);
      }
      return a.id.localeCompare(b.id, 'en');
    });
  }
  return Array.from(sections.entries()).filter(([, items]) => items.length);
}

export function seasonImageDataUrl(entry) {
  if (!fs.existsSync(entry.outputPath)) {
    throw new Error(`Missing season image: ${path.relative(repoRoot, entry.outputPath)}`);
  }
  return `data:image/png;base64,${fs.readFileSync(entry.outputPath).toString('base64')}`;
}

export function relativeOutputPath(entry) {
  return path.relative(repoRoot, entry.outputPath);
}
