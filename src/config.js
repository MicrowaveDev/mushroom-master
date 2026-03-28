import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function requiredAny(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`);
}

function optional(name, fallback = '') {
  const value = process.env[name];
  return value == null || value === '' ? fallback : String(value).trim();
}

function optionalBoolean(name, fallback = false) {
  const value = optional(name, '');
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  clientToken: required('CLIENT_TOKEN'),
  openAiApiKey: required('OPENAI_API_KEY').replace(/^"|"$/g, ''),
  telegramApiId: Number(requiredAny(['TG_CLIENT_API_ID', 'TELEGRAM_API_ID'])),
  telegramApiHash: requiredAny(['TG_CLIENT_API_HASH', 'TELEGRAM_API_HASH']),
  channelUsername: required('CHANNEL_USERNAME'),
  telegramBotToken: optional('TELEGRAM_BOT_TOKEN'),
  botSendToChannel: optionalBoolean('BOT_SEND_TO_CHANNEL', false),
  adminChatIds: optional('ADMIN_CHAT_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  messageLimit: Number(optional('MESSAGE_LIMIT', '50')),
  openAiOcrModel: optional('OPENAI_OCR_MODEL', 'gpt-4.1-mini'),
  openAiLoreModel: optional('OPENAI_LORE_MODEL', 'gpt-4.1-mini')
};

if (!Number.isInteger(config.telegramApiId) || config.telegramApiId <= 0) {
  throw new Error('TELEGRAM_API_ID must be a positive integer.');
}

if (!Number.isInteger(config.messageLimit) || config.messageLimit < 0) {
  throw new Error('MESSAGE_LIMIT must be a non-negative integer.');
}
