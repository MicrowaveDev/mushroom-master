import { apiJson, parseStartParams } from '../api.js';
import { projectLoadoutItems } from './loadout-projection.js';

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

  // loadOrGenerateShopOffer / persistShopOffer (legacy 5-coin shop blob
  // synced to /api/shop-state) deleted 2026-04-13. Game-run prep state is
  // hydrated from bootstrap.activeGameRun in refreshBootstrap below; the
  // legacy single-battle prep flow is gone.
  //
  // The names persist as no-ops because they're injected into useShop and
  // useGameRun via constructor params and called in many places. Routing the
  // call to a stub keeps those call sites valid without forcing every shop
  // helper to learn whether it's in a run or not.
  function persistShopOffer() { /* no-op */ }
  function loadOrGenerateShopOffer() { /* no-op */ }

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
    // bootstrapReady is a deterministic "prep screen has finished projecting
    // server state into UI buckets" signal. Tests wait on
    // `[data-testid="prep-ready"]` (set in PrepScreen) which mirrors this
    // flag — replaces polling against `.prep-screen` visibility which can
    // race the loadoutItems → containerItems projection during cold Vite.
    state.bootstrapReady = false;
    try {
      state.bootstrap = await apiJson('/api/bootstrap', {}, state.sessionKey);
      state.lang = state.bootstrap.settings.lang;
      // bootstrap.loadout / bootstrap.shopState are always null after the
      // 2026-04-13 legacy deletion. The active run's grid is hydrated below
      // from bootstrap.activeGameRun.loadoutItems.
      state.builderItems = [];
      try { state.friends = await apiJson('/api/friends', {}, state.sessionKey); } catch { state.friends = []; }
      try { state.leaderboard = await apiJson('/api/leaderboard', {}, state.sessionKey); } catch { state.leaderboard = []; }
      try { state.wikiHome = await apiJson('/api/wiki/home'); } catch { state.wikiHome = null; }
      if (state.bootstrap.activeGameRun) {
        state.gameRun = state.bootstrap.activeGameRun;
        state.gameRunShopOffer = state.bootstrap.activeGameRun.shopOffer || [];

        // Single-source projection (§2.5): derive all UI state buckets from
        // the server's loadoutItems array via the pure projectLoadoutItems
        // helper. See loadout-projection.js for the routing rules and
        // docs/bag-active-persistence.md / docs/bag-rotated-persistence.md /
        // docs/client-row-id-refactor.md for the design context.
        const allArtifacts = state.bootstrap?.artifacts || [];
        const bagsSet = new Set(allArtifacts.filter((a) => a.family === 'bag').map((a) => a.id));
        const loadoutItems = state.bootstrap.activeGameRun.loadoutItems || [];
        const projected = projectLoadoutItems(loadoutItems, bagsSet);
        state.builderItems = projected.builderItems;
        state.containerItems = projected.containerItems;
        state.activeBags = projected.activeBags;
        state.rotatedBags = projected.rotatedBags;
        state.freshPurchases = projected.freshPurchases;
      } else {
        state.gameRun = null;
      }
      // URL-driven deep link: /game-run/:id loads the active run into prep
      // when the ids match (§2.7 bookmarkable runs).
      const urlParams = parseStartParams();
      const urlWantsGameRun = urlParams.screen === 'game-run' && urlParams.gameRunId;

      // [Req 12-A/12-B] Reconnection detection: if a round was completed
      // while the player was away (e.g. challenge mode where the *opponent*
      // triggered resolveRound), store the missed battleId so main.js can
      // route to the replay after bootstrap completes.
      //
      // SOLO MODE EXCLUDED: in solo mode the player triggers resolveRound
      // themselves, so they have already seen the result before any
      // subsequent reload. Treating a solo reload as a "missed result"
      // would re-show the result of an already-acknowledged round and
      // bounce the user away from the next-round prep screen they
      // intentionally navigated to. (Pre-2026-04-13 bug fix.)
      const isReconnecting = state.screen === 'auth' || state.screen === 'game-run' || !state.screen;
      const run = state.gameRun;
      const lastRound = run?.rounds?.length ? run.rounds[run.rounds.length - 1] : null;
      const missedRoundResult = isReconnecting && run && run.mode === 'challenge' && lastRound &&
        lastRound.roundNumber === run.currentRound - 1 && lastRound.battleId &&
        !state.gameRunResult;

      // Store missed battle for main.js to pick up after bootstrap
      state.pendingReconnectBattleId = missedRoundResult ? lastRound.battleId : null;

      if (!state.bootstrap.activeMushroomId) {
        state.screen = 'onboarding';
      } else if (urlWantsGameRun && state.gameRun && state.gameRun.id === urlParams.gameRunId) {
        state.screen = 'prep';
      } else if (urlWantsGameRun && !state.gameRun) {
        // Deep link to a game run that's no longer active — drop to home.
        state.screen = 'home';
      } else if (missedRoundResult) {
        // [Req 12-B] Will be routed to replay by main.js after loadReplay is available
        state.screen = 'prep';
      } else if (isReconnecting) {
        state.screen = state.gameRun ? 'prep' : 'home';
      }
    } catch (error) {
      // 401 "Authentication required" is an expected state (expired/invalid
      // session) — silently redirect to auth instead of flashing an error.
      if (!/authentication required/i.test(error.message)) {
        state.error = error.message;
      }
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
      state.bootstrapReady = true;
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

  /**
   * Persist the player's mushroom selection.
   *
   * Returns `{ wasFirstPick }` so the caller can decide whether to chain into
   * an auto-started game run (first-pick branch) or just navigate to home
   * (re-pick branch). The actual navigation lives in main.js so this composable
   * doesn't need a circular reference to useGameRun.
   *
   * Spec: docs/user-flows.md Flow A Step 3.
   */
  async function saveCharacter(mushroomId) {
    try {
      const wasFirstPick = !state.bootstrap?.activeMushroomId;
      await apiJson('/api/active-character', { method: 'PUT', body: JSON.stringify({ mushroomId }) }, state.sessionKey);
      await refreshBootstrap();
      return { wasFirstPick };
    } catch (error) {
      state.error = error.message || 'Could not save character';
      return { wasFirstPick: false, failed: true };
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
