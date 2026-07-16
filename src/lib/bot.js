import fs from 'node:fs/promises';
import { normalizeTelegramChatTarget } from '@microwavedev/backpack-game-core/modules/telegram';
import { createTelegramBotApiClient } from '@microwavedev/backpack-game-core/server/telegram';

function botClient(botToken) {
  return createTelegramBotApiClient({ token: botToken });
}

export async function sendTextViaBot({ botToken, chatTarget, text }) {
  return botClient(botToken).sendMessage(chatTarget, text);
}

export async function editTextViaBot({ botToken, chatTarget, messageId, text }) {
  return botClient(botToken).editMessageText(chatTarget, messageId, text);
}

export async function deleteMessageViaBot({ botToken, chatTarget, messageId }) {
  return botClient(botToken).deleteMessage(chatTarget, messageId);
}

export async function sendPdfViaBot({
  botToken,
  pdfPath,
  caption,
  documentName = 'mushroom-lore.pdf',
  channelUsername,
  channelChatId,
  adminChatIds,
  sendToChannel
}) {
  if (!botToken) return [];
  const targets = [];
  if (sendToChannel) targets.push(channelChatId || channelUsername);
  targets.push(...adminChatIds);
  if (!targets.length) return [];

  const pdfBuffer = await fs.readFile(pdfPath);
  const client = botClient(botToken);
  const results = [];
  for (const chatId of targets) {
    const result = await client.sendDocument(chatId, pdfBuffer, {
      caption,
      filename: documentName,
      contentType: 'application/pdf'
    });
    results.push({
      chatId: normalizeTelegramChatTarget(chatId),
      messageId: result?.message_id
    });
  }
  return results;
}
