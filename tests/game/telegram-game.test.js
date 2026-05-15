import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGameLaunchUrl,
  buildTelegramGameScorePayload,
  createMentionReply,
  createTelegramInlineKeyboard,
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

test('[telegram-game] mention replies include playable Telegram links', () => {
  const reply = createMentionReply({ botUsername: '@mushroom_game_bot', chatType: 'supergroup' });
  const keyboard = createTelegramInlineKeyboard(reply);
  assert.match(reply.ctas[0].url, /^https:\/\/t\.me\/mushroom_game_bot\/app\?startapp=entry_supergroup/);
  assert.equal(keyboard.inline_keyboard[0][0].text, 'Play');
});
