import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { config as defaultConfig } from '../config.js';
import {
  analyzeImage,
  analyzeLorePromptReport,
  createCharacterLoreSection,
  createGeneralLoreSection,
  createOpenAiClient
} from './openai.js';
import { deleteMessageViaBot, editTextViaBot, sendPdfViaBot, sendTextViaBot } from './bot.js';
import { renderMarkdownToHtmlAndPdf } from './render.js';
import { ensureChannelDirs, fileExists, makeMessageStem, readMarkdown, slugify, writeMarkdown } from './storage.js';
import {
  createTelegramClient,
  downloadMessageMedia,
  editChannelMessageText,
  fetchChannelMessageById,
  fetchChannelMessages,
  fetchChannelMessagesByIds,
  getChannelEntity,
  postTextToChannel,
  shouldOcrMedia
} from './telegram.js';

function messageDateToIso(rawDate) {
  const date = rawDate instanceof Date
    ? rawDate
    : typeof rawDate === 'number'
      ? new Date(rawDate * 1000)
      : new Date(rawDate);
  return Number.isNaN(date.getTime()) ? 'unknown-date' : date.toISOString();
}

function resolveBotChatId(entity, fallbackChannelInput) {
  const rawId = String(entity?.id || '').trim();
  if (/^\d+$/.test(rawId)) {
    return `-100${rawId}`;
  }
  if (/^-100\d+$/.test(rawId)) {
    return rawId;
  }
  return fallbackChannelInput;
}

function isEditableTextSourceMessage(message) {
  const text = String(message?.message || '').trim();
  const mimeType = String(message?.file?.mimeType || '').toLowerCase();
  return Boolean(text) && !message?.media && !/^#\d+\b/.test(text) && mimeType !== 'application/pdf';
}

function shouldSkipArchivedSourceMessage(message) {
  const text = String(message?.message || '').trim();
  const mimeType = String(message?.file?.mimeType || '').toLowerCase();
  return mimeType === 'application/pdf' || /^#\d+\b/.test(text) || text.includes('Mushroom lore digest');
}

async function findHighestProcessedSourceMessageId(generatedDir) {
  try {
    const names = await fs.readdir(generatedDir);
    let maxId = 0;

    for (const name of names) {
      const match = name.match(/-(\d+)-ocr\.md$/);
      if (match) {
        maxId = Math.max(maxId, Number(match[1]));
      }
    }

    return maxId;
  } catch {
    return 0;
  }
}

