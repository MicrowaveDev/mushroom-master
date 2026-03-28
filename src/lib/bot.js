import fs from 'node:fs/promises';

function createTelegramBotUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

function normalizeBotChatId(target) {
  if (target == null) {
    throw new Error('Missing bot chat target.');
  }

  if (typeof target === 'string') {
    const trimmed = target.trim();
    if (trimmed.startsWith('@')) {
      return trimmed;
    }
    if (/^-?\d+$/.test(trimmed)) {
      return trimmed;
    }
    return `@${trimmed.replace(/^https:\/\/t\.me\//, '').replace(/^@/, '')}`;
  }

  const raw = String(target);
  if (raw.startsWith('-100') || raw.startsWith('@')) {
    return raw;
  }
  if (/^-?\d+$/.test(raw)) {
    return raw.startsWith('-') ? raw : `-100${raw}`;
  }
  throw new Error(`Unsupported bot chat target: ${raw}`);
}

async function callBotApi(botToken, method, body) {
  const response = await fetch(createTelegramBotUrl(botToken, method), {
    method: 'POST',
    body
  });

  const payload = await response.json();
  const retryAfter = Number(payload?.parameters?.retry_after || parseRetryAfterSeconds(payload?.description));
  if (retryAfter > 0) {
    await sleep((retryAfter + 1) * 1000);
    return callBotApi(botToken, method, body);
  }
  if (method === 'editMessageText' && payload?.description?.includes('message is not modified')) {
    return { message_id: Number(body.get('message_id')) };
  }
  if (!response.ok || !payload.ok) {
    throw new Error(`Telegram Bot API ${method} failed: ${payload.description || response.statusText}`);
  }

  return payload.result;
}

export async function sendTextViaBot({ botToken, chatTarget, text }) {
  const formData = new FormData();
  formData.set('chat_id', normalizeBotChatId(chatTarget));
  formData.set('text', text);

  return callBotApi(botToken, 'sendMessage', formData);
}

export async function editTextViaBot({ botToken, chatTarget, messageId, text }) {
  const formData = new FormData();
  formData.set('chat_id', normalizeBotChatId(chatTarget));
  formData.set('message_id', String(messageId));
  formData.set('text', text);

  return callBotApi(botToken, 'editMessageText', formData);
}

export async function deleteMessageViaBot({ botToken, chatTarget, messageId }) {
  const formData = new FormData();
  formData.set('chat_id', normalizeBotChatId(chatTarget));
  formData.set('message_id', String(messageId));

  try {
    const result = await callBotApi(botToken, 'deleteMessage', formData);
    return Boolean(result);
  } catch (error) {
    if (String(error.message || '').includes('message to delete not found')) {
      return false;
    }
    throw error;
  }
}

function parseRetryAfterSeconds(message) {
  const match = String(message || '').match(/retry after (\d+)/i);
  return match ? Number(match[1]) : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendPdfViaBot({
  botToken,
  pdfPath,
  caption,
  channelUsername,
  channelChatId,
  adminChatIds,
  sendToChannel
}) {
  if (!botToken) {
    return [];
  }

  const targets = [];
  if (sendToChannel) {
    targets.push(channelChatId || channelUsername);
  }
  targets.push(...adminChatIds);

  if (targets.length === 0) {
    return [];
  }

  const pdfBuffer = await fs.readFile(pdfPath);
  const results = [];

  for (const chatId of targets) {
    const formData = new FormData();
    formData.set('chat_id', normalizeBotChatId(chatId));
    formData.set('caption', caption);
    formData.set('document', new Blob([pdfBuffer], { type: 'application/pdf' }), 'mushroom-lore.pdf');

    const result = await callBotApi(botToken, 'sendDocument', formData);
    results.push({ chatId: normalizeBotChatId(chatId), messageId: result?.message_id });
  }

  return results;
}
