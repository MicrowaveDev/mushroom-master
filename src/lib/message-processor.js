import fs from 'node:fs/promises';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { readMarkdown, writeMarkdown, fileExists, makeMessageStem } from './storage.js';
import {
  extractMessageSection,
  extractHashtags,
  extractMessageIdFromMarkdown,
  parseTaggedMessageText,
  parseOcrRepostText
} from './markdown-parser.js';
import { extractCharacterName } from './character.js';
import { analyzeImage } from './openai.js';
import { deleteMessageViaBot, sendTextViaBot } from './bot.js';
import {
  downloadMessageMedia,
  postTextToChannel,
  shouldOcrMedia
} from './telegram.js';

export function messageDateToIso(rawDate) {
  const date = rawDate instanceof Date
    ? rawDate
    : typeof rawDate === 'number'
      ? new Date(rawDate * 1000)
      : new Date(rawDate);
  return Number.isNaN(date.getTime()) ? 'unknown-date' : date.toISOString();
}

export function resolveBotChatId(entity, fallbackChannelInput) {
  const rawId = String(entity?.id || '').trim();
  if (/^\d+$/.test(rawId)) {
    return `-100${rawId}`;
  }
  if (/^-100\d+$/.test(rawId)) {
    return rawId;
  }
  return fallbackChannelInput;
}

export function isEditableTextSourceMessage(message) {
  const text = String(message?.message || '').trim();
  const mimeType = String(message?.file?.mimeType || '').toLowerCase();
  return Boolean(text) && !message?.media && !/^#\d+\b/.test(text) && mimeType !== 'application/pdf';
}

export function shouldSkipArchivedSourceMessage(message) {
  const text = String(message?.message || '').trim();
  const mimeType = String(message?.file?.mimeType || '').toLowerCase();
  return mimeType === 'application/pdf' || /^#\d+\b/.test(text) || text.includes('Mushroom lore digest');
}

function readExistingHashtagsFromFile(messageFile) {
  try {
    const markdown = readFileSync(messageFile, 'utf8');
    return extractHashtags(markdown);
  } catch {
    return [];
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

async function readExistingOcrText(messageFile) {
  try {
    const markdown = await readMarkdown(messageFile);
    const match = markdown.match(/^## OCR\n\n([\s\S]*?)(?:\n## |\n# |$)/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
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

export function buildMessageMarkdown({ channelLabel, message, media, derivedContent, messageFile }) {
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

async function resolveDerivedContent(ctx, { message, messageFile, media }) {
  if (!shouldOcrMedia(media)) {
    return null;
  }

  const existingOcr = await readExistingOcrText(messageFile);
  if (existingOcr) {
    return { kind: 'screenshot', extractedText: existingOcr, cached: true };
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

export async function processMessages(ctx, messages, options = {}) {
  const { sendNewScreenshotPosts = true } = options;
  const processed = [];

  for (const message of messages) {
    if (shouldSkipArchivedSourceMessage(message)) {
      continue;
    }

    const stem = makeMessageStem(message);
    const messageFile = path.join(ctx.dirs.messagesDir, `${stem}.md`);
    const media = await downloadMessageMedia(ctx.telegram, message, ctx.dirs.assetsDir, stem);
    const derivedContent = await resolveDerivedContent(ctx, { message, messageFile, media });

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
      !derivedContent.cached
    ) {
      const repostText = [`#${message.id}`, '', derivedContent.extractedText].join('\n');
      const postedMessage = ctx.config.telegramBotToken
        ? await sendTextViaBot({
            botToken: ctx.config.telegramBotToken,
            chatTarget: ctx.botChatId,
            text: repostText
          })
        : await postTextToChannel(ctx.telegram, ctx.entity, repostText);
    }

    processed.push({ id: message.id, messageFile, derivedKind: derivedContent?.kind || null });
  }

  return processed;
}

export async function collectStoredMessageArtifacts(dirs) {
  const messageFiles = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
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
      assetPaths
    });
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

export async function reconcileStoredMessages(ctx, messages) {
  const currentIds = new Set(messages.map((message) => Number(message.id)));
  const storedRecords = await collectStoredMessageArtifacts(ctx.dirs);
  const removedSourceMessageIds = [];

  for (const record of storedRecords) {
    if (currentIds.has(record.sourceMessageId)) {
      continue;
    }

    if (record.messageFile) {
      await unlinkIfExists(record.messageFile);
    }
    for (const assetPath of record.assetPaths) {
      await unlinkIfExists(assetPath);
    }

    removedSourceMessageIds.push(record.sourceMessageId);
  }

  return removedSourceMessageIds.sort((a, b) => a - b);
}
