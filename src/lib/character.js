import fs from 'node:fs/promises';
import path from 'node:path';
import { slugify } from './storage.js';
import {
  normalizeLooseMarkdownBody,
  mergeStructuredBodies,
  normalizeTextForDupCompare
} from './markdown-parser.js';

export function normalizeCharacterName(value) {
  return parseCharacterProfileHeading(value).displayName
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toCharacterKey(value) {
  const cyrillicMap = new Map([
    ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'g'], ['д', 'd'], ['е', 'e'], ['ё', 'e'],
    ['ж', 'zh'], ['з', 'z'], ['и', 'i'], ['й', 'i'], ['к', 'k'], ['л', 'l'], ['м', 'm'],
    ['н', 'n'], ['о', 'o'], ['п', 'p'], ['р', 'r'], ['с', 's'], ['т', 't'], ['у', 'u'],
    ['ф', 'f'], ['х', 'h'], ['ц', 'ts'], ['ч', 'ch'], ['ш', 'sh'], ['щ', 'shch'], ['ъ', ''],
    ['ы', 'y'], ['ь', ''], ['э', 'e'], ['ю', 'yu'], ['я', 'ya']
  ]);

  const normalized = normalizeCharacterName(value).toLowerCase();
  const transliterated = Array.from(normalized).map((char) => cyrillicMap.get(char) ?? char).join('');
  return transliterated
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractCharacterName(textSection) {
  const raw = String(textSection || '').trim();
  if (!raw) {
    return '';
  }

  const headingMatch = raw.match(/^#\s*(?:Character Profile|Профиль персонажа):\s*([^\n]+)$/imu);
  if (headingMatch) {
    return normalizeCharacterName(headingMatch[1]);
  }

  const firstLine = raw.split('\n', 1)[0]?.trim() || '';
  if (
    firstLine &&
    !/[.:!?]/u.test(firstLine) &&
    !/\s{2,}/u.test(firstLine) &&
    firstLine.length <= 80 &&
    raw.split('\n').length <= 3
  ) {
    return normalizeCharacterName(firstLine);
  }

  return '';
}

export function parseCharacterProfileHeading(value) {
  const raw = String(value || '')
    .replace(/^#+\s*/u, '')
    .replace(/^(?:character profile|профиль персонажа):\s*/iu, '')
    .trim();

  if (!raw) {
    return {
      displayName: '',
      alias: '',
      epithet: '',
      raw
    };
  }

  const match = raw.match(/^([^(—-]+?)\s*(?:\(([^)]+)\))?\s*(?:[—-]\s*(.+))?$/u);
  if (!match) {
    return {
      displayName: raw,
      alias: '',
      epithet: '',
      raw
    };
  }

  return {
    displayName: String(match[1] || '').trim(),
    alias: String(match[2] || '').trim(),
    epithet: String(match[3] || '').trim(),
    raw
  };
}

function classifyStructuredProfileSection(title) {
  const normalized = String(title || '').toLowerCase();

  if (
    /взаимодейств|истори|сюжет|динамик|команд|обител|meeting|relationship|plot|connection/u.test(normalized)
  ) {
    return 'relationships';
  }

  if (
    /внешн|облик|макияж|одежд|декор|visual appearance|appearance|outfit|style/u.test(normalized)
  ) {
    return 'appearance';
  }

  if (
    /магич|способност|особенност|арсенал|вооруж|оруж|питомец|artifact|magic|abilities|weapon|feature/u.test(normalized)
  ) {
    return 'abilities';
  }

  if (
    /(?:^|[\s(])характер(?:$|[\s)])/u.test(normalized) ||
    /(?:^|[\s(])роль(?:$|[\s)])/u.test(normalized) ||
    /personality|role/u.test(normalized)
  ) {
    return 'motives';
  }

  return 'relationships';
}

export function parseStructuredCharacterProfile(textSection) {
  const raw = String(textSection || '').trim();
  const headingMatch = raw.match(/^#\s*(?:Character Profile|Профиль персонажа):\s*([^\n]+)$/imu);
  if (!headingMatch) {
    return null;
  }

  const heading = parseCharacterProfileHeading(headingMatch[1]);
  const name = heading.displayName;
  const sectionMatches = Array.from(raw.matchAll(/^##\s+\d+\.\s+(.+)$/gim));
  const prefaceStart = headingMatch.index + headingMatch[0].length;
  const prefaceEnd = sectionMatches.length > 0 ? sectionMatches[0].index : raw.length;
  const preface = raw.slice(prefaceStart, prefaceEnd).trim();
  const prefaceLines = preface
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '---');

  const sections = sectionMatches.map((match, index) => {
    const title = String(match[1] || '').trim();
    const start = match.index + match[0].length;
    const end = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index : raw.length;
    const body = normalizeLooseMarkdownBody(raw.slice(start, end));
    return { title, body };
  });

  const overviewParts = [];
  const conceptLine = prefaceLines.find((line) => /^(?:concept|концепция):/i.test(line));
  const themeLine = prefaceLines.find((line) => /^(?:theme|тема|стиль):/i.test(line));
  if (conceptLine) {
    overviewParts.push(conceptLine.replace(/^(?:concept|концепция):\s*/i, '').trim());
  }
  if (themeLine) {
    overviewParts.push(`Тема: ${themeLine.replace(/^(?:theme|тема|стиль):\s*/i, '').trim()}`);
  }
  const sectionBodies = {
    appearance: [],
    abilities: [],
    motives: [],
    relationships: []
  };

  for (const section of sections) {
    const body = section.body;
    if (!body) {
      continue;
    }
    const bucket = classifyStructuredProfileSection(section.title);
    sectionBodies[bucket].push(body);
  }

  const motivePreface = prefaceLines
    .filter((line) => !/^(?:concept|концепция):/i.test(line) && !/^(?:theme|тема|стиль):/i.test(line));
  const firstMotiveBody = sectionBodies.motives[0] || '';
  if (firstMotiveBody) {
    overviewParts.push(firstMotiveBody);
  }

  const profile = {
    name,
    alias: heading.alias || null,
    epithet: heading.epithet || null,
    sections: {
      'Обзор': mergeStructuredBodies(overviewParts.join('\n\n')),
      'Внешность': mergeStructuredBodies(...sectionBodies.appearance),
      'Особенности': mergeStructuredBodies(...sectionBodies.abilities),
      'Мотивы и роль': mergeStructuredBodies(
        ...sectionBodies.motives,
        motivePreface.join('\n')
      ),
      'Связи и сюжетные линии': mergeStructuredBodies(...sectionBodies.relationships)
    }
  };

  return profile;
}

export function isSubstantiveCharacterSource(text, characterName) {
  const normalizedText = normalizeTextForDupCompare(text);
  const normalizedName = normalizeTextForDupCompare(characterName);
  if (!normalizedText || normalizedText === normalizedName) {
    return false;
  }
  return normalizedText.length >= Math.max(40, normalizedName.length + 12);
}

function inferCharacterSubtitle(character) {
  const headingBits = [
    character.structuredProfile?.epithet || '',
    character.structuredProfile?.alias || ''
  ].filter(Boolean).join(' · ');
  if (headingBits) {
    return headingBits;
  }
  const text = character.structuredProfile?.sections?.['Обзор']
    || character.sources?.[0]?.text
    || '';
  const firstParagraph = String(text).split(/\n\s*\n/u)[0].trim();
  const cleaned = firstParagraph
    .replace(/^[-*]\s+/u, '')
    .replace(/^[^:]{0,48}:\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 150) || 'Временный концепт-портрет';
}

function inferPlaceholderTheme(character) {
  const combined = [
    character.name,
    character.key,
    character.structuredProfile?.sections?.['Обзор'] || '',
    character.structuredProfile?.sections?.['Внешность'] || '',
    character.sources?.map((source) => source.text).join('\n\n') || ''
  ].join('\n').toLowerCase();

  if (combined.includes('даламар') || combined.includes('энтроп') || combined.includes('пепел') || combined.includes('плесен')) {
    return { bg1: '#11131a', bg2: '#7b8076', accent: '#e7eaef', accent2: '#9bc49d', motif: 'ash' };
  }
  if (combined.includes('аксилин') || combined.includes('алхим') || combined.includes('имбир') || combined.includes('янтар')) {
    return { bg1: '#5c2e15', bg2: '#d48e2f', accent: '#ffe08e', accent2: '#9ad06f', motif: 'brew' };
  }
  if (combined.includes('ломиэ') || combined.includes('портал') || combined.includes('сумер') || combined.includes('звезд')) {
    return { bg1: '#132347', bg2: '#5f49c3', accent: '#e1f7ff', accent2: '#9fe6ff', motif: 'rift' };
  }
  if (combined.includes('кирт') || combined.includes('охот') || combined.includes('ядов')) {
    return { bg1: '#18181d', bg2: '#4a631c', accent: '#e0ff9d', accent2: '#ab8cff', motif: 'thorn' };
  }
  return { bg1: '#3e2c1f', bg2: '#b17a42', accent: '#f5e4c3', accent2: '#d4b06f', motif: 'spore' };
}

function buildTemporaryCharacterSvg(character) {
  const theme = inferPlaceholderTheme(character);
  const escape = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const name = escape(character.name || 'Персонаж');
  const subtitle = escape(inferCharacterSubtitle(character));

  const motifMarkup = theme.motif === 'ash'
    ? `<g opacity="0.18" fill="${theme.accent}"><circle cx="170" cy="270" r="12"/><circle cx="220" cy="330" r="18"/><circle cx="690" cy="290" r="14"/><circle cx="640" cy="360" r="9"/><circle cx="730" cy="420" r="22"/></g>`
    : theme.motif === 'brew'
      ? `<g opacity="0.22" stroke="${theme.accent}" stroke-width="8" fill="none"><path d="M180 360 C240 260, 320 250, 390 340" /><path d="M510 350 C580 260, 660 255, 720 360" /><path d="M300 470 C360 420, 430 420, 500 500" /></g>`
      : theme.motif === 'rift'
        ? `<g opacity="0.22" fill="none" stroke="${theme.accent}" stroke-width="8"><ellipse cx="240" cy="300" rx="90" ry="34"/><ellipse cx="660" cy="350" rx="110" ry="42"/><path d="M450 180 C490 220, 490 300, 450 350 C420 320, 420 220, 450 180 Z" /></g>`
        : theme.motif === 'thorn'
          ? `<g opacity="0.24" stroke="${theme.accent}" stroke-width="8" fill="none"><path d="M170 820 C240 720, 280 650, 320 520" /><path d="M730 820 C660 720, 620 650, 580 520" /><path d="M320 520 L270 470" /><path d="M580 520 L630 470" /></g>`
          : `<g opacity="0.22" fill="${theme.accent}"><circle cx="210" cy="320" r="18"/><circle cx="680" cy="300" r="14"/><circle cx="620" cy="410" r="10"/><circle cx="290" cy="450" r="12"/><circle cx="720" cy="520" r="20"/></g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg1}"/>
      <stop offset="100%" stop-color="${theme.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="28%" r="55%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="900" height="1200" rx="54" fill="url(#bg)"/>
  <rect x="32" y="32" width="836" height="1136" rx="38" fill="none" stroke="rgba(255,255,255,0.22)"/>
  <circle cx="450" cy="250" r="220" fill="url(#glow)"/>
  ${motifMarkup}
  <g opacity="0.9">
    <ellipse cx="450" cy="490" rx="170" ry="205" fill="rgba(255,255,255,0.08)"/>
    <circle cx="450" cy="360" r="96" fill="rgba(255,255,255,0.12)"/>
    <path d="M340 675 C360 560, 540 560, 560 675 L605 930 C612 970, 580 1000, 540 1000 H360 C320 1000, 288 970, 295 930 Z" fill="rgba(255,255,255,0.10)"/>
    <path d="M320 700 C270 770, 250 860, 245 980" stroke="${theme.accent2}" stroke-opacity="0.65" stroke-width="22" stroke-linecap="round"/>
    <path d="M580 700 C630 770, 650 860, 655 980" stroke="${theme.accent2}" stroke-opacity="0.65" stroke-width="22" stroke-linecap="round"/>
  </g>
  <text x="78" y="1010" fill="${theme.accent}" font-size="76" font-family="Georgia, Times New Roman, serif" font-weight="700">${name}</text>
  <foreignObject x="78" y="1048" width="744" height="104">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Georgia, 'Times New Roman', serif; color: ${theme.accent}; font-size: 30px; line-height: 1.25;">${subtitle}</div>
  </foreignObject>
  <text x="78" y="1170" fill="${theme.accent2}" font-size="24" font-family="Georgia, Times New Roman, serif" letter-spacing="2">TEMPORARY CHARACTER CONCEPT</text>
</svg>`;
}

export async function ensureTemporaryCharacterImages(dirs, characters) {
  const tempDir = path.join(dirs.generatedDir, 'temp-character-images');
  await fs.mkdir(tempDir, { recursive: true });

  const withImages = [];
  for (const character of characters) {
    if (character.images.length > 0) {
      withImages.push(character);
      continue;
    }

    const fileName = `${slugify(character.key || character.name)}.svg`;
    const absolutePath = path.join(tempDir, fileName);
    await fs.writeFile(absolutePath, buildTemporaryCharacterSvg(character), 'utf8');
    const generatedRelativePath = path.relative(dirs.generatedDir, absolutePath).split(path.sep).join('/');
    withImages.push({
      ...character,
      images: [
        {
          sourceMessageId: null,
          caption: `${character.name} temporary concept image`,
          description: 'Temporary generated concept image used until a real character photo is added to the channel.',
          visualDetails: null,
          generatedRelativePath,
          assetPath: absolutePath,
          temporary: true
        }
      ]
    });
  }

  return withImages;
}

export async function writeCharacterManifests(dirs, characters) {
  await fs.rm(dirs.charactersDir, { recursive: true, force: true });
  await fs.mkdir(dirs.charactersDir, { recursive: true });

  for (const character of characters) {
    const characterSlug = slugify(character.key || character.name);
    const characterDir = path.join(dirs.charactersDir, characterSlug);
    await fs.mkdir(characterDir, { recursive: true });

    const manifest = {
      name: character.name,
      key: character.key,
      slug: characterSlug,
      alias: character.structuredProfile?.alias || null,
      epithet: character.structuredProfile?.epithet || null,
      completenessTier: character.completenessTier || 'partial',
      imageCount: character.images.length,
      sourceCount: character.sources.length,
      structuredProfile: character.structuredProfile || null,
      images: character.images.map((image) => ({
        sourceMessageId: image.sourceMessageId,
        caption: image.caption,
        description: image.description,
        visualDetails: image.visualDetails || null,
        assetPath: path.relative(characterDir, image.assetPath).split(path.sep).join('/'),
        generatedRelativePath: image.generatedRelativePath
      })),
      sources: character.sources.map((source) => ({
        sourceMessageId: source.sourceMessageId
      }))
    };

    await fs.writeFile(path.join(characterDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
}

export function parseLoreInstructionsFromText(text) {
  const raw = String(text || '').trim();
  const characterOrder = [];

  for (const line of raw.split('\n')) {
    const normalizedLine = line.trim();
    const orderMatch = normalizedLine.match(/^порядок персонажей:\s*(.+)$/iu);
    if (!orderMatch) {
      continue;
    }

    for (const entry of orderMatch[1].split(',')) {
      const name = normalizeCharacterName(entry);
      const key = toCharacterKey(name);
      if (key && !characterOrder.includes(key)) {
        characterOrder.push(key);
      }
    }
  }

  return {
    raw,
    characterOrder
  };
}

export function orderCharactersByInstructions(characters, instructionEntries) {
  const explicitOrder = [];
  for (const entry of instructionEntries) {
    for (const key of entry.parsed?.characterOrder || []) {
      if (!explicitOrder.includes(key)) {
        explicitOrder.push(key);
      }
    }
  }

  const orderIndex = new Map(explicitOrder.map((key, index) => [key, index]));
  return [...characters].sort((a, b) => {
    const aIndex = orderIndex.has(a.key) ? orderIndex.get(a.key) : Number.POSITIVE_INFINITY;
    const bIndex = orderIndex.has(b.key) ? orderIndex.get(b.key) : Number.POSITIVE_INFINITY;
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return a.name.localeCompare(b.name);
  });
}