async function readExistingOcrText(repostFile) {
  try {
    const markdown = await readMarkdown(repostFile);
    const match = markdown.match(/^## Extracted Text\n\n([\s\S]*?)\n?$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

async function readExistingPostedMessageId(repostFile) {
  try {
    const markdown = await readMarkdown(repostFile);
    const match = markdown.match(/^- Posted message ID: (\d+)$/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function readGeneratedOcrMetadata(repostFile) {
  try {
    const markdown = await readMarkdown(repostFile);
    const postedMessageId = await readExistingPostedMessageId(repostFile);
    return {
      postedMessageId,
      hashtags: extractHashtags(markdown),
      extractedText: extractMessageSection(markdown, 'Extracted Text')
    };
  } catch {
    return {
      postedMessageId: null,
      hashtags: [],
      extractedText: ''
    };
  }
}

async function readExistingPhotoMetadata(messageFile) {
  try {
    const markdown = await readMarkdown(messageFile);
    const match = markdown.match(/^## Photo\n\n!\[([^\]]*)\]\(([^)]+)\)(?:\n\n([\s\S]*?))?\n?$/m);
    if (!match) {
      return null;
    }

    return {
      kind: 'photo',
      title: match[1].trim(),
      imagePath: match[2].trim(),
      description: String(match[3] || '').trim(),
      visualDetails: readCharacterVisualDetails(markdown)
    };
  } catch {
    return null;
  }
}

function readCharacterVisualDetails(markdown) {
  const section = extractMessageSection(markdown, 'Character Visual Details');
  if (!section) {
    return null;
  }

  try {
    const parsed = JSON.parse(section);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function shouldRefreshPhotoDescription(message, existingPhoto) {
  if (!existingPhoto) {
    return false;
  }

  const characterName = extractCharacterName(String(message?.message || ''));
  if (!characterName) {
    return false;
  }

  const visualDetails = existingPhoto.visualDetails || {};
  const populatedFields = [
    visualDetails.face,
    visualDetails.eyes,
    visualDetails.makeup,
    visualDetails.hair,
    visualDetails.headwear,
    visualDetails.outfit
  ].filter(Boolean).length;
  if (populatedFields >= 3) {
    return false;
  }

  const description = String(existingPhoto.description || '').toLowerCase();
  const visualSignals = ['face', 'eyes', 'eye', 'makeup', 'hair', 'lips', 'hat', 'outfit'];
  return !visualSignals.some((signal) => description.includes(signal));
}

function isNamedCharacterPhotoMessage(message) {
  return Boolean(extractCharacterName(String(message?.message || '')));
}

function extractMessageIdFromMarkdown(markdown) {
  const match = markdown.match(/^- Message ID: (\d+)$/m);
  return match ? Number(match[1]) : null;
}

function buildMessageMarkdown({ channelLabel, message, media, derivedContent, messageFile }) {
  const parsedMessage = parseTaggedMessageText(message.message);
  const existingHashtags = readExistingHashtagsFromFile(messageFile);
  const mergedHashtags = Array.from(new Set([...parsedMessage.hashtags, ...existingHashtags]));
  const lines = [
    `# Message ${message.id}`,
    '',
    `- Channel: ${channelLabel}`,
    `- Date: ${messageDateToIso(message.date)}`,
    `- Message ID: ${message.id}`
  ];

  if (mergedHashtags.length > 0) {
    lines.push('', '## Hashtags', '', mergedHashtags.join(' '));
  }

  if (parsedMessage.text) {
    lines.push('', '## Text', '', parsedMessage.text);
  }

  if (media) {
    lines.push('', '## Media', '', `- File: ${media.fileName}`, `- MIME type: ${media.mimeType || 'unknown'}`);
  }

  if (derivedContent?.kind === 'screenshot' && derivedContent.extractedText) {
    lines.push('', '## OCR', '', derivedContent.extractedText.trim());
  }

  if (derivedContent?.kind === 'photo' && media) {
    const relativeAssetPath = path.relative(path.dirname(messageFile), media.path).split(path.sep).join('/');
    const caption = derivedContent.title || `Message ${message.id} photo`;
    lines.push('', '## Photo', '', `![${caption}](${relativeAssetPath})`);
    if (derivedContent.description) {
      lines.push('', derivedContent.description);
    }
    if (derivedContent.visualDetails && Object.values(derivedContent.visualDetails).some(Boolean)) {
      lines.push('', '## Character Visual Details', '', JSON.stringify(derivedContent.visualDetails, null, 2));
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildOcrMarkdown({ channelLabel, sourceMessage, postedMessage, ocrText }) {
  const parsed = parseOcrRepostText(String(postedMessage?.message || ''));
  const postedMessageId = postedMessage?.id ?? postedMessage?.message_id;
  const lines = [
    `# OCR Repost ${postedMessageId}`,
    '',
    `- Channel: ${channelLabel}`,
    `- Source message ID: ${sourceMessage.id}`,
    `- Posted message ID: ${postedMessageId}`,
    `- Date: ${messageDateToIso(postedMessage.date)}`,
    ''
  ];
  if (parsed.hashtags.length > 0) {
    lines.push('## Hashtags', '', parsed.hashtags.join(' '), '');
  }
  lines.push('## Extracted Text', '', ocrText.trim(), '');
  return lines.join('\n');
}

function extractSection(markdown, title) {
  const heading = `## ${title}\n\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return '';
  }

  const bodyStart = start + heading.length;
  const nextSecondLevel = markdown.indexOf('\n## ', bodyStart);
  const nextTopLevel = markdown.indexOf('\n# ', bodyStart);
  const endCandidates = [nextSecondLevel, nextTopLevel]
    .filter((value) => value !== -1)
    .sort((a, b) => a - b);
  const end = endCandidates.length > 0 ? endCandidates[0] : markdown.length;

  return markdown.slice(bodyStart, end).trim();
}

function extractMessageSection(markdown, title) {
  const heading = `## ${title}\n\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return '';
  }

  const bodyStart = start + heading.length;
  const knownHeadings = [
    '\n## Hashtags\n',
    '\n## Text\n',
    '\n## Media\n',
    '\n## OCR\n',
    '\n## Photo\n',
    '\n## Character Visual Details\n'
  ].filter((candidate) => candidate !== `\n## ${title}\n`);

  const endCandidates = knownHeadings
    .map((candidate) => markdown.indexOf(candidate, bodyStart))
    .filter((value) => value !== -1)
    .sort((a, b) => a - b);
  const end = endCandidates.length > 0 ? endCandidates[0] : markdown.length;

  return markdown.slice(bodyStart, end).trim();
}

function normalizeHashtag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

function isValidHashtag(tag) {
  return /^#[\p{L}\p{N}_]+$/u.test(tag);
}

function parseTaggedMessageText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { text: '', hashtags: [] };
  }

  const lines = raw.split('\n');
  const trailingHashtagLines = [];
  while (lines.length > 0) {
    const candidate = lines[lines.length - 1].trim();
    if (/^(#[\p{L}\p{N}_]+\s*)+$/u.test(candidate)) {
      trailingHashtagLines.unshift(candidate);
      lines.pop();
      continue;
    }
    break;
  }

  const hashtags = Array.from(new Set(
    trailingHashtagLines
      .join(' ')
      .split(/\s+/u)
      .map((tag) => normalizeHashtag(tag))
      .filter((tag) => isValidHashtag(tag))
  ));

  return {
    text: lines.join('\n').trim(),
    hashtags
  };
}

function composeTaggedMessageText(text, hashtags) {
  const normalizedTags = Array.from(new Set(
    (hashtags || [])
      .map((tag) => normalizeHashtag(tag))
      .filter((tag) => isValidHashtag(tag))
  ));
  const cleanText = String(text || '').trim();
  if (normalizedTags.length === 0) {
    return cleanText;
  }
  return [cleanText, normalizedTags.join(' ')].filter(Boolean).join('\n\n').trim();
}

function parseOcrRepostText(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { sourceHeader: '', text: '', hashtags: [] };
  }

  const lines = raw.split('\n');
  const sourceHeader = lines.shift()?.trim() || '';
  const remainder = lines.join('\n').trim();
  const parsed = parseTaggedMessageText(remainder);
  return {
    sourceHeader,
    text: parsed.text,
    hashtags: parsed.hashtags
  };
}

function composeOcrRepostText(sourceMessageId, text, hashtags) {
  const header = `#${sourceMessageId}`;
  const body = composeTaggedMessageText(text, hashtags);
  return [header, body].filter(Boolean).join('\n\n').trim();
}

function extractHashtags(markdown) {
  const section = extractMessageSection(markdown, 'Hashtags');
  if (!section) {
    return [];
  }

  return Array.from(new Set(
    section
      .split(/\s+/u)
      .map((tag) => normalizeHashtag(tag))
      .filter((tag) => isValidHashtag(tag))
  ));
}

function readExistingHashtagsFromFile(messageFile) {
  try {
    const markdown = readFileSync(messageFile, 'utf8');
    return extractHashtags(markdown);
  } catch {
    return [];
  }
}

function hashtagsToCharacterKeys(hashtags) {
  return hashtags
    .filter((tag) => normalizeHashtag(tag).startsWith('#character_'))
    .map((tag) => tag.replace(/^#character_/u, ''))
    .filter(Boolean);
}

function parseLoreInstructionsFromText(text) {
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

function buildInstructionEntries(records) {
  return records
    .filter((record) => record.isInstructionsTagged && !record.isExcludedFromLore)
    .map((record) => {
      const text = record.narrativeText || '';
      return {
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        fileName: record.fileName,
        text,
        parsed: parseLoreInstructionsFromText(text)
      };
    });
}

function orderCharactersByInstructions(characters, instructionEntries) {
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

async function ensureTemporaryCharacterImages(dirs, characters) {
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

function splitThirdLevelSections(markdown) {
  const matches = Array.from(markdown.matchAll(/^###\s+(.+)$/gm));
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    return {
      title: String(match[1] || '').trim(),
      content: markdown.slice(start, end).trim()
    };
  });
}

function splitFourthLevelSections(markdown) {
  const matches = Array.from(markdown.matchAll(/^####\s+(.+)$/gm));
  if (matches.length === 0) {
    return { preface: markdown.trim(), sections: [] };
  }

  const preface = markdown.slice(0, matches[0].index).trim();
  const sections = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : markdown.length;
    return {
      title: String(match[1] || '').trim(),
      body: markdown.slice(start, end).trim()
    };
  });

  return { preface, sections };
}

function stripMarkdownImages(markdown) {
  return markdown
    .replace(/(?:^|\n)!\[[^\]]*\]\([^)]+\)\s*(?=\n|$)/gm, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanupRepeatedHorizontalRules(markdown) {
  return markdown
    .replace(/\n(?:---\s*\n){2,}/g, '\n---\n')
    .replace(/(?:\n\s*){3,}---/g, '\n\n---')
    .trim();
}

function normalizeLooseMarkdownBody(markdown) {
  return String(markdown || '')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeStructuredSectionBody(markdown) {
  return normalizeLooseMarkdownBody(
    String(markdown || '')
      .replace(/^\s*#+\s+/gm, '')
  );
}

function parseCharacterProfileHeading(value) {
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

function mergeStructuredBodies(...parts) {
  return normalizeLooseMarkdownBody(
    parts
      .map((part) => normalizeLooseMarkdownBody(part))
      .filter(Boolean)
      .join('\n\n')
  );
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
    /магич|способност|арсенал|вооруж|оруж|питомец|artifact|magic|abilities|weapon/u.test(normalized)
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

function parseStructuredCharacterProfile(textSection) {
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
      'Способности и черты': mergeStructuredBodies(...sectionBodies.abilities),
      'Мотивы и роль': mergeStructuredBodies(
        ...sectionBodies.motives,
        motivePreface.join('\n')
      ),
      'Связи и сюжетные линии': mergeStructuredBodies(...sectionBodies.relationships)
    }
  };

  return profile;
}

function isSubstantiveCharacterSource(text, characterName) {
  const normalizedText = normalizeTextForDupCompare(text);
  const normalizedName = normalizeTextForDupCompare(characterName);
  if (!normalizedText || normalizedText === normalizedName) {
    return false;
  }
  return normalizedText.length >= Math.max(40, normalizedName.length + 12);
}

function normalizeGeneratedLoreMarkdown(markdown, sourceBundle) {
  const cleanedMarkdown = cleanupRepeatedHorizontalRules(markdown);
  const charactersHeading = '\n## Персонажи\n';
  const headingIndex = cleanedMarkdown.indexOf(charactersHeading);
  if (headingIndex === -1) {
    return cleanedMarkdown.trim();
  }

  const beforeCharacters = cleanedMarkdown.slice(0, headingIndex + charactersHeading.length).trimEnd();
  const charactersBlock = cleanedMarkdown.slice(headingIndex + charactersHeading.length).trim();
  const characterSections = splitThirdLevelSections(charactersBlock);
  if (characterSections.length === 0) {
    return cleanedMarkdown.trim();
  }

  const canonicalCharacters = new Map(
    (sourceBundle.characters || []).map((character) => [toCharacterKey(character.name), character])
  );
  const subsectionOrder = [
    'Обзор',
    'Внешность',
    'Способности и черты',
    'Мотивы и роль',
    'Связи и сюжетные линии'
  ];

  const normalizedSections = characterSections.map((section) => {
    const lines = section.content.split('\n');
    const headingLine = lines.shift() || '';
    const characterName = section.title;
    const canonicalCharacter = canonicalCharacters.get(toCharacterKey(characterName));
    const canonicalImage = canonicalCharacter?.images?.[0]?.generatedRelativePath || '';
    const structuredProfile = canonicalCharacter?.structuredProfile?.sections || {};
    const completenessTier = canonicalCharacter?.completenessTier || 'partial';
    const rawBody = stripMarkdownImages(lines.join('\n').trim());
    const { preface, sections } = splitFourthLevelSections(rawBody);
    const sectionMap = new Map(
      sections
        .map((entry) => [entry.title, normalizeStructuredSectionBody(entry.body)])
        .filter((entry) => entry[1])
    );

    if (preface) {
      const existingOverview = sectionMap.get('Обзор');
      sectionMap.set('Обзор', existingOverview ? `${preface}\n\n${existingOverview}` : preface);
    }

    for (const title of subsectionOrder) {
      const existing = sectionMap.get(title);
      const fallback = structuredProfile[title];
      const isWeakOverview = title === 'Обзор' && String(existing || '').trim().length < 80;
      if ((!existing || isWeakOverview) && fallback) {
        sectionMap.set(title, fallback);
      }
    }

    const rebuilt = [headingLine];
    if (canonicalImage) {
      rebuilt.push('', `![${characterName}](${canonicalImage})`);
    }

    for (const title of subsectionOrder) {
      const body = sectionMap.get(title);
      if (!body) {
        continue;
      }
      if (completenessTier === 'image_only' && title !== 'Обзор') {
        continue;
      }
      rebuilt.push('', `#### ${title}`, '', body.trim());
    }

    return rebuilt.join('\n').trim();
  });

  return cleanupRepeatedHorizontalRules(
    `${beforeCharacters}\n\n${normalizedSections.join('\n\n---\n\n')}`
  ).trim();
}

function replaceSection(markdown, title, content) {
  const heading = `## ${title}\n\n`;
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return markdown;
  }

  const bodyStart = start + heading.length;
  const nextSecondLevel = markdown.indexOf('\n## ', bodyStart);
  const nextTopLevel = markdown.indexOf('\n# ', bodyStart);
  const endCandidates = [nextSecondLevel, nextTopLevel]
    .filter((value) => value !== -1)
    .sort((a, b) => a - b);
  const end = endCandidates.length > 0 ? endCandidates[0] : markdown.length;

  return `${markdown.slice(0, bodyStart)}${content.trim()}\n${markdown.slice(end)}`;
}

function normalizeTextForDupCompare(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeOverlapEdge(text) {
  return text
    .replace(/^[•\-–—*\s]+/u, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinParagraphs(parts) {
  return parts.filter(Boolean).join('\n\n').trim();
}

function parseFloodWaitSeconds(message) {
  const match = String(message || '').match(/wait of (\d+) seconds/i);
  return match ? Number(match[1]) : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripKnownNoise(text) {
  return text
    .replace(/(?:^|\n)\s*Хочешь[\s\S]*?(?=\n\s*\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*Хотите[\s\S]*?(?=\n\s*\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*Как ты думаешь[\s\S]*?(?=\n\s*\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*расскажи\s*(?=\n|$)/giu, '\n')
    .replace(/(?:^|\n)\s*добавь\s*(?=\n|$)/giu, '\n')
    .replace(/AI responses may include mistakes\. Learn more/giu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeCharacterName(value) {
  return parseCharacterProfileHeading(value).displayName
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCharacterKey(value) {
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

function extractCharacterName(textSection) {
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

function isNoiseParagraph(text) {
  const normalized = text.toLowerCase().trim();
  return normalized.includes('хочешь ли ты') ||
    normalized.startsWith('хочешь ') ||
    normalized.startsWith('хотите ') ||
    normalized.startsWith('как ты думаешь') ||
    normalized === 'расскажи' ||
    normalized === 'добавь' ||
    (
      normalized.endsWith('?') &&
      (
        normalized.startsWith('она ') ||
        normalized.startsWith('он ') ||
        normalized.startsWith('или ') ||
        normalized.includes(' или ') ||
        normalized.includes(' просто ') ||
        normalized.includes(' хочет ') ||
        normalized.includes(' ищет способ ')
      )
    ) ||
    normalized.includes('ai responses may include mistakes') ||
    normalized.includes('learn more');
}

function isDominatedByOtherParagraph(current, other) {
  if (current.sourceMessageId === other.sourceMessageId) {
    return false;
  }

  if (current.normalized === other.normalized) {
    return other.sourceMessageId < current.sourceMessageId;
  }

  if (current.normalized.length < 50) {
    return false;
  }

  return (
    other.normalized.length >= current.normalized.length + 20 &&
    other.normalized.includes(current.normalized)
  );
}

function trimMidSentenceCarryOver(paragraph, allParagraphs, currentTarget) {
  const currentText = paragraph.trim();
  if (!/^[a-zа-яё]/iu.test(currentText)) {
    return paragraph;
  }

  const boundaryMatch = currentText.match(/^(.{20,220}?[.!?])(?:\s+|$)/su);
  if (!boundaryMatch) {
    return paragraph;
  }

  const fragment = boundaryMatch[1].trim();
  const normalizedFragment = normalizeTextForDupCompare(fragment);
  if (normalizedFragment.length < 20) {
    return paragraph;
  }

  for (const other of allParagraphs) {
    if (other.targetKey === currentTarget.key) {
      continue;
    }
    if (other.sourceMessageId >= currentTarget.sourceMessageId) {
      continue;
    }

    if (other.normalized.includes(normalizedFragment)) {
      return currentText.slice(boundaryMatch[0].length).trim();
    }
  }

  return paragraph;
}

function trimLeadingCrossMessageOverlap(paragraph, allParagraphs, currentTarget) {
  let bestTrim = 0;

  for (const other of allParagraphs) {
    if (other.targetKey === currentTarget.key) {
      continue;
    }
    if (other.sourceMessageId >= currentTarget.sourceMessageId) {
      continue;
    }

    const otherText = other.original.trim();
    const currentText = paragraph.trim();
    if (!otherText || !currentText) {
      continue;
    }

    if (currentText.startsWith(otherText) && currentText.length > otherText.length + 20) {
      bestTrim = Math.max(bestTrim, otherText.length);
      continue;
    }

    if (otherText.endsWith(currentText) && currentText.length <= 80) {
      bestTrim = Math.max(bestTrim, currentText.length);
      continue;
    }

    const maxOverlap = Math.min(otherText.length, currentText.length);
    for (let size = maxOverlap; size >= 20; size -= 1) {
      const suffix = otherText.slice(-size).trim();
      const prefix = currentText.slice(0, size).trim();
      if (
        suffix &&
        prefix &&
        normalizeOverlapEdge(suffix) === normalizeOverlapEdge(prefix) &&
        currentText.length > size + 20
      ) {
        bestTrim = Math.max(bestTrim, size);
        break;
      }
    }
  }

  if (bestTrim === 0) {
    return trimMidSentenceCarryOver(paragraph, allParagraphs, currentTarget);
  }

  const trimmed = paragraph.slice(bestTrim).replace(/^[\s,.;:!?-]+/, '').trim();
  return trimMidSentenceCarryOver(trimmed, allParagraphs, currentTarget);
}

async function loadDeterministicCleanupTargets(dirs) {
  const messageFiles = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
    .sort();
  const generatedFiles = await fs.readdir(dirs.generatedDir);
  const generatedMap = new Map();

  for (const name of generatedFiles) {
    const match = name.match(/-(\d+)-ocr\.md$/);
    if (match) {
      generatedMap.set(Number(match[1]), path.join(dirs.generatedDir, name));
    }
  }

  const targets = [];

  for (const name of messageFiles) {
    const filePath = path.join(dirs.messagesDir, name);
    const markdown = await readMarkdown(filePath);
    const sourceMessageIdMatch = markdown.match(/^- Message ID: (\d+)$/m);
    if (!sourceMessageIdMatch) {
      continue;
    }

    const sourceMessageId = Number(sourceMessageIdMatch[1]);
    const hasMedia = /^## Media$/m.test(markdown);
    const textSection = extractMessageSection(markdown, 'Text');
    const ocrSection = extractMessageSection(markdown, 'OCR');

    if (!hasMedia && textSection) {
      targets.push({
        key: `text:${sourceMessageId}`,
        kind: 'text',
        sourceMessageId,
        messageFile: filePath,
        text: textSection
      });
    }

    if (ocrSection) {
      const generatedPath = generatedMap.get(sourceMessageId) || null;
      let postedMessageId = null;
      if (generatedPath) {
        postedMessageId = await readExistingPostedMessageId(generatedPath);
      }

      targets.push({
        key: `ocr:${sourceMessageId}`,
        kind: 'ocr',
        sourceMessageId,
        messageFile: filePath,
        generatedFile: generatedPath,
        postedMessageId,
        text: ocrSection
      });
    }
  }

  return targets;
}

async function collectStoredMessageArtifacts(dirs) {
  const messageFiles = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
    .sort();
  const generatedFiles = (await fs.readdir(dirs.generatedDir))
    .filter((name) => name.endsWith('-ocr.md'))
    .sort();
  const assets = await fs.readdir(dirs.assetsDir);

  const records = new Map();

  for (const name of messageFiles) {
    const filePath = path.join(dirs.messagesDir, name);
    const markdown = await readMarkdown(filePath);
    const sourceMessageId = extractMessageIdFromMarkdown(markdown);
    if (!sourceMessageId) {
      continue;
    }

    const mediaFileMatch = markdown.match(/^- File: ([^\n]+)$/m);
    const photoImageMatch = markdown.match(/^## Photo\n\n!\[[^\]]*\]\(([^)]+)\)/m);
    const assetPaths = [];

    if (mediaFileMatch) {
      assetPaths.push(path.join(dirs.assetsDir, mediaFileMatch[1].trim()));
    }
    if (photoImageMatch) {
      assetPaths.push(path.resolve(path.dirname(filePath), photoImageMatch[1].trim()));
    }

    records.set(sourceMessageId, {
      sourceMessageId,
      messageFile: filePath,
      generatedFile: null,
      assetPaths
    });
  }

  for (const name of generatedFiles) {
    const match = name.match(/-(\d+)-ocr\.md$/);
    if (!match) {
      continue;
    }

    const sourceMessageId = Number(match[1]);
    const existing = records.get(sourceMessageId) || {
      sourceMessageId,
      messageFile: null,
      generatedFile: null,
      assetPaths: []
    };
    existing.generatedFile = path.join(dirs.generatedDir, name);
    records.set(sourceMessageId, existing);
  }

  for (const assetName of assets) {
    const match = assetName.match(/-(\d+)\.bin(?:\.[^.]+)?$/);
    if (!match) {
      continue;
    }

    const sourceMessageId = Number(match[1]);
    const existing = records.get(sourceMessageId) || {
      sourceMessageId,
      messageFile: null,
      generatedFile: null,
      assetPaths: []
    };
    existing.assetPaths.push(path.join(dirs.assetsDir, assetName));
    records.set(sourceMessageId, existing);
  }

  return Array.from(records.values()).map((record) => ({
    ...record,
    assetPaths: Array.from(new Set(record.assetPaths))
  }));
}

async function unlinkIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function reconcileStoredMessages(ctx, messages) {
  const currentIds = new Set(messages.map((message) => Number(message.id)));
  const storedRecords = await collectStoredMessageArtifacts(ctx.dirs);
  const removedSourceMessageIds = [];

  for (const record of storedRecords) {
    if (currentIds.has(record.sourceMessageId)) {
      continue;
    }

    if (record.generatedFile) {
      const postedMessageId = await readExistingPostedMessageId(record.generatedFile);
      if (ctx.config.telegramBotToken && postedMessageId) {
        await deleteMessageViaBot({
          botToken: ctx.config.telegramBotToken,
          chatTarget: ctx.botChatId,
          messageId: postedMessageId
        });
      }
    }

    if (record.messageFile) {
      await unlinkIfExists(record.messageFile);
    }
    if (record.generatedFile) {
      await unlinkIfExists(record.generatedFile);
    }
    for (const assetPath of record.assetPaths) {
      await unlinkIfExists(assetPath);
    }

    removedSourceMessageIds.push(record.sourceMessageId);
  }

  return removedSourceMessageIds.sort((a, b) => a - b);
}

async function findBotRepostMessageId(ctx, sourceMessageId) {
  const targetHeader = `#${sourceMessageId}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      for await (const message of ctx.telegram.iterMessages(ctx.entity, {})) {
        const text = String(message.message || '').trim();
        const firstLine = text.split('\n', 1)[0]?.trim();
        if (firstLine === targetHeader) {
          return message.id;
        }
      }
      return null;
    } catch (error) {
      const waitSeconds = Number(error?.seconds || parseFloodWaitSeconds(error?.message));
      if (waitSeconds > 0 && attempt < 3) {
        await sleep((waitSeconds + 1) * 1000);
        continue;
      }
      throw error;
    }
  }

  return null;
}

async function syncPostedMessageId(ctx, target) {
  if (target.kind !== 'ocr' || !target.generatedFile) {
    return target.postedMessageId;
  }

  const discoveredId = await findBotRepostMessageId(ctx, target.sourceMessageId);
  if (!discoveredId) {
    return target.postedMessageId;
  }

  if (target.postedMessageId === discoveredId) {
    return discoveredId;
  }

  const markdown = await readMarkdown(target.generatedFile);
  const updatedMarkdown = markdown
    .replace(/^# OCR Repost (?:undefined|\d+)$/m, `# OCR Repost ${discoveredId}`)
    .replace(/^- Posted message ID: (?:undefined|\d+)$/m, `- Posted message ID: ${discoveredId}`);
  await writeMarkdown(target.generatedFile, updatedMarkdown);
  target.postedMessageId = discoveredId;
  return discoveredId;
}

function computeDeterministicCleanup(targets) {
  const allParagraphs = [];

  for (const target of targets) {
    const paragraphs = splitParagraphs(target.text).map((text, index) => ({
      targetKey: target.key,
      sourceMessageId: target.sourceMessageId,
      index,
      original: text,
      normalized: normalizeTextForDupCompare(text)
    }));
    allParagraphs.push(...paragraphs);
  }

  return targets.map((target) => {
    const sanitizedText = stripKnownNoise(target.text);
    const targetParagraphs = splitParagraphs(sanitizedText).map((text, index) => ({
      targetKey: target.key,
      sourceMessageId: target.sourceMessageId,
      index,
      original: text,
      normalized: normalizeTextForDupCompare(text)
    }));
    const paragraphs = targetParagraphs;
    const kept = [];
    const removedTypes = new Set();
    const notes = [];

    if (sanitizedText !== target.text.trim()) {
      removedTypes.add('meta_prompt');
      notes.push('Removed known non-lore/meta sentence fragments.');
    }

    for (const paragraph of paragraphs) {
      if (!paragraph.normalized) {
        continue;
      }
      if (isNoiseParagraph(paragraph.original)) {
        removedTypes.add('meta_prompt');
        notes.push(`Removed non-lore/meta paragraph: "${paragraph.original.slice(0, 80)}"`);
        continue;
      }

      const dominated = allParagraphs.some((other) => (
        other.targetKey !== paragraph.targetKey &&
        isDominatedByOtherParagraph(paragraph, other)
      ));

      if (dominated) {
        removedTypes.add('cross_message_duplication');
        notes.push(`Removed paragraph duplicated more fully in another message: "${paragraph.original.slice(0, 80)}"`);
        continue;
      }

      const trimmedLeadingOverlap = trimLeadingCrossMessageOverlap(paragraph.original, allParagraphs, target);
      if (!trimmedLeadingOverlap) {
        removedTypes.add('cross_message_duplication');
        notes.push(`Removed leading overlap duplicated from an earlier message: "${paragraph.original.slice(0, 80)}"`);
        continue;
      }
      if (trimmedLeadingOverlap !== paragraph.original.trim()) {
        removedTypes.add('cross_message_duplication');
        notes.push(`Trimmed duplicated leading fragment from paragraph: "${paragraph.original.slice(0, 80)}"`);
      }

      kept.push(trimmedLeadingOverlap);
    }

    const cleanedText = joinParagraphs(kept);
    return {
      ...target,
      changed: cleanedText !== target.text.trim(),
      cleanedText,
      removedTypes: Array.from(removedTypes),
      notes: notes.join(' ')
    };
  });
}

async function collectLoreInputsFromStoredMarkdown(dirs) {
  const files = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
    .sort();

  const loreSources = [];
  const photoEntries = [];
  const characterMap = new Map();
  const generalEntries = [];
  const fileRecords = [];

  for (const name of files) {
    const filePath = path.join(dirs.messagesDir, name);
    const markdown = await readMarkdown(filePath);
    const messageIdMatch = markdown.match(/^- Message ID: (\d+)$/m);
    const messageId = messageIdMatch ? Number(messageIdMatch[1]) : null;
    const textSection = extractMessageSection(markdown, 'Text');
    const ocrSection = extractMessageSection(markdown, 'OCR');
    const photoSection = extractMessageSection(markdown, 'Photo');
    const visualDetails = readCharacterVisualDetails(markdown);
    const generatedOcrPath = messageId ? path.join(dirs.generatedDir, `${name.replace(/\.md$/u, '-ocr.md')}`) : null;
    const generatedOcrMetadata = generatedOcrPath && await fileExists(generatedOcrPath)
      ? await readGeneratedOcrMetadata(generatedOcrPath)
      : { hashtags: [], postedMessageId: null, extractedText: '' };
    const hashtags = ocrSection ? generatedOcrMetadata.hashtags : extractHashtags(markdown);
    const characterName = extractCharacterName(textSection);
    const structuredProfile = parseStructuredCharacterProfile(textSection);
    const taggedCharacterKeys = hashtagsToCharacterKeys(hashtags);
    const directCharacterKey = taggedCharacterKeys[0] || '';
    const isExcludedFromLore = hashtags.includes('#exclude_lore');
    const isGeneralLoreTagged = hashtags.includes('#general_lore');
    const isInstructionsTagged = hashtags.includes('#instructions');
    const hasExplicitRoutingTags = isExcludedFromLore || isGeneralLoreTagged || isInstructionsTagged || taggedCharacterKeys.length > 0;

    if (!isExcludedFromLore && textSection) {
      loreSources.push(textSection);
    }
    if (!isExcludedFromLore && ocrSection) {
      loreSources.push(ocrSection);
    }

    const narrativeParts = [textSection, ocrSection].filter(Boolean);
    const record = {
      filePath,
      fileName: name,
      sourceMessageId: messageId,
      hashtags,
      textSection,
      ocrSection,
      photoSection,
      narrativeText: narrativeParts.join('\n\n').trim(),
      directCharacterKey,
      taggedCharacterKeys,
      isExcludedFromLore,
      isGeneralLoreTagged,
      isInstructionsTagged,
      hasExplicitRoutingTags,
      image: null
    };
    fileRecords.push(record);
    if (taggedCharacterKeys.length > 0) {
      for (const characterKey of taggedCharacterKeys) {
        const current = characterMap.get(characterKey) || {
          key: characterKey,
          name: characterName || characterKey,
          sources: [],
          images: [],
          structuredProfile: null,
          completenessTier: 'partial'
        };
        if (characterName && (
          current.name === characterKey ||
          (current.name.length > characterName.length && structuredProfile)
        )) {
          current.name = characterName;
        }
        if (structuredProfile) {
          current.structuredProfile = structuredProfile;
        }
        if (narrativeParts.length > 0) {
          current.sources.push({
            sourceMessageId: messageId,
            text: narrativeParts.join('\n\n')
          });
        }
        characterMap.set(characterKey, current);
      }
    } else if (!isExcludedFromLore && isGeneralLoreTagged && narrativeParts.length > 0) {
      generalEntries.push({
        sourceMessageId: messageId,
        text: narrativeParts.join('\n\n')
      });
    }

    if (photoSection) {
      const imageMatch = photoSection.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\n\n([\s\S]*))?$/);
      if (imageMatch) {
        const caption = imageMatch[1].trim() || `Message ${messageId || 'unknown'} photo`;
        const sourceImagePath = path.resolve(path.dirname(filePath), imageMatch[2].trim());
        const relativeAssetPath = path.relative(dirs.generatedDir, sourceImagePath).split(path.sep).join('/');
        const description = String(imageMatch[3] || '').trim();
        const imageEntry = {
          sourceMessageId: messageId,
          caption,
          description,
          visualDetails,
          generatedRelativePath: relativeAssetPath,
          assetPath: sourceImagePath
        };
        record.image = imageEntry;
        photoEntries.push(
          [
            `### ${caption}`,
            '',
            messageId ? `Source message ID: ${messageId}` : 'Source message ID: unknown',
            '',
            `![${caption}](${relativeAssetPath})`,
            '',
            description || 'Photo preserved from the channel.'
          ].join('\n')
        );
        loreSources.push([caption, description].filter(Boolean).join('\n'));

        if (taggedCharacterKeys.length > 0) {
          for (const characterKey of taggedCharacterKeys) {
            const current = characterMap.get(characterKey) || {
              key: characterKey,
              name: characterName || characterKey,
              sources: [],
              images: [],
              structuredProfile: null,
              completenessTier: 'partial'
            };
            if (characterName && current.name === characterKey) {
              current.name = characterName;
            }
            current.images.push(imageEntry);
            characterMap.set(characterKey, current);
          }
        } else if (!isExcludedFromLore && isGeneralLoreTagged) {
          generalEntries.push({
            sourceMessageId: messageId,
            image: imageEntry
          });
        }
      }
    }
  }

  const instructionEntries = buildInstructionEntries(fileRecords);
  const characters = orderCharactersByInstructions(
    Array.from(characterMap.values()),
    instructionEntries
  );

  const charactersByKey = new Map(characters.map((character) => [character.key, character]));
  const routedRecords = fileRecords.map((record) => {
    const routedCharacterKeys = new Set();
    if (record.isExcludedFromLore) {
      return {
        ...record,
        routedCharacterKeys: []
      };
    }

    if (record.taggedCharacterKeys.length > 0) {
      for (const characterKey of record.taggedCharacterKeys) {
        if (charactersByKey.has(characterKey)) {
          routedCharacterKeys.add(characterKey);
        }
      }
    }

    return {
      ...record,
      routedCharacterKeys: Array.from(routedCharacterKeys)
    };
  });

  const enrichedCharacters = characters
    .map((character) => {
      const routedSources = routedRecords
        .filter((record) => (
          record.routedCharacterKeys.includes(character.key) &&
          record.narrativeText
        ))
        .map((record) => ({
          sourceMessageId: record.sourceMessageId,
          text: record.narrativeText,
          direct: record.directCharacterKey === character.key
        }));
      const routedImages = routedRecords
        .filter((record) => record.routedCharacterKeys.includes(character.key) && record.image)
        .map((record) => record.image);
      const substantiveSourceCount = routedSources.filter((source) => (
        isSubstantiveCharacterSource(source.text, character.name)
      )).length;

      let completenessTier = 'partial';
      if (character.structuredProfile) {
        completenessTier = 'full';
      } else if (substantiveSourceCount === 0 && routedImages.length > 0) {
        completenessTier = 'image_only';
      }

      return {
        ...character,
        sources: routedSources,
        images: routedImages,
        completenessTier
      };
    });
  const orderedCharacters = orderCharactersByInstructions(enrichedCharacters, instructionEntries);
  const charactersWithImages = await ensureTemporaryCharacterImages(dirs, orderedCharacters);

  await writeCharacterIndex(dirs, charactersWithImages);

  const sourceRouting = {
    instructions: instructionEntries.map((entry) => ({
      sourceMessageId: entry.sourceMessageId,
      filePath: entry.filePath,
      fileName: entry.fileName,
      parsed: entry.parsed
    })),
    generalLore: routedRecords
      .filter((record) => !record.isExcludedFromLore && record.isGeneralLoreTagged)
      .map((record) => ({
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        fileName: record.fileName,
        hashtags: record.hashtags,
        routedCharacterKeys: record.routedCharacterKeys
      })),
    pending: routedRecords
      .filter((record) => !record.isExcludedFromLore && !record.isGeneralLoreTagged && record.routedCharacterKeys.length === 0)
      .map((record) => ({
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        fileName: record.fileName,
        hashtags: record.hashtags
      })),
    characters: charactersWithImages.map((character) => ({
      name: character.name,
      key: character.key,
      completenessTier: character.completenessTier,
      sourceFiles: routedRecords
        .filter((record) => record.routedCharacterKeys.includes(character.key))
        .map((record) => ({
          sourceMessageId: record.sourceMessageId,
          filePath: record.filePath,
          fileName: record.fileName,
          hashtags: record.hashtags,
          direct: record.directCharacterKey === character.key
        }))
    }))
  };

  return {
    loreSources,
    photoEntries,
    characters: charactersWithImages,
    generalEntries,
    fileRecords: routedRecords,
    sourceRouting
  };
}

async function writeCharacterIndex(dirs, characters) {
  await fs.rm(dirs.charactersDir, { recursive: true, force: true });
  await fs.mkdir(dirs.charactersDir, { recursive: true });
  const index = [];

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
    index.push(manifest);
  }

  await fs.writeFile(
    path.join(dirs.generatedDir, 'character-index.json'),
    `${JSON.stringify({ characters: index }, null, 2)}\n`,
    'utf8'
  );
}

async function resolveDerivedContent(ctx, { message, messageFile, repostFile, media }) {
  if (!shouldOcrMedia(media)) {
    return null;
  }

  if (await fileExists(repostFile)) {
    const extractedText = await readExistingOcrText(repostFile);
    if (extractedText) {
      return { kind: 'screenshot', extractedText, cached: true };
    }
  }

  const existingPhoto = await readExistingPhotoMetadata(messageFile);
  if (existingPhoto && !shouldRefreshPhotoDescription(message, existingPhoto)) {
    return { ...existingPhoto, cached: true };
  }

  const analysis = await analyzeImage(
    ctx.openai,
    ctx.config.openAiOcrModel,
    media.path,
    { detail: isNamedCharacterPhotoMessage(message) ? 'high' : 'low' }
  );
  return { ...analysis, cached: false };
}

async function processMessages(ctx, messages, options = {}) {
  const { sendNewScreenshotPosts = true } = options;
  const processed = [];

  for (const message of messages) {
    if (shouldSkipArchivedSourceMessage(message)) {
      continue;
    }

    const stem = makeMessageStem(message);
    const messageFile = path.join(ctx.dirs.messagesDir, `${stem}.md`);
    const repostFile = path.join(ctx.dirs.generatedDir, `${stem}-ocr.md`);
    const media = await downloadMessageMedia(ctx.telegram, message, ctx.dirs.assetsDir, stem);
    const derivedContent = await resolveDerivedContent(ctx, { message, messageFile, repostFile, media });

    const markdown = buildMessageMarkdown({
      channelLabel: ctx.config.channelUsername,
      message,
      media,
      derivedContent,
      messageFile
    });
    await writeMarkdown(messageFile, markdown);

    if (
      sendNewScreenshotPosts &&
      derivedContent?.kind === 'screenshot' &&
      !derivedContent.cached &&
      !(await fileExists(repostFile))
    ) {
      const repostText = [`#${message.id}`, '', derivedContent.extractedText].join('\n');
      const postedMessage = ctx.config.telegramBotToken
        ? await sendTextViaBot({
            botToken: ctx.config.telegramBotToken,
            chatTarget: ctx.botChatId,
            text: repostText
          })
        : await postTextToChannel(ctx.telegram, ctx.entity, repostText);
      await writeMarkdown(
        repostFile,
        buildOcrMarkdown({
          channelLabel: ctx.config.channelUsername,
          sourceMessage: message,
          postedMessage,
          ocrText: derivedContent.extractedText
        })
      );
    }

    processed.push({ id: message.id, messageFile, repostFile, derivedKind: derivedContent?.kind || null });
  }

  return processed;
}

async function writeLoreOutputs(ctx, options = {}) {
  const { sendPdf = true } = options;
  const {
    loreSources,
    photoEntries,
    characters,
    generalEntries,
    fileRecords,
    sourceRouting
  } = await collectLoreInputsFromStoredMarkdown(ctx.dirs);
  const sourceBundle = {
    summary: {
      sourceTextBlockCount: loreSources.length,
      photoCount: photoEntries.length,
      characterCount: characters.length,
      instructionCount: sourceRouting.instructions.length
    },
    instructions: sourceRouting.instructions,
    generalLore: generalEntries.map((entry) => ({
      sourceMessageId: entry.sourceMessageId,
      text: entry.text || '',
      image: entry.image
        ? {
            caption: entry.image.caption,
            description: entry.image.description,
            generatedRelativePath: entry.image.generatedRelativePath
          }
        : null
    })),
    characters: characters.map((character) => ({
      name: character.name,
      completenessTier: character.completenessTier,
      structuredProfile: character.structuredProfile || null,
      sources: character.sources,
      images: character.images.map((image) => ({
        sourceMessageId: image.sourceMessageId,
        caption: image.caption,
        description: image.description,
        visualDetails: image.visualDetails || null,
        generatedRelativePath: image.generatedRelativePath
      }))
    }))
  };
  await fs.writeFile(
    path.join(ctx.dirs.generatedDir, 'source-routing.json'),
    `${JSON.stringify(sourceRouting, null, 2)}\n`,
    'utf8'
  );

  const generalFileRecords = fileRecords.filter((record) => (
    !record.isExcludedFromLore &&
    record.isGeneralLoreTagged
  ));
  const generalBundle = {
    summary: sourceBundle.summary,
    instructions: sourceRouting.instructions,
    entries: generalFileRecords.map((record) => ({
      sourceMessageId: record.sourceMessageId,
      filePath: record.filePath,
      text: record.narrativeText,
      image: record.image
        ? {
            caption: record.image.caption,
            description: record.image.description,
            generatedRelativePath: record.image.generatedRelativePath
          }
        : null,
      routedCharacterKeys: record.routedCharacterKeys
    }))
  };
  const generalLoreMarkdown = await createGeneralLoreSection(
    ctx.openai,
    ctx.config.openAiLoreModel,
    generalBundle
  );
  await writeMarkdown(
    path.join(ctx.dirs.generatedDir, 'general-lore-context.md'),
    `${generalLoreMarkdown.trim()}\n`
  );

  const characterSectionMarkdowns = [];
  for (const character of characters) {
    const routedFiles = fileRecords.filter((record) => record.routedCharacterKeys.includes(character.key));
    const characterBundle = {
      name: character.name,
      key: character.key,
      completenessTier: character.completenessTier,
      structuredProfile: character.structuredProfile || null,
      instructions: sourceRouting.instructions,
      generalContext: generalLoreMarkdown,
      sources: routedFiles.map((record) => ({
        sourceMessageId: record.sourceMessageId,
        filePath: record.filePath,
        directCharacterMatch: record.directCharacterKey === character.key,
        text: record.narrativeText,
        image: record.image
          ? {
              caption: record.image.caption,
              description: record.image.description,
              visualDetails: record.image.visualDetails || null,
              generatedRelativePath: record.image.generatedRelativePath
            }
          : null
      })),
      images: character.images.map((image) => ({
        sourceMessageId: image.sourceMessageId,
        caption: image.caption,
        description: image.description,
        visualDetails: image.visualDetails || null,
        generatedRelativePath: image.generatedRelativePath
      }))
    };
    const characterMarkdown = await createCharacterLoreSection(
      ctx.openai,
      ctx.config.openAiLoreModel,
      characterBundle
    );
    characterSectionMarkdowns.push(characterMarkdown.trim());
  }

  const composedLoreMarkdown = [
    '# Лор мира Золотого Кордицепса',
    '',
    generalLoreMarkdown.trim(),
    '',
    '## Персонажи',
    '',
    characterSectionMarkdowns.join('\n\n---\n\n')
  ].join('\n');
  const finalLoreMarkdown = `${normalizeGeneratedLoreMarkdown(composedLoreMarkdown, sourceBundle).trim()}\n`;
  const lorePath = path.join(ctx.dirs.generatedDir, 'mushroom-lore.md');
  await writeMarkdown(lorePath, finalLoreMarkdown);

  const { htmlPath, pdfPath, pageImagesDir, manifestPath: pageImagesManifestPath } = await renderMarkdownToHtmlAndPdf(
    finalLoreMarkdown,
    'Грибной лор',
    ctx.dirs.generatedDir
  );

  const botResults = sendPdf
    ? await sendPdfViaBot({
      botToken: ctx.config.telegramBotToken,
      pdfPath,
      caption: `Грибной лор для ${ctx.config.channelUsername}`,
      channelUsername: ctx.config.channelUsername,
      channelChatId: ctx.botChatId,
        adminChatIds: ctx.config.adminChatIds,
        sendToChannel: ctx.config.botSendToChannel
      })
    : [];

  return { lorePath, htmlPath, pdfPath, pageImagesDir, pageImagesManifestPath, botResults };
}

export async function createWorkflowContext(config = defaultConfig) {
  const dirs = await ensureChannelDirs(slugify(config.channelUsername));
  const openai = createOpenAiClient(config.openAiApiKey);
  const telegram = await createTelegramClient({
    apiId: config.telegramApiId,
    apiHash: config.telegramApiHash,
    stringSession: config.clientToken
  });
  const entity = await getChannelEntity(telegram, config.channelUsername);
  const botChatId = resolveBotChatId(entity, config.channelUsername);

  return { config, dirs, openai, telegram, entity, botChatId };
}

export async function disposeWorkflowContext(ctx) {
  await ctx.telegram.disconnect();
}

export async function runIncrementalFetch(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const highestProcessedSourceMessageId = await findHighestProcessedSourceMessageId(ctx.dirs.generatedDir);
    const messages = await fetchChannelMessages(ctx.telegram, ctx.entity, ctx.config.messageLimit, {
      minSourceMessageIdExclusive: 0
    });
    const removedSourceMessageIds = await reconcileStoredMessages(ctx, messages);
    const processed = await processMessages(ctx, messages, { sendNewScreenshotPosts: true });
    const outputs = await writeLoreOutputs(ctx, { sendPdf: true });
    return {
      fetchedCount: messages.length,
      newSourceMessageCount: messages.filter((message) => message.id > highestProcessedSourceMessageId).length,
      removedSourceMessageIds,
      processed,
      ...outputs
    };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function runFullRegeneration(config = defaultConfig, options = {}) {
  const ctx = await createWorkflowContext(config);
  try {
    const messages = await fetchChannelMessages(ctx.telegram, ctx.entity, ctx.config.messageLimit, {
      minSourceMessageIdExclusive: 0
    });
    const removedSourceMessageIds = await reconcileStoredMessages(ctx, messages);
    const processed = await processMessages(ctx, messages, { sendNewScreenshotPosts: true });
    const outputs = await writeLoreOutputs(ctx, { sendPdf: options.sendPdf ?? true });
    return {
      fetchedCount: messages.length,
      removedSourceMessageIds,
      processed,
      ...outputs
    };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function refreshSpecificMessages(messageIds, config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const messages = await fetchChannelMessagesByIds(ctx.telegram, ctx.entity, messageIds);
    const processed = await processMessages(ctx, messages, { sendNewScreenshotPosts: false });
    return { processed };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function updateTextMessageById(messageId, text, config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const existingMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
    if (!existingMessage) {
      throw new Error(`Message ${messageId} not found.`);
    }
    if (!isEditableTextSourceMessage(existingMessage)) {
      throw new Error(`Message ${messageId} is not an editable source text message.`);
    }

    const existingParsed = parseTaggedMessageText(existingMessage.message);
    await editChannelMessageText(
      ctx.telegram,
      ctx.entity,
      messageId,
      composeTaggedMessageText(text, existingParsed.hashtags)
    );
    const refreshedMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
    if (!refreshedMessage) {
      throw new Error(`Message ${messageId} not found after update.`);
    }
    const processed = await processMessages(ctx, [refreshedMessage], { sendNewScreenshotPosts: false });
    return processed[0] || null;
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function setMessageHashtagsById(messageId, hashtags, config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const existingMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
    if (!existingMessage) {
      throw new Error(`Message ${messageId} not found.`);
    }
    if (!isEditableTextSourceMessage(existingMessage)) {
      throw new Error(`Message ${messageId} is not an editable source text message.`);
    }

    const existingParsed = parseTaggedMessageText(existingMessage.message);
    const updatedText = composeTaggedMessageText(existingParsed.text, hashtags);
    await editChannelMessageText(ctx.telegram, ctx.entity, messageId, updatedText);
    const refreshedMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
    if (!refreshedMessage) {
      throw new Error(`Message ${messageId} not found after hashtag update.`);
    }
    const processed = await processMessages(ctx, [refreshedMessage], { sendNewScreenshotPosts: false });
    return processed[0] || null;
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function setMessageHashtagsBatch(updates, config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const refreshedMessages = [];
    const results = [];

    for (const update of updates) {
      const messageId = Number(update?.messageId);
      const hashtags = Array.isArray(update?.hashtags) ? update.hashtags : [];
      const existingMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
      if (!existingMessage) {
        results.push({ messageId, ok: false, error: `Message ${messageId} not found.` });
        continue;
      }
      if (!isEditableTextSourceMessage(existingMessage)) {
        results.push({ messageId, ok: false, error: `Message ${messageId} is not an editable source text message.` });
        continue;
      }

      try {
        const existingParsed = parseTaggedMessageText(existingMessage.message);
        const updatedText = composeTaggedMessageText(existingParsed.text, hashtags);
        await editChannelMessageText(ctx.telegram, ctx.entity, messageId, updatedText);
        const refreshedMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
        if (!refreshedMessage) {
          results.push({ messageId, ok: false, error: `Message ${messageId} not found after hashtag update.` });
          continue;
        }
        refreshedMessages.push(refreshedMessage);
        results.push({ messageId, ok: true, error: null });
      } catch (error) {
        results.push({ messageId, ok: false, error: error?.message || String(error) });
      }
    }

    const processed = refreshedMessages.length > 0
      ? await processMessages(ctx, refreshedMessages, { sendNewScreenshotPosts: false })
      : [];
    const processedById = new Map(processed.map((item) => [item.id, item]));

    return results.map((item) => ({
      ...item,
      processed: processedById.get(item.messageId) || null
    }));
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function clearMessageHashtagsBatch(messageIds, config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const refreshedMessages = [];
    const results = [];

    for (const rawId of messageIds) {
      const messageId = Number(rawId);
      const existingMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
      if (!existingMessage) {
        results.push({ messageId, ok: false, error: `Message ${messageId} not found.` });
        continue;
      }

      try {
        const existingParsed = parseTaggedMessageText(existingMessage.message);
        await editChannelMessageText(ctx.telegram, ctx.entity, messageId, existingParsed.text);
        const refreshedMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, messageId);
        if (!refreshedMessage) {
          results.push({ messageId, ok: false, error: `Message ${messageId} not found after hashtag cleanup.` });
          continue;
        }
        refreshedMessages.push(refreshedMessage);
        results.push({ messageId, ok: true, error: null });
      } catch (error) {
        results.push({ messageId, ok: false, error: error?.message || String(error) });
      }
    }

    const processed = refreshedMessages.length > 0
      ? await processMessages(ctx, refreshedMessages, { sendNewScreenshotPosts: false })
      : [];
    const processedById = new Map(processed.map((item) => [item.id, item]));

    return results.map((item) => ({
      ...item,
      processed: processedById.get(item.messageId) || null
    }));
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function setOcrHashtagsBatch(updates, config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const results = [];

    for (const update of updates) {
      const sourceMessageId = Number(update?.sourceMessageId);
      const hashtags = Array.isArray(update?.hashtags) ? update.hashtags : [];
      const generatedFiles = (await fs.readdir(ctx.dirs.generatedDir))
        .filter((name) => name.endsWith(`-${sourceMessageId}-ocr.md`));
      const generatedFile = generatedFiles[0] ? path.join(ctx.dirs.generatedDir, generatedFiles[0]) : null;
      if (!generatedFile) {
        results.push({ sourceMessageId, ok: false, error: `No OCR repost record for source ${sourceMessageId}.` });
        continue;
      }

      const metadata = await readGeneratedOcrMetadata(generatedFile);
      if (!metadata.postedMessageId) {
        results.push({ sourceMessageId, ok: false, error: `No posted message ID for source ${sourceMessageId}.` });
        continue;
      }

      try {
        const repostText = composeOcrRepostText(sourceMessageId, metadata.extractedText, hashtags);
        await editTextViaBot({
          botToken: ctx.config.telegramBotToken,
          chatTarget: ctx.botChatId,
          messageId: metadata.postedMessageId,
          text: repostText
        });

        const generatedMarkdown = await readMarkdown(generatedFile);
        let updatedMarkdown = generatedMarkdown;
        if (metadata.hashtags.length > 0 || hashtags.length > 0) {
          updatedMarkdown = replaceSection(updatedMarkdown, 'Hashtags', hashtags.join(' '));
          if (!/## Hashtags\n\n/m.test(updatedMarkdown)) {
            if (/^- Content hash: /m.test(updatedMarkdown)) {
              updatedMarkdown = updatedMarkdown.replace(
                /^(- Content hash: [^\n]+\n)/m,
                `$1\n## Hashtags\n\n${hashtags.join(' ')}\n`
              );
            } else {
              updatedMarkdown = updatedMarkdown.replace(
                /^(- Date: [^\n]+\n)/m,
                `$1\n## Hashtags\n\n${hashtags.join(' ')}\n`
              );
            }
          }
        }
        if (hashtags.length === 0 && /## Hashtags\n\n/m.test(updatedMarkdown)) {
          updatedMarkdown = updatedMarkdown.replace(/\n## Hashtags\n\n[\s\S]*?(?=\n## |\n# |$)/m, '\n');
        }
        await writeMarkdown(generatedFile, updatedMarkdown.trimEnd() + '\n');
        results.push({ sourceMessageId, ok: true, error: null, generatedFile, postedMessageId: metadata.postedMessageId });
      } catch (error) {
        results.push({ sourceMessageId, ok: false, error: error?.message || String(error) });
      }
    }

    return results;
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function cleanDuplicateTextMessages(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const candidates = await loadDeterministicCleanupTargets(ctx.dirs);
    const results = computeDeterministicCleanup(candidates);
    const reportEntries = [];
    const changedIds = [];

    for (const result of results) {
      const cleanedText = result.changed ? result.cleanedText : result.text;
      const originalMarkdown = await readMarkdown(result.messageFile);

      if (result.kind === 'text' && result.changed) {
        await editChannelMessageText(ctx.telegram, ctx.entity, result.sourceMessageId, cleanedText);
        const updatedMarkdown = replaceSection(originalMarkdown, 'Text', cleanedText);
        await writeMarkdown(result.messageFile, updatedMarkdown);
      } else if (result.kind === 'ocr') {
        if (result.changed) {
          const updatedMessageMarkdown = replaceSection(originalMarkdown, 'OCR', cleanedText);
          await writeMarkdown(result.messageFile, updatedMessageMarkdown);

          if (result.generatedFile) {
            const generatedMarkdown = await readMarkdown(result.generatedFile);
            const updatedGeneratedMarkdown = replaceSection(generatedMarkdown, 'Extracted Text', cleanedText);
            await writeMarkdown(result.generatedFile, updatedGeneratedMarkdown);
          }
        }

        const postedMessageId = await syncPostedMessageId(ctx, result);
        if (ctx.config.telegramBotToken && postedMessageId) {
          if (!cleanedText) {
            await deleteMessageViaBot({
              botToken: ctx.config.telegramBotToken,
              chatTarget: ctx.botChatId,
              messageId: postedMessageId
            });
          } else {
            const liveMessage = await fetchChannelMessageById(ctx.telegram, ctx.entity, postedMessageId);
            const expectedText = [`#${result.sourceMessageId}`, '', cleanedText].join('\n');
            if (String(liveMessage?.message || '').trim() !== expectedText.trim()) {
              await editTextViaBot({
                botToken: ctx.config.telegramBotToken,
                chatTarget: ctx.botChatId,
                messageId: postedMessageId,
                text: expectedText
              });
            }
          }
        }
      }

      if (result.changed) {
        changedIds.push(result.sourceMessageId);
        reportEntries.push(
          [
            `## Message ${result.sourceMessageId} (${result.kind})`,
            '',
            '**Cleanup Types**',
            '',
            result.removedTypes.length > 0 ? result.removedTypes.join(', ') : 'unspecified',
            '',
            '**Notes**',
            '',
            result.notes || 'Deterministic cross-message cleanup applied.',
            '',
            '**Original**',
            '',
            '```text',
            result.text,
            '```',
            '',
            '**Cleaned**',
            '',
            '```text',
            cleanedText,
            '```'
          ].join('\n')
        );
      }
    }

    const reportPath = path.join(ctx.dirs.reportsDir, 'duplicate-cleanup-report.md');
    const reportContent = [
      '# Duplicate Cleanup Report',
      '',
      `Affected messages: ${changedIds.length}`,
      '',
      changedIds.length > 0 ? reportEntries.join('\n\n') : 'No duplicate-heavy text messages required changes.'
    ].join('\n');
    await writeMarkdown(reportPath, `${reportContent}\n`);

    return { changedIds, reportPath };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function backfillPostedMessageIds(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const targets = await loadDeterministicCleanupTargets(ctx.dirs);
    const repaired = [];

    for (const target of targets) {
      if (target.kind !== 'ocr' || !target.generatedFile) {
        continue;
      }

      const previousId = target.postedMessageId;
      const syncedId = await syncPostedMessageId(ctx, target);
      if (syncedId && syncedId !== previousId) {
        repaired.push({
          sourceMessageId: target.sourceMessageId,
          previousId,
          syncedId
        });
      }
    }

    const reportPath = path.join(ctx.dirs.reportsDir, 'posted-message-id-backfill.md');
    const reportContent = [
      '# Posted Message ID Backfill',
      '',
      `Updated records: ${repaired.length}`,
      '',
      repaired.length === 0
        ? 'No OCR repost metadata required changes.'
        : repaired
            .map((item) => `- Source message ${item.sourceMessageId}: ${item.previousId ?? 'missing'} -> ${item.syncedId}`)
            .join('\n')
    ].join('\n');
    await writeMarkdown(reportPath, `${reportContent}\n`);

    return { repaired, reportPath };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function rebuildOcrReposts(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const targets = (await loadDeterministicCleanupTargets(ctx.dirs))
      .filter((target) => target.kind === 'ocr' && target.generatedFile)
      .sort((a, b) => a.sourceMessageId - b.sourceMessageId);

    const existingPostedIds = new Set();
    for (const target of targets) {
      const syncedId = await syncPostedMessageId(ctx, target);
      if (syncedId) {
        existingPostedIds.add(syncedId);
      }
    }

    for (const messageId of Array.from(existingPostedIds).sort((a, b) => b - a)) {
      await deleteMessageViaBot({
        botToken: ctx.config.telegramBotToken,
        chatTarget: ctx.botChatId,
        messageId
      });
    }

    const rebuilt = [];
    for (const target of targets) {
      const cleanedText = target.text.trim();
      const generatedMarkdown = await readMarkdown(target.generatedFile);

      if (!cleanedText) {
        const clearedMarkdown = generatedMarkdown
          .replace(/^# OCR Repost (?:undefined|\d+)$/m, '# OCR Repost undefined')
          .replace(/^- Posted message ID: (?:undefined|\d+)$/m, '- Posted message ID: undefined');
        await writeMarkdown(target.generatedFile, replaceSection(clearedMarkdown, 'Extracted Text', ''));
        rebuilt.push({ sourceMessageId: target.sourceMessageId, postedMessageId: null, deletedOnly: true });
        continue;
      }

      const postedMessage = await sendTextViaBot({
        botToken: ctx.config.telegramBotToken,
        chatTarget: ctx.botChatId,
        text: [`#${target.sourceMessageId}`, '', cleanedText].join('\n')
      });
      const postedMessageId = postedMessage?.id ?? postedMessage?.message_id;
      const updatedMarkdown = replaceSection(
        generatedMarkdown
          .replace(/^# OCR Repost (?:undefined|\d+)$/m, `# OCR Repost ${postedMessageId}`)
          .replace(/^- Posted message ID: (?:undefined|\d+)$/m, `- Posted message ID: ${postedMessageId}`)
          .replace(/^- Date: .+$/m, `- Date: ${messageDateToIso(postedMessage?.date || new Date())}`),
        'Extracted Text',
        cleanedText
      );
      await writeMarkdown(target.generatedFile, updatedMarkdown);
      rebuilt.push({ sourceMessageId: target.sourceMessageId, postedMessageId, deletedOnly: false });
    }

    const reportPath = path.join(ctx.dirs.reportsDir, 'ocr-rebuild-report.md');
    const reportContent = [
      '# OCR Rebuild Report',
      '',
      `Rebuilt records: ${rebuilt.length}`,
      '',
      ...rebuilt.map((item) => (
        item.deletedOnly
          ? `- Source message ${item.sourceMessageId}: deleted live repost and left metadata empty`
          : `- Source message ${item.sourceMessageId}: reposted as ${item.postedMessageId}`
      ))
    ].join('\n');
    await writeMarkdown(reportPath, `${reportContent}\n`);

    return { rebuilt, reportPath };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function createLorePromptAnalysisReport(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const messageFiles = (await fs.readdir(ctx.dirs.messagesDir))
      .filter((name) => name.endsWith('.md'))
      .sort();
    const sourceMarkdownParts = [];

    for (const name of messageFiles) {
      sourceMarkdownParts.push(await readMarkdown(path.join(ctx.dirs.messagesDir, name)));
    }

    const loreMarkdown = await readMarkdown(path.join(ctx.dirs.generatedDir, 'mushroom-lore.md'));
    const report = await analyzeLorePromptReport(
      ctx.openai,
      ctx.config.openAiLoreModel,
      sourceMarkdownParts.join('\n\n---\n\n'),
      loreMarkdown
    );
    const reportPath = path.join(ctx.dirs.reportsDir, 'lore-prompt-analysis.md');
    await writeMarkdown(reportPath, `${report}\n`);
    return { reportPath };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function createPdfStructureAnalysisReport(config = defaultConfig) {
  const dirs = await ensureChannelDirs(slugify(config.channelUsername));
  const messagesDir = dirs.messagesDir;
  const lorePath = path.join(dirs.generatedDir, 'mushroom-lore.md');
  const pageImagesDir = path.join(dirs.generatedDir, 'page-images');
  const pageImagesManifestPath = path.join(pageImagesDir, 'manifest.json');

  let pageManifest = null;
  try {
    pageManifest = JSON.parse(await fs.readFile(pageImagesManifestPath, 'utf8'));
  } catch {
    pageManifest = null;
  }

  const pageLines = Array.isArray(pageManifest?.pages)
    ? pageManifest.pages.map((page) => (
        `- Page ${page.pageNumber}: ${path.join(pageImagesDir, page.fileName)}`
      ))
    : ['- No page image manifest found. Run `npm run regenerate` first.'];

  const report = [
    '# PDF Structure Analysis',
    '',
    '## Findings',
    '',
    '- This report is now a deterministic review packet for a future agent pass, not an OpenAI API-generated critique.',
    '- Read the source markdown files first before judging whether the generated PDF structure is correct.',
    '- Use the listed page screenshots as the primary visual source of truth when reviewing layout quality.',
    pageManifest?.pageCount
      ? `- Rendered page screenshots available: ${pageManifest.pageCount}`
      : '- Rendered page screenshots are not available yet.',
    '',
    '## Layout Recommendations',
    '',
    '- Review each page for whitespace balance, awkward empty zones, broken section transitions, oversized images, and image/text imbalance.',
    '- Check whether each character intro keeps the main image adjacent to the correct overview text.',
    '- Verify that portrait images stay compact enough to leave room for text and that landscape images do not dominate the page.',
    '',
    '## Content Organization Recommendations',
    '',
    '- Confirm that each character dossier starts with the canonical intro image, then `Обзор`, then the remaining subsections.',
    '- Check that repeated headings, misplaced images, or orphaned subsections are not introduced by markdown normalization.',
    '- Verify that general lore pages and character pages feel visually distinct and follow a stable order.',
    '',
    '## Renderer Adjustment Suggestions',
    '',
    '- If a page has an oversized empty region, adjust intro image max-height or column proportions before changing content.',
    '- If an image appears detached from its character intro, inspect the normalized markdown and rendered `character-intro` block first.',
    '- If a page image background or crop looks wrong, compare the screenshot page with the HTML block rather than assuming the PDF itself is wrong.',
    '',
    '## Review Instructions',
    '',
    'Use this checklist in a manual agent review pass:',
    '',
    '1. Read the source message markdown files first to understand the intended lore content, character coverage, and source image context.',
    '2. Open the rendered page screenshots and inspect them in page order.',
    '3. Compare each page screenshot against the normalized generated markdown only when the visual result looks wrong.',
    '4. Prioritize visible layout failures over prompt intent: whitespace, breaks, hierarchy, image placement, and readability.',
    '5. For every issue, identify whether the cause is source coverage, markdown structure, deterministic normalization, or renderer CSS.',
    '6. Propose fixes at the lowest reliable layer first: renderer/layout before prompt changes, deterministic normalization before model prompt changes.',
    '7. Treat the canonical character manifests as the source of truth for which intro image belongs to which character.',
    '',
    'Review targets:',
    '',
    `- Source markdown dir: ${messagesDir}`,
    `- Character manifests dir: ${dirs.charactersDir}`,
    `- Markdown: ${lorePath}`,
    `- Page images manifest: ${pageImagesManifestPath}`,
    ...pageLines
  ].join('\n');

  const reportPath = path.join(dirs.reportsDir, 'pdf-structure-analysis.md');
  await writeMarkdown(reportPath, `${report}\n`);
  return { reportPath };
}
