import fs from 'node:fs/promises';
import path from 'node:path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

function normalizeChannelInput(value) {
  return value.replace(/^https:\/\/t\.me\//, '').replace(/^@/, '');
}

export async function createTelegramClient({ apiId, apiHash, stringSession }) {
  const client = new TelegramClient(new StringSession(stringSession), apiId, apiHash, {
    connectionRetries: 5,
    floodSleepThreshold: 0
  });
  await client.connect();
  return client;
}

export async function getChannelEntity(client, channelUsername) {
  const normalized = normalizeChannelInput(channelUsername);

  try {
    return await client.getEntity(normalized);
  } catch (error) {
    const titleMatch = await findDialogByTitle(client, channelUsername);
    if (titleMatch) {
      return titleMatch.entity;
    }
    throw new Error(
      `Unable to resolve channel "${channelUsername}". ` +
      `Use a public username/link or the exact dialog title visible to the Telegram client account. ` +
      `Original error: ${error.message}`
    );
  }
}

export async function fetchChannelMessages(client, entity, limit, options = {}) {
  const collected = [];
  const maxMessages = limit === 0 ? Number.POSITIVE_INFINITY : limit;
  const minSourceMessageIdExclusive = Number(options.minSourceMessageIdExclusive || 0);

  for await (const message of client.iterMessages(entity, { reverse: true })) {
    if (isGeneratedRepost(message)) {
      continue;
    }
    if (message.id <= minSourceMessageIdExclusive) {
      continue;
    }

    collected.push(message);
    if (collected.length >= maxMessages) {
      break;
    }
  }

  return collected;
}

export async function fetchChannelMessageById(client, entity, messageId) {
  const messages = await client.getMessages(entity, { ids: [messageId] });
  return Array.from(messages)[0] || null;
}

export async function fetchChannelMessagesByIds(client, entity, ids) {
  const messages = await client.getMessages(entity, { ids });
  return Array.from(messages).filter(Boolean);
}

export async function downloadMessageMedia(client, message, assetsDir, stem) {
  if (!message.media) {
    return null;
  }

  const filePath = path.join(assetsDir, `${stem}.bin`);
  const downloaded = await client.downloadMedia(message, { outputFile: filePath });

  if (!downloaded) {
    return null;
  }

  const resolvedPath = typeof downloaded === 'string' ? downloaded : filePath;
  const buffer = await fs.readFile(resolvedPath);
  const lowerName = String(message.file?.name || '').toLowerCase();
  const mimeType = String(message.file?.mimeType || '').toLowerCase();
  const extension = inferExtension(lowerName, mimeType, buffer);
  const finalPath = resolvedPath.endsWith(extension) ? resolvedPath : `${resolvedPath}${extension}`;

  if (finalPath !== resolvedPath) {
    await fs.rename(resolvedPath, finalPath);
  }

  return {
    path: finalPath,
    mimeType,
    fileName: path.basename(finalPath)
  };
}

function inferExtension(fileName, mimeType, buffer) {
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    return fileName.endsWith('.jpeg') ? '.jpeg' : '.jpg';
  }
  if (fileName.endsWith('.png')) {
    return '.png';
  }
  if (fileName.endsWith('.webp')) {
    return '.webp';
  }
  if (mimeType.includes('jpeg')) {
    return '.jpg';
  }
  if (mimeType.includes('png')) {
    return '.png';
  }
  if (mimeType.includes('webp')) {
    return '.webp';
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return '.png';
  }
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return '.jpg';
  }
  return '.bin';
}

export function shouldOcrMedia(media) {
  if (!media) {
    return false;
  }
  return ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => media.path.toLowerCase().endsWith(ext));
}

export async function postTextToChannel(client, entity, text) {
  return sendMessageWithRetry(client, entity, text);
}

export async function editChannelMessageText(client, entity, messageId, text) {
  return client.editMessage(entity, {
    message: messageId,
    text
  });
}

function isGeneratedRepost(message) {
  const text = String(message?.message || '').trim();
  const mimeType = String(message?.file?.mimeType || '').toLowerCase();
  return /^#\d+\b/.test(text) ||
    mimeType === 'application/pdf' ||
    text.includes('Mushroom lore digest') ||
    text.includes('Грибной лор');
}

async function findDialogByTitle(client, title) {
  const wanted = String(title).trim().toLowerCase();
  for await (const dialog of client.iterDialogs({})) {
    const currentTitle = String(dialog.title || '').trim().toLowerCase();
    if (currentTitle === wanted) {
      return dialog;
    }
  }
  return null;
}

async function sendMessageWithRetry(client, entity, text, attempt = 0) {
  try {
    return await client.sendMessage(entity, { message: text });
  } catch (error) {
    const waitSeconds = Number(error?.seconds || parseFloodWaitSeconds(error?.message));
    if (waitSeconds > 0 && attempt < 3) {
      await sleep((waitSeconds + 1) * 1000);
      return sendMessageWithRetry(client, entity, text, attempt + 1);
    }
    throw error;
  }
}

function parseFloodWaitSeconds(message) {
  const match = String(message || '').match(/wait of (\d+) seconds/i);
  return match ? Number(match[1]) : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
