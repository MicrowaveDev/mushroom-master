import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGameLaunchUrl,
  buildTelegramGameScorePayload,
  buildWebhookUrl,
  createMentionReply,
  createTelegramInlineKeyboard,
  ensureTelegramWebhook,
  handleTelegramWebhook
} from '../../app/server/bot-gateway.js';

function mockTelegramFetch(calls) {
  return async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return {
      async json() {
        return { ok: true, result: true };
      }
    };
  };
}

test('[telegram-game] callback launch URL carries game and message context', () => {
  process.env.PUBLIC_GAME_URL = 'https://mycelium.example/play';
  process.env.TELEGRAM_GAME_SHORT_NAME = 'mushroom_master';
  const url = buildGameLaunchUrl({
    botUsername: '@mushroom_game_bot',
    callbackQuery: {
      chat_instance: 'chat-abc',
      message: { message_id: 42, chat: { id: -100123 } }
    }
  });
  assert.equal(
    url,
    'https://mycelium.example/play?startapp=game_mushroom_master&tgGame=mushroom_master&tgChatInstance=chat-abc&tgGameMessageId=42&tgGameChatId=-100123'
  );
  delete process.env.PUBLIC_GAME_URL;
});

test('[telegram-game] score payload targets chat messages or inline game messages', () => {
  assert.deepEqual(
    buildTelegramGameScorePayload({
      telegramUserId: 101,
      score: 84.9,
      chatId: -100123,
      messageId: 42
    }),
    {
      user_id: 101,
      score: 84,
      force: false,
      disable_edit_message: false,
      chat_id: -100123,
      message_id: 42
    }
  );

  assert.deepEqual(
    buildTelegramGameScorePayload({
      telegramUserId: '101',
      score: 12,
      inlineMessageId: 'inline-1',
      disableEditMessage: true
    }),
    {
      user_id: 101,
      score: 12,
      force: false,
      disable_edit_message: true,
      inline_message_id: 'inline-1'
    }
  );
});

test('[telegram-game] webhook answers game callbacks through Bot API', async () => {
  process.env.PUBLIC_GAME_URL = 'https://mycelium.example/play';
  process.env.TELEGRAM_GAME_SHORT_NAME = 'mushroom_master';
  const calls = [];
  const result = await handleTelegramWebhook({
    callback_query: {
      id: 'cb-1',
      game_short_name: 'mushroom_master',
      chat_instance: 'chat-abc',
      message: { message_id: 42, chat: { id: -100123 } }
    }
  }, {
    token: 'bot:test',
    botUsername: '@mushroom_game_bot',
    fetchImpl: mockTelegramFetch(calls)
  });

  assert.deepEqual(result, { kind: 'game_callback', answered: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /answerCallbackQuery$/);
  assert.equal(calls[0].body.callback_query_id, 'cb-1');
  assert.match(calls[0].body.url, /tgGame=mushroom_master/);
  delete process.env.PUBLIC_GAME_URL;
});

test('[telegram-game] builds production webhook URL from public game URL', () => {
  assert.equal(
    buildWebhookUrl('https://mushroombattles.com/'),
    'https://mushroombattles.com/api/bot/webhook'
  );
});

test('[telegram-game] ensureTelegramWebhook sets webhook when missing', async () => {
  const calls = [];
  const result = await ensureTelegramWebhook({
    token: 'bot:test',
    webhookUrl: 'https://mushroombattles.com/api/bot/webhook',
    secretToken: 'secret',
    fetchImpl: async (url, options) => {
      const method = String(url).split('/').pop();
      calls.push({ method, body: JSON.parse(options.body) });
      return {
        async json() {
          return method === 'getWebhookInfo'
            ? { ok: true, result: { url: '' } }
            : { ok: true, result: true };
        }
      };
    }
  });

  assert.deepEqual(result, {
    changed: true,
    previousUrl: '',
    url: 'https://mushroombattles.com/api/bot/webhook'
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'getWebhookInfo');
  assert.equal(calls[1].method, 'setWebhook');
  assert.deepEqual(calls[1].body, {
    url: 'https://mushroombattles.com/api/bot/webhook',
    secret_token: 'secret',
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
  });
});

test('[telegram-game] ensureTelegramWebhook skips set when URL already matches', async () => {
  const calls = [];
  const result = await ensureTelegramWebhook({
    token: 'bot:test',
    webhookUrl: 'https://mushroombattles.com/api/bot/webhook',
    fetchImpl: async (url, options) => {
      const method = String(url).split('/').pop();
      calls.push({ method, body: JSON.parse(options.body) });
      return {
        async json() {
          return { ok: true, result: { url: 'https://mushroombattles.com/api/bot/webhook' } };
        }
      };
    }
  });

  assert.deepEqual(result, {
    changed: false,
    url: 'https://mushroombattles.com/api/bot/webhook'
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'getWebhookInfo');
});

test('[telegram-game] mention replies include playable Telegram links', () => {
  const reply = createMentionReply({ botUsername: '@mushroom_game_bot', chatType: 'supergroup' });
  const keyboard = createTelegramInlineKeyboard(reply);
  assert.match(reply.ctas[0].url, /^https:\/\/t\.me\/mushroom_game_bot\/app\?startapp=entry_supergroup/);
  assert.equal(keyboard.inline_keyboard[0][0].text, 'Play');
});
