import fs from 'node:fs/promises';
import path from 'node:path';
import { config as defaultConfig } from '../config.js';
import {
  analyzeImage,
  analyzeLorePromptReport,
  analyzePdfStructureReport,
  cleanLoreMessages,
  createMushroomLore,
  createOpenAiClient
} from './openai.js';
import { sendPdfViaBot, sendTextViaBot } from './bot.js';
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
      description: String(match[3] || '').trim()
    };
  } catch {
    return null;
  }
}

function buildMessageMarkdown({ channelLabel, message, media, derivedContent, messageFile }) {
  const lines = [
    `# Message ${message.id}`,
    '',
    `- Channel: ${channelLabel}`,
    `- Date: ${messageDateToIso(message.date)}`,
    `- Message ID: ${message.id}`
  ];

  if (message.message) {
    lines.push('', '## Text', '', message.message.trim());
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
  }

  return `${lines.join('\n')}\n`;
}

function buildOcrMarkdown({ channelLabel, sourceMessage, postedMessage, ocrText }) {
  return [
    `# OCR Repost ${postedMessage.id}`,
    '',
    `- Channel: ${channelLabel}`,
    `- Source message ID: ${sourceMessage.id}`,
    `- Posted message ID: ${postedMessage.id}`,
    `- Date: ${messageDateToIso(postedMessage.date)}`,
    '',
    '## Extracted Text',
    '',
    ocrText.trim(),
    ''
  ].join('\n');
}

function extractSection(markdown, title) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^## ${escapedTitle}\\n\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`, 'm'));
  return match ? match[1].trim() : '';
}

async function collectLoreInputsFromStoredMarkdown(dirs) {
  const files = (await fs.readdir(dirs.messagesDir))
    .filter((name) => name.endsWith('.md'))
    .sort();

  const loreSources = [];
  const photoEntries = [];

  for (const name of files) {
    const filePath = path.join(dirs.messagesDir, name);
    const markdown = await readMarkdown(filePath);
    const messageIdMatch = markdown.match(/^- Message ID: (\d+)$/m);
    const messageId = messageIdMatch ? Number(messageIdMatch[1]) : null;
    const textSection = extractSection(markdown, 'Text');
    const ocrSection = extractSection(markdown, 'OCR');
    const photoSection = extractSection(markdown, 'Photo');

    if (textSection) {
      loreSources.push(textSection);
    }
    if (ocrSection) {
      loreSources.push(ocrSection);
    }

    if (photoSection) {
      const imageMatch = photoSection.match(/^!\[([^\]]*)\]\(([^)]+)\)(?:\n\n([\s\S]*))?$/);
      if (imageMatch) {
        const caption = imageMatch[1].trim() || `Message ${messageId || 'unknown'} photo`;
        const sourceImagePath = path.resolve(path.dirname(filePath), imageMatch[2].trim());
        const relativeAssetPath = path.relative(dirs.generatedDir, sourceImagePath).split(path.sep).join('/');
        const description = String(imageMatch[3] || '').trim();
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
      }
    }
  }

  return { loreSources, photoEntries };
}

async function resolveDerivedContent(ctx, { messageFile, repostFile, media }) {
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
  if (existingPhoto) {
    return { ...existingPhoto, cached: true };
  }

  const analysis = await analyzeImage(ctx.openai, ctx.config.openAiOcrModel, media.path);
  return { ...analysis, cached: false };
}

