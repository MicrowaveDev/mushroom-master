import fs from 'node:fs/promises';
import path from 'node:path';
import { config as defaultConfig } from '../config.js';
import { createOpenAiClient, analyzeLorePromptReport } from './openai.js';
import { deleteMessageViaBot, editTextViaBot, sendTextViaBot } from './bot.js';
import { renderMarkdownToHtmlAndPdf } from './render.js';
import { ensureChannelDirs, readMarkdown, writeMarkdown, slugify } from './storage.js';
import {
  createTelegramClient,
  editChannelMessageText,
  fetchChannelMessageById,
  fetchChannelMessages,
  fetchChannelMessagesByIds,
  getChannelEntity
} from './telegram.js';
import {
  extractHashtags,
  extractMessageSection,
  replaceSection,
  parseTaggedMessageText,
  composeTaggedMessageText,
  composeOcrRepostText
} from './markdown-parser.js';
import {
  messageDateToIso,
  resolveBotChatId,
  isEditableTextSourceMessage,
  processMessages,
  reconcileStoredMessages
} from './message-processor.js';
import { writeLoreOutputs } from './lore-builder.js';
import { loadDeterministicCleanupTargets, computeDeterministicCleanup } from './cleanup.js';

function parseFloodWaitSeconds(message) {
  const match = String(message || '').match(/wait of (\d+) seconds/i);
  return match ? Number(match[1]) : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function createLocalWorkflowContext(config = defaultConfig) {
  const dirs = await ensureChannelDirs(slugify(config.channelUsername));
  const openai = createOpenAiClient(config.openAiApiKey);
  return { config, dirs, openai, telegram: null, entity: null, botChatId: null };
}

export async function disposeWorkflowContext(ctx) {
  if (ctx?.telegram) {
    await ctx.telegram.disconnect();
  }
}

export async function runIncrementalFetch(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const messages = await fetchChannelMessages(ctx.telegram, ctx.entity, ctx.config.messageLimit, {
      minSourceMessageIdExclusive: 0
    });
    const removedSourceMessageIds = await reconcileStoredMessages(ctx, messages);
    const processed = await processMessages(ctx, messages, { sendNewScreenshotPosts: true });
    const outputs = await writeLoreOutputs(ctx, { sendPdf: true });
    return {
      fetchedCount: messages.length,
      newSourceMessageCount: messages.length,
      removedSourceMessageIds,
      processed,
      ...outputs
    };
  } finally {
    await disposeWorkflowContext(ctx);
  }
}

export async function runFullRegeneration(config = defaultConfig, options = {}) {
  const skipDownload = options.skipDownload ?? options.skipTelegram ?? false;
  const ctx = skipDownload
    ? await createLocalWorkflowContext(config)
    : await createWorkflowContext(config);
  try {
    const messages = skipDownload
      ? []
      : await fetchChannelMessages(ctx.telegram, ctx.entity, ctx.config.messageLimit, {
          minSourceMessageIdExclusive: 0
        });
    const removedSourceMessageIds = skipDownload
      ? []
      : await reconcileStoredMessages(ctx, messages);
    const processed = skipDownload
      ? []
      : await processMessages(ctx, messages, { sendNewScreenshotPosts: true });
    const outputs = await writeLoreOutputs(ctx, {
      sendPdf: options.sendPdf ?? true,
      force: options.force ?? false
    });
    return {
      fetchedCount: messages.length,
      skipDownload,
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

      const messageFiles = (await fs.readdir(ctx.dirs.messagesDir))
        .filter((name) => name.endsWith(`-${sourceMessageId}.md`));
      const messageFile = messageFiles[0] ? path.join(ctx.dirs.messagesDir, messageFiles[0]) : null;
      if (!messageFile) {
        results.push({ sourceMessageId, ok: false, error: `No source message for ${sourceMessageId}.` });
        continue;
      }

      try {
        const markdown = await readMarkdown(messageFile);
        let updatedMarkdown = markdown;
        if (hashtags.length > 0) {
          updatedMarkdown = replaceSection(updatedMarkdown, 'Hashtags', hashtags.join(' '));
          if (!/## Hashtags\n\n/m.test(updatedMarkdown)) {
            updatedMarkdown = updatedMarkdown.replace(
              /^(- Message ID: [^\n]+\n)/m,
              `$1\n## Hashtags\n\n${hashtags.join(' ')}\n`
            );
          }
        }
        if (hashtags.length === 0 && /## Hashtags\n\n/m.test(updatedMarkdown)) {
          updatedMarkdown = updatedMarkdown.replace(/\n## Hashtags\n\n[\s\S]*?(?=\n## |\n# |$)/m, '\n');
        }
        await writeMarkdown(messageFile, updatedMarkdown.trimEnd() + '\n');
        results.push({ sourceMessageId, ok: true, error: null, messageFile });
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
      } else if (result.kind === 'ocr' && result.changed) {
        const updatedMessageMarkdown = replaceSection(originalMarkdown, 'OCR', cleanedText);
        await writeMarkdown(result.messageFile, updatedMessageMarkdown);
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
  // No-op: OCR repost metadata is no longer stored in separate files.
  // Backfill is only needed for legacy separate OCR files.
  const dirs = await ensureChannelDirs(slugify(config.channelUsername));
  const reportPath = path.join(dirs.reportsDir, 'posted-message-id-backfill.md');
  await writeMarkdown(reportPath, '# Posted Message ID Backfill\n\nNo separate OCR files to backfill.\n');
  return { repaired: [], reportPath };
}

export async function rebuildOcrReposts(config = defaultConfig) {
  const ctx = await createWorkflowContext(config);
  try {
    const candidates = await loadDeterministicCleanupTargets(ctx.dirs);
    const ocrTargets = candidates
      .filter((target) => target.kind === 'ocr')
      .sort((a, b) => a.sourceMessageId - b.sourceMessageId);

    const rebuilt = [];
    for (const target of ocrTargets) {
      const cleanedText = target.text.trim();

      if (!cleanedText) {
        rebuilt.push({ sourceMessageId: target.sourceMessageId, postedMessageId: null, deletedOnly: true });
        continue;
      }

      const postedMessage = await sendTextViaBot({
        botToken: ctx.config.telegramBotToken,
        chatTarget: ctx.botChatId,
        text: [`#${target.sourceMessageId}`, '', cleanedText].join('\n')
      });
      const postedMessageId = postedMessage?.id ?? postedMessage?.message_id;
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
          ? `- Source message ${item.sourceMessageId}: skipped (empty OCR text)`
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
