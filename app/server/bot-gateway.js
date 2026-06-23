import { createTelegramAuthCode, confirmTelegramAuthCode } from './auth.js';
import {
  completeTelegramSuccessfulPayment,
  validateTelegramPreCheckout
} from './services/wallet-service.js';

export function normalizeBotUsername(botUsername) {
  return String(botUsername || '').trim().replace(/^@+/, '');
}

export function miniAppName() {
  return process.env.TELEGRAM_MINI_APP_NAME || 'app';
}

export function gameShortName() {
  return process.env.TELEGRAM_GAME_SHORT_NAME || 'mushroom_master';
}

export function buildMiniAppLink(botUsername, startapp) {
  const username = normalizeBotUsername(botUsername);
  const appName = miniAppName();
  return `https://t.me/${username}/${startapp ? `${appName}?startapp=${encodeURIComponent(startapp)}` : appName}`;
}

export function buildDmStartLink(botUsername, startParam) {
  return `https://t.me/${normalizeBotUsername(botUsername)}?start=${encodeURIComponent(startParam)}`;
}

export function createMentionReply({ botUsername, chatType = 'group' }) {
  const playLink = buildMiniAppLink(botUsername, `entry_${chatType}`);
  return {
    text: 'Открыть Mushroom Battles и собрать первый бой.',
    ctas: [
      { label: 'Play', url: playLink },
      { label: 'Start in DM', url: buildDmStartLink(botUsername, 'play') }
    ]
  };
}

export function createTelegramInlineKeyboard(reply) {
  const buttons = (reply?.ctas || []).map((cta) => ([{ text: cta.label, url: cta.url }]));
  return buttons.length ? { inline_keyboard: buttons } : undefined;
}

export function createPaymentSupportReply() {
  const supportUrl = process.env.PAYMENT_SUPPORT_URL || process.env.PUBLIC_SUPPORT_URL || process.env.PUBLIC_GAME_URL || '';
  const termsUrl = process.env.PAYMENT_TERMS_URL || process.env.PUBLIC_TERMS_URL || process.env.PUBLIC_GAME_URL || '';
  return {
    text: [
      'Payment support: contact the Mushroom Battles team before opening a dispute.',
      'Wallet purchases are granted only after verified provider payment callbacks.',
      'Refunds and failed/late crypto payments are handled by support review.'
    ].join('\n'),
    ctas: [
      supportUrl ? { label: 'Support', url: supportUrl } : null,
      termsUrl ? { label: 'Terms', url: termsUrl } : null
    ].filter(Boolean)
  };
}

function appendQuery(url, params) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') target.searchParams.set(key, String(value));
  }
  return target.toString();
}

export function buildGameLaunchUrl({ botUsername, callbackQuery, shortName = gameShortName() } = {}) {
  const baseUrl = process.env.TELEGRAM_GAME_URL || process.env.PUBLIC_GAME_URL || '';
  const startParam = `game_${shortName}`;
  if (!baseUrl) return buildMiniAppLink(botUsername, startParam);

  return appendQuery(baseUrl, {
    startapp: startParam,
    tgGame: shortName,
    tgChatInstance: callbackQuery?.chat_instance,
    tgGameMessageId: callbackQuery?.message?.message_id,
    tgGameChatId: callbackQuery?.message?.chat?.id,
    tgInlineMessageId: callbackQuery?.inline_message_id
  });
}

export function buildTelegramGameScorePayload({
  telegramUserId,
  score,
  chatId,
  messageId,
  inlineMessageId,
  force = false,
  disableEditMessage = false
} = {}) {
  const normalizedScore = Math.max(0, Math.floor(Number(score)));
  if (!Number.isFinite(normalizedScore)) {
    throw new Error('Telegram game score must be a non-negative number');
  }
  const payload = {
    user_id: Number(telegramUserId),
    score: normalizedScore,
    force: Boolean(force),
    disable_edit_message: Boolean(disableEditMessage)
  };
  if (!Number.isFinite(payload.user_id)) {
    throw new Error('Telegram user id is required for game scores');
  }
  if (inlineMessageId) {
    payload.inline_message_id = String(inlineMessageId);
    return payload;
  }
  if (chatId == null || messageId == null) {
    throw new Error('Telegram game score needs chat/message ids or an inline message id');
  }
  payload.chat_id = chatId;
  payload.message_id = Number(messageId);
  return payload;
}

