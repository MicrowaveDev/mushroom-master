import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTelegramInitData } from '../../web/src/composables/useAuth.js';

test('[telegram-auth] reads direct Mini App initData first', () => {
  const initData = 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=abc';
  const telegram = {
    getWebApp: () => ({ initData })
  };

  assert.equal(extractTelegramInitData({ telegram, win: {} }), initData);
});

test('[telegram-auth] falls back to tgWebAppData query params', () => {
  const initData = 'user=%7B%22id%22%3A2%7D&auth_date=2&hash=def';
  const decodedInitData = 'user={"id":2}&auth_date=2&hash=def';
  const win = {
    location: {
      search: `?tgWebAppData=${encodeURIComponent(initData)}`,
      hash: ''
    }
  };

  assert.equal(extractTelegramInitData({ win }), decodedInitData);
});

test('[telegram-auth] falls back to tgWebAppData hash params', () => {
  const initData = 'user=%7B%22id%22%3A3%7D&auth_date=3&hash=ghi';
  const decodedInitData = 'user={"id":3}&auth_date=3&hash=ghi';
  const win = {
    location: {
      search: '',
      hash: `#/auth?tgWebAppData=${encodeURIComponent(initData)}`
    }
  };

  assert.equal(extractTelegramInitData({ win }), decodedInitData);
});

test('[telegram-auth] returns empty string when no initData exists', () => {
  assert.equal(extractTelegramInitData({ win: { location: { search: '', hash: '' } } }), '');
});
