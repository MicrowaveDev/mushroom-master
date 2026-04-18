import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { config as defaultConfig } from './config.js';
import { normalizeRenderTemplate, renderMarkdownToHtmlAndPdf } from './lib/render.js';
import { sendPdfViaBot } from './lib/bot.js';
import { ensureChannelDirs, readMarkdown, slugify, writeMarkdown } from './lib/storage.js';
import { createWorkflowContext, disposeWorkflowContext } from './lib/workflow.js';

dotenvConfig();

function readArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return '';
  }
  return String(args[index + 1] || '').trim();
}

function resolveChannelSlug(args) {
  const explicitSlug = readArgValue(args, '--channel-slug');
  if (explicitSlug) {
    return explicitSlug;
  }

  const channelUsername = String(process.env.CHANNEL_USERNAME || '').trim();
  if (channelUsername) {
    return slugify(channelUsername);
  }

  return 'channel';
}

function resolveRenderTemplate(args) {
  return normalizeRenderTemplate(readArgValue(args, '--template'));
}

function resolveLoreTitle(markdown) {
  const firstHeading = String(markdown)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '));

  if (firstHeading) {
    return firstHeading.slice(2).trim() || 'Mushroom Lore';
  }

  return 'Mushroom Lore';
}

function buildPdfDeliveryMetadata(template, channelUsername) {
  if (template === 'mushrooms-docs') {
    return {
      caption: `Грибные документы для ${channelUsername}`,
      documentName: 'mushrooms-docs.pdf'
    };
  }

  return {
    caption: `Грибной лор для ${channelUsername}`,
    documentName: 'mushroom-lore.pdf'
  };
}

export async function renderExistingLoreMarkdown(options = {}) {
  const args = options.args || process.argv.slice(2);
  const sendPdf = options.sendPdf ?? true;
  const channelSlug = resolveChannelSlug(args);
  const template = resolveRenderTemplate(args);
  const dirs = await ensureChannelDirs(channelSlug);
  const lorePath = path.join(dirs.generatedDir, 'mushroom-lore.md');
  const markdown = await readMarkdown(lorePath);
  const normalizedMarkdown = markdown.endsWith('\n') ? markdown : `${markdown}\n`;
  if (normalizedMarkdown !== markdown) {
    await writeMarkdown(lorePath, normalizedMarkdown);
  }

  // Render-only mode treats the stored markdown as canonical authored input.
  const renderMarkdown = normalizedMarkdown;
  const title = resolveLoreTitle(renderMarkdown);
  const renderResult = await renderMarkdownToHtmlAndPdf(
    renderMarkdown,
    title,
    dirs.generatedDir,
    { template }
  );

  let botResults = [];
  if (sendPdf && defaultConfig.telegramBotToken) {
    let ctx = null;
    try {
      ctx = await createWorkflowContext(defaultConfig);
      const delivery = buildPdfDeliveryMetadata(template, ctx.config.channelUsername);
      botResults = await sendPdfViaBot({
        botToken: ctx.config.telegramBotToken,
        pdfPath: renderResult.pdfPath,
        caption: delivery.caption,
        documentName: delivery.documentName,
        channelUsername: ctx.config.channelUsername,
        channelChatId: ctx.botChatId,
        adminChatIds: ctx.config.adminChatIds,
        sendToChannel: ctx.config.botSendToChannel
      });
    } finally {
      await disposeWorkflowContext(ctx);
    }
  }

  return {
    channelSlug,
    lorePath,
    title,
    template,
    botResults,
    ...renderResult
  };
}
