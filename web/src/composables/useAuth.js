import { apiJson } from '../api.js';
import { SHOP_OFFER_SIZE } from '../constants.js';
import { pickRandomShopOffer } from '../artifacts/grid.js';

export function useAuth(state, goTo) {
  function applyTelegramTheme() {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    const theme = tg.themeParams || {};
    const root = document.documentElement;
    root.style.setProperty('--telegram-accent', theme.button_color || '#7b5b3b');
    root.style.setProperty('--telegram-surface', theme.secondary_bg_color || '#f6f0df');
  }

  function loadOrGenerateShopOffer() {
    const artifactsList = state.bootstrap?.artifacts || [];
    const builderIds = new Set(state.builderItems.map((i) => i.artifactId));
    const stored = state.bootstrap?.shopState || null;
    const available = new Set(artifactsList.map((a) => a.id));
    if (stored?.container?.length) {
      state.containerItems = stored.container.filter((id) => available.has(id) && !builderIds.has(id));
    }
    state.rerollSpent = stored?.rerollSpent || 0;
    if (stored?.freshPurchases?.length) {
      state.freshPurchases = stored.freshPurchases.filter((id) => available.has(id));
    }
    const ownedIds = new Set([...builderIds, ...state.containerItems]);
    if (stored?.offer?.length) {
      state.shopOffer = stored.offer.filter((id) => available.has(id) && !ownedIds.has(id));
    } else {
      state.shopOffer = pickRandomShopOffer(artifactsList, ownedIds);
    }
    if (!stored && state.shopOffer.length < SHOP_OFFER_SIZE) {
      const exclude = new Set([...state.shopOffer, ...ownedIds]);
      const extras = pickRandomShopOffer(artifactsList, exclude).slice(0, SHOP_OFFER_SIZE - state.shopOffer.length);
      state.shopOffer = [...state.shopOffer, ...extras];
    }
    persistShopOffer();
  }

  function persistShopOffer() {
    if (!state.sessionKey) return;
    const payload = {
      offer: state.shopOffer,
      container: state.containerItems,
      freshPurchases: state.freshPurchases,
      builderItems: state.builderItems,
      rerollSpent: state.rerollSpent
    };
    apiJson('/api/shop-state', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }, state.sessionKey).catch(() => {});
  }

  async function refreshBootstrap() {
    try {
      state.appConfig = await apiJson('/api/app-config');
    } catch (_error) {
      state.appConfig = { localAiLabEnabled: false, localDevAuthEnabled: false };
    }
    if (!state.sessionKey) {
      state.loading = false;
      return;
    }
    state.loading = true;
    try {
      state.bootstrap = await apiJson('/api/bootstrap', {}, state.sessionKey);
      state.lang = state.bootstrap.settings.lang;
      const savedLoadout = state.bootstrap.loadout?.items || [];
      const shopBuilderItems = state.bootstrap.shopState?.builderItems || [];
      state.builderItems = shopBuilderItems.length ? shopBuilderItems : [...savedLoadout];
      loadOrGenerateShopOffer();
      try { state.friends = await apiJson('/api/friends', {}, state.sessionKey); } catch { state.friends = []; }
      try { state.leaderboard = await apiJson('/api/leaderboard', {}, state.sessionKey); } catch { state.leaderboard = []; }
      try { state.wikiHome = await apiJson('/api/wiki/home'); } catch { state.wikiHome = null; }
      if (state.bootstrap.activeGameRun) {
        state.gameRun = state.bootstrap.activeGameRun;
      } else {
        state.gameRun = null;
      }
      if (!state.bootstrap.activeMushroomId) {
        state.screen = 'onboarding';
      } else if (state.screen === 'auth') {
        state.screen = state.gameRun ? 'prep' : 'home';
      }
    } catch (error) {
      state.error = error.message;
      state.bootstrap = null;
      state.friends = [];
      state.leaderboard = [];
      state.wikiHome = null;
      state.builderItems = [];
      state.screen = 'auth';
      localStorage.removeItem('sessionKey');
      state.sessionKey = '';
    } finally {
      state.loading = false;
    }
  }

  async function loginViaTelegram() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      state.error = 'Missing Telegram initData';
      return;
    }
    try {
      const data = await apiJson('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Telegram login failed';
    }
  }

  async function loginViaBrowserCode() {
    state.authCode = await apiJson('/api/auth/telegram/code', { method: 'POST' });
    const startedAt = Date.now();
    const poll = async () => {
      if (!state.authCode || Date.now() - startedAt > 10 * 60 * 1000) {
        state.error = 'Telegram auth timed out';
        return;
      }
      try {
        const result = await fetch('/api/auth/telegram/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privateCode: state.authCode.privateCode })
        });
        const json = await result.json();
        if (json.success) {
          state.sessionKey = json.data.sessionKey;
          localStorage.setItem('sessionKey', json.data.sessionKey);
          state.authCode = null;
          await refreshBootstrap();
          return;
        }
      } catch (_error) {}
      window.setTimeout(poll, 3000);
    };
    window.open(state.authCode.botUrl, '_blank');
    poll();
  }

  async function loginViaDevSession() {
    try {
      state.error = '';
      const data = await apiJson('/api/dev/session', { method: 'POST', body: JSON.stringify({}) });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      state.screen = 'home';
      await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Dev login failed';
    }
  }

  async function saveCharacter(mushroomId) {
    try {
      await apiJson('/api/active-character', { method: 'PUT', body: JSON.stringify({ mushroomId }) }, state.sessionKey);
      await refreshBootstrap();
      goTo('artifacts');
    } catch (error) {
      state.error = error.message || 'Could not save character';
    }
  }

  async function saveSettings() {
    try {
      await apiJson('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          lang: state.lang,
          reducedMotion: state.bootstrap.settings.reducedMotion,
          battleSpeed: state.bootstrap.settings.battleSpeed
        })
      }, state.sessionKey);
      await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Could not save settings';
    }
  }

  return {
    applyTelegramTheme, refreshBootstrap,
    loginViaTelegram, loginViaBrowserCode, loginViaDevSession,
    saveCharacter, saveSettings,
    persistShopOffer, loadOrGenerateShopOffer
  };
}