export async function callTelegramBotApi(method, payload, {
  token = process.env.TELEGRAM_BOT_TOKEN,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required');

  const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${json.description || response.status}`);
  }
  return json.result;
}

export function buildWebhookUrl(baseUrl = process.env.PUBLIC_GAME_URL || process.env.TELEGRAM_GAME_URL || '') {
  if (!baseUrl) return '';
  return new URL('/api/bot/webhook', baseUrl).toString();
}

export async function getTelegramWebhookInfo(options = {}) {
  return callTelegramBotApi('getWebhookInfo', {}, options);
}

export async function setTelegramWebhook({ webhookUrl = buildWebhookUrl(), secretToken = process.env.TELEGRAM_WEBHOOK_SECRET } = {}, options = {}) {
  if (!webhookUrl) throw new Error('PUBLIC_GAME_URL or TELEGRAM_GAME_URL is required to set Telegram webhook');
  if (!secretToken && process.env.NODE_ENV === 'production') {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required to set Telegram webhook in production');
  }
  return callTelegramBotApi('setWebhook', {
    url: webhookUrl,
    secret_token: secretToken || undefined,
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
  }, options);
}

export async function ensureTelegramWebhook(options = {}) {
  const webhookUrl = options.webhookUrl || buildWebhookUrl();
  if (!process.env.TELEGRAM_BOT_TOKEN && !options.token) {
    return { skipped: true, reason: 'missing_token' };
  }
  if (!webhookUrl) {
    return { skipped: true, reason: 'missing_public_url' };
  }

  const info = await getTelegramWebhookInfo(options);
  if (info?.url === webhookUrl) {
    return { changed: false, url: webhookUrl };
  }

  await setTelegramWebhook({ webhookUrl, secretToken: options.secretToken }, options);
  return { changed: true, previousUrl: info?.url || '', url: webhookUrl };
}

export async function answerTelegramGameCallback(callbackQuery, options = {}) {
  const shortName = options.shortName || gameShortName();
  const requestedGame = callbackQuery?.game_short_name;
  if (!callbackQuery?.id) throw new Error('Callback query id is required');

  if (requestedGame !== shortName) {
    return callTelegramBotApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: 'Unknown game',
      show_alert: true
    }, options);
  }

  return callTelegramBotApi('answerCallbackQuery', {
    callback_query_id: callbackQuery.id,
    url: buildGameLaunchUrl({
      botUsername: options.botUsername || process.env.TELEGRAM_BOT_USERNAME,
      callbackQuery,
      shortName
    })
  }, options);
}

export async function reportTelegramGameScore(scoreInput, options = {}) {
  return callTelegramBotApi('setGameScore', buildTelegramGameScorePayload(scoreInput), options);
}

export async function answerTelegramPreCheckoutQuery(preCheckoutQueryId, ok, errorMessage = '', options = {}) {
  if (!preCheckoutQueryId) throw new Error('Pre-checkout query id is required');
  return callTelegramBotApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: preCheckoutQueryId,
    ok: Boolean(ok),
    error_message: ok ? undefined : errorMessage || 'Payment cannot be processed'
  }, options);
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  return callTelegramBotApi('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: options.replyMarkup
  }, options);
}

export async function createBrowserFallbackPayload(botUsername) {
  const authCode = await createTelegramAuthCode();
  return {
    ...authCode,
    botUsername,
    botUrl: buildDmStartLink(botUsername, `auth-${authCode.publicCode}`),
    expiresInSeconds: 600
  };
}

export async function handleBotStartParam(startParam, telegramUser) {
  if (!startParam?.startsWith('auth-')) {
    return {
      kind: 'launch',
      text: 'Open the Mini App to continue.'
    };
  }

  const publicCode = startParam.replace(/^auth-/, '');
  await confirmTelegramAuthCode(publicCode, telegramUser);
  return {
    kind: 'auth_confirmed',
    text: 'Authentication confirmed. Return to the app.'
  };
}

export async function handleTelegramWebhook(update, options = {}) {
  const preCheckoutQuery = update?.pre_checkout_query;
  if (preCheckoutQuery?.id) {
    const validation = await validateTelegramPreCheckout(preCheckoutQuery);
    await answerTelegramPreCheckoutQuery(
      preCheckoutQuery.id,
      validation.ok,
      validation.errorMessage,
      options
    );
    return {
      kind: 'wallet_pre_checkout',
      answered: true,
      ok: validation.ok
    };
  }

  const callbackQuery = update?.callback_query;
  if (callbackQuery?.game_short_name) {
    await answerTelegramGameCallback(callbackQuery, options);
    return { kind: 'game_callback', answered: true };
  }

  const message = update?.message;
  if (message?.successful_payment) {
    const result = await completeTelegramSuccessfulPayment(message.successful_payment);
    return {
      kind: 'wallet_payment',
      answered: true,
      intentId: result.intent.id,
      alreadyCompleted: result.alreadyCompleted
    };
  }

  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  if (/^\/paysupport(?:@\w+)?(?:\s|$)/.test(text) && message?.chat?.id) {
    const reply = createPaymentSupportReply();
    await sendTelegramMessage(message.chat.id, reply.text, {
      ...options,
      replyMarkup: createTelegramInlineKeyboard(reply)
    });
    return { kind: 'payment_support', answered: true };
  }

  if (/^\/terms(?:@\w+)?(?:\s|$)/.test(text) && message?.chat?.id) {
    const reply = createPaymentSupportReply();
    await sendTelegramMessage(message.chat.id, reply.text, {
      ...options,
      replyMarkup: createTelegramInlineKeyboard(reply)
    });
    return { kind: 'payment_terms', answered: true };
  }

  const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);
  if (startMatch && message?.chat?.id) {
    const startParam = startMatch[1] || 'play';
    const user = message.from || {};
    const result = await handleBotStartParam(startParam, {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    });
    await sendTelegramMessage(message.chat.id, result.text, options);
    return { kind: result.kind, answered: true };
  }

  const username = normalizeBotUsername(options.botUsername || process.env.TELEGRAM_BOT_USERNAME);
  if (username && text.includes(`@${username}`) && message?.chat?.id) {
    const reply = createMentionReply({
      botUsername: options.botUsername || process.env.TELEGRAM_BOT_USERNAME,
      chatType: message.chat.type || 'group'
    });
    await sendTelegramMessage(message.chat.id, reply.text, {
      ...options,
      replyMarkup: createTelegramInlineKeyboard(reply)
    });
    return { kind: 'mention_reply', answered: true };
  }

  return { kind: 'ignored', answered: false };
}
