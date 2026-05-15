import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFriendInviteLink,
  buildFriendRefParam,
  buildTelegramShareUrl,
  buildTelegramMiniAppLink,
  buildWebsiteFriendInviteLink,
  isTelegramMiniAppEnvironment,
  normalizeTelegramBotUsername,
  shareTelegramText
} from '../../web/src/helpers/telegram-links.js';

test('[telegram-links] detects Telegram Mini App environment', () => {
  assert.equal(isTelegramMiniAppEnvironment({}), false);
  assert.equal(isTelegramMiniAppEnvironment({ Telegram: { WebApp: {} } }), true);
});

test('[telegram-links] builds friend ref start params', () => {
  assert.equal(buildFriendRefParam('231555'), 'ref_231555');
  assert.equal(normalizeTelegramBotUsername('@mushroom_game_bot'), 'mushroom_game_bot');
});

test('[telegram-links] builds Telegram Mini App links', () => {
  assert.equal(
    buildTelegramMiniAppLink({ botUsername: '@mushroom_game_bot', startParam: 'ref_231555' }),
    'https://t.me/mushroom_game_bot/app?startapp=ref_231555'
  );
});

test('[telegram-links] builds website invite links outside Telegram', () => {
  assert.equal(
    buildWebsiteFriendInviteLink({
      friendCode: '231555',
      location: { origin: 'https://mycelium.example' }
    }),
    'https://mycelium.example/friends?ref=231555'
  );
});

test('[telegram-links] chooses Telegram link only inside Mini App with configured bot', () => {
  assert.equal(
    buildFriendInviteLink({
      friendCode: '231555',
      botUsername: '@mushroom_game_bot',
      win: { Telegram: { WebApp: {} } },
      location: { origin: 'https://mycelium.example' }
    }),
    'https://t.me/mushroom_game_bot/app?startapp=ref_231555'
  );
  assert.equal(
    buildFriendInviteLink({
      friendCode: '231555',
      botUsername: '@mushroom_game_bot',
      win: {},
      location: { origin: 'https://mycelium.example' }
    }),
    'https://mycelium.example/friends?ref=231555'
  );
});

test('[telegram-links] builds Telegram share URLs and prefers WebApp openTelegramLink', async () => {
  assert.equal(
    buildTelegramShareUrl({ url: 'https://mycelium.example/friends?ref=231555', text: 'Join me' }),
    'https://t.me/share/url?url=https%3A%2F%2Fmycelium.example%2Ffriends%3Fref%3D231555&text=Join+me'
  );

  const opened = [];
  const result = await shareTelegramText({
    text: 'Join me',
    url: 'https://mycelium.example/friends?ref=231555',
    win: { Telegram: { WebApp: { openTelegramLink: (url) => opened.push(url) } } }
  });
  assert.equal(result, 'telegram');
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^https:\/\/t\.me\/share\/url/);
});