async function processMessages(ctx, messages, options = {}) {
  const { sendNewScreenshotPosts = true } = options;
  const processed = [];

  for (const message of messages) {
    const stem = makeMessageStem(message);
    const messageFile = path.join(ctx.dirs.messagesDir, `${stem}.md`);
    const repostFile = path.join(ctx.dirs.generatedDir, `${stem}-ocr.md`);
    const media = await downloadMessageMedia(ctx.telegram, message, ctx.dirs.assetsDir, stem);
    const derivedContent = await resolveDerivedContent(ctx, { messageFile, repostFile, media });

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
  const { loreSources, photoEntries } = await collectLoreInputsFromStoredMarkdown(ctx.dirs);
  const loreMarkdown = await createMushroomLore(
    ctx.openai,
    ctx.config.openAiLoreModel,
    loreSources,
    photoEntries
  );
  const finalLoreMarkdown = photoEntries.length > 0
    ? `${loreMarkdown}\n\n## Source Images\n\n${photoEntries.join('\n\n')}\n`
    : `${loreMarkdown}\n`;
  const lorePath = path.join(ctx.dirs.generatedDir, 'mushroom-lore.md');
  await writeMarkdown(lorePath, finalLoreMarkdown);

  const { htmlPath, pdfPath } = await renderMarkdownToHtmlAndPdf(
    finalLoreMarkdown,
    'Mushroom Lore',
    ctx.dirs.generatedDir
  );

  const botResults = sendPdf
    ? await sendPdfViaBot({
        botToken: ctx.config.telegramBotToken,
        pdfPath,
        caption: `Mushroom lore digest for ${ctx.config.channelUsername}`,
        channelUsername: ctx.config.channelUsername,
        channelChatId: ctx.botChatId,
        adminChatIds: ctx.config.adminChatIds,
        sendToChannel: ctx.config.botSendToChannel
      })
    : [];

  return { lorePath, htmlPath, pdfPath, botResults };
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
      minSourceMessageIdExclusive: highestProcessedSourceMessageId
    });
    const processed = await processMessages(ctx, messages, { sendNewScreenshotPosts: true });
    const outputs = await writeLoreOutputs(ctx, { sendPdf: true });
    return {
      fetchedCount: messages.length,
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
    const processed = await processMessages(ctx, messages, { sendNewScreenshotPosts: true });
    const outputs = await writeLoreOutputs(ctx, { sendPdf: options.sendPdf ?? true });
    return {
      fetchedCount: messages.length,
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

    await editChannelMessageText(ctx.telegram, ctx.entity, messageId, text);
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

export async function cleanDuplicateTextMessages(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const messages = await fetchChannelMessages(ctx.telegram, ctx.entity, ctx.config.messageLimit, {
      minSourceMessageIdExclusive: 0
    });
    const candidates = messages.filter((message) => !message.media && String(message.message || '').trim());
    const reportEntries = [];
    const changedIds = [];
    const analysisResults = await cleanLoreMessages(
      ctx.openai,
      ctx.config.openAiLoreModel,
      candidates.map((message) => ({
        id: message.id,
        text: String(message.message || '').trim()
      }))
    );
    const resultsById = new Map(analysisResults.map((entry) => [entry.id, entry]));

    for (const message of candidates) {
      const originalText = String(message.message || '').trim();
      const result = resultsById.get(message.id);
      if (result?.changed && result.cleanedText && result.cleanedText !== originalText) {
        await editChannelMessageText(ctx.telegram, ctx.entity, message.id, result.cleanedText);
        changedIds.push(message.id);
        reportEntries.push(
          [
            `## Message ${message.id}`,
            '',
            '**Cleanup Types**',
            '',
            result.removedTypes.length > 0 ? result.removedTypes.join(', ') : 'unspecified',
            '',
            '**Notes**',
            '',
            result.notes || 'Redundant or off-topic content removed.',
            '',
            '**Original**',
            '',
            '```text',
            originalText,
            '```',
            '',
            '**Cleaned**',
            '',
            '```text',
            result.cleanedText,
            '```'
          ].join('\n')
        );
      }
    }

    if (changedIds.length > 0) {
      const refreshed = await fetchChannelMessagesByIds(ctx.telegram, ctx.entity, changedIds);
      await processMessages(ctx, refreshed, { sendNewScreenshotPosts: false });
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
  const ctx = await createWorkflowContext(config);
  try {
    const loreMarkdown = await readMarkdown(path.join(ctx.dirs.generatedDir, 'mushroom-lore.md'));
    const htmlContent = await readMarkdown(path.join(ctx.dirs.generatedDir, 'mushroom-lore.html'));
    const report = await analyzePdfStructureReport(
      ctx.openai,
      ctx.config.openAiLoreModel,
      loreMarkdown,
      htmlContent
    );
    const reportPath = path.join(ctx.dirs.reportsDir, 'pdf-structure-analysis.md');
    await writeMarkdown(reportPath, `${report}\n`);
    return { reportPath };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}
