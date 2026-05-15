import { apiJson, parseStartParams } from '../api.js';
import { projectLoadoutItems } from './loadout-projection.js';
import { useTelegramWebApp } from './useTelegramWebApp.js';

const BOOTSTRAP_CACHE_KEY = 'mushroomBootstrapCache';
const WEB_CLIENT_ID_KEY = 'mushroomWebClientId';
const BOOTSTRAP_LOADER_DELAY_MS = 320;
const TELEGRAM_AUTH_POLL_INTERVAL_MS = 3000;
const TELEGRAM_AUTH_MAX_POLLS = 200;

export function extractTelegramInitData({ win = globalThis.window, telegram } = {}) {
  const directInitData = telegram?.getWebApp?.()?.initData || win?.Telegram?.WebApp?.initData;
  if (typeof directInitData === 'string' && directInitData.trim()) {
    return directInitData.trim();
  }

  const candidates = [];
  if (win?.location?.search) candidates.push(win.location.search.replace(/^\?/, ''));
  if (win?.location?.hash) {
    const hashQuery = String(win.location.hash).split('?')[1] || String(win.location.hash).replace(/^#/, '');
    candidates.push(hashQuery);
  }

  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate);
    const raw = params.get('tgWebAppData');
    if (!raw) continue;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  return '';
}

export function useAuth(state, goTo, telegram = useTelegramWebApp()) {
  function navigate(screen, extra = {}, options = {}) {
    if (typeof goTo === 'function') {
      goTo(screen, extra, options);
    } else {
      state.screen = screen;
    }
  }

  function applyTelegramTheme() {
    telegram.applyTelegramTheme();
    telegram.syncViewportVars();
  }

  function readCachedBootstrap(sessionKey) {
    if (typeof sessionStorage === 'undefined' || !sessionKey) return null;
    try {
      const cached = JSON.parse(sessionStorage.getItem(BOOTSTRAP_CACHE_KEY) || 'null');
      if (cached?.sessionKey !== sessionKey || !cached.bootstrap) return null;
      return cached.bootstrap;
    } catch {
      return null;
    }
  }

  function writeCachedBootstrap(sessionKey, bootstrap) {
    if (typeof sessionStorage === 'undefined' || !sessionKey || !bootstrap) return;
    try {
      sessionStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({
        sessionKey,
        bootstrap,
        cachedAt: Date.now()
      }));
    } catch {
      // Best-effort cache. Storage quota/private mode should not affect play.
    }
  }

  function clearCachedBootstrap() {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
    } catch {}
  }

  function clearSessionState() {
    clearCachedBootstrap();
    localStorage.removeItem('sessionKey');
    state.sessionKey = '';
    state.bootstrap = null;
    state.authCode = null;
    state.friends = [];
    state.leaderboard = [];
    state.wikiHome = null;
    state.builderItems = [];
    state.containerItems = [];
    state.activeBags = [];
    state.rotatedBags = [];
    state.freshPurchases = [];
    state.gameRun = null;
    state.gameRunResult = null;
    state.gameRunSummary = null;
    state.gameRunShopOffer = [];
    state.gameRunRefreshCount = 0;
    state.fusionRevealQueue = [];
    state.currentBattle = null;
    state.challenge = null;
    state.pendingReconnectBattleId = null;
    state.menuOpen = false;
  }

  function applyBootstrapData(bootstrap) {
    state.bootstrap = bootstrap;
    state.lang = state.bootstrap.settings.lang;
    // bootstrap.loadout / bootstrap.shopState are always null after the
    // 2026-04-13 legacy deletion. The active run's grid is hydrated below
    // from bootstrap.activeGameRun.loadoutItems.
    state.builderItems = [];
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
      const artifactById = new Map(allArtifacts.map((a) => [a.id, a]));
      const loadoutItems = state.bootstrap.activeGameRun.loadoutItems || [];
      const projected = projectLoadoutItems(loadoutItems, bagsSet, (id) => artifactById.get(id));
      state.builderItems = projected.builderItems;
      state.containerItems = projected.containerItems;
      state.activeBags = projected.activeBags;
      state.rotatedBags = projected.rotatedBags;
      state.freshPurchases = projected.freshPurchases;
    } else {
      state.gameRun = null;
      state.gameRunShopOffer = [];
      state.containerItems = [];
      state.activeBags = [];
      state.rotatedBags = [];
      state.freshPurchases = [];
    }
  }

  function fallbackScreenAfterBootstrap() {
    if (!state.bootstrap?.activeMushroomId) return 'onboarding';
    return state.gameRun ? 'prep' : 'home';
  }

  function scheduleLoader() {
    if (state.bootstrap) return null;
    state.showLoading = false;
    return globalThis.setTimeout(() => {
      state.showLoading = true;
      state.loading = true;
    }, BOOTSTRAP_LOADER_DELAY_MS);
  }

  async function refreshBootstrap() {
    try {
      state.appConfig = await apiJson('/api/app-config');
    } catch (_error) {
      state.appConfig = { localAiLabEnabled: false, localDevAuthEnabled: false };
    }
    try {
      const [characters, artifacts] = await Promise.all([
        apiJson('/api/characters'),
        apiJson('/api/artifacts')
      ]);
      state.catalogCounts = {
        mushrooms: characters.mushrooms?.length || 0,
        artifacts: artifacts.artifacts?.length || 0
      };
    } catch (_error) {
      state.catalogCounts = { mushrooms: 0, artifacts: 0 };
    }
    if (!state.sessionKey) {
      navigate('auth');
      state.loading = false;
      state.showLoading = true;
      return;
    }
    const cachedBootstrap = readCachedBootstrap(state.sessionKey);
    if (cachedBootstrap) {
      applyBootstrapData(cachedBootstrap);
      state.loading = false;
    }
    const loadingTimer = scheduleLoader();
    // bootstrapReady is a deterministic "prep screen has finished projecting
    // server state into UI buckets" signal. Tests wait on
    // `[data-testid="prep-ready"]` (set in PrepScreen) which mirrors this
    // flag — replaces polling against `.prep-screen` visibility which can
    // race the loadoutItems → containerItems projection during cold Vite.
    state.bootstrapReady = false;
    try {
      const bootstrap = await apiJson('/api/bootstrap', {}, state.sessionKey);
      applyBootstrapData(bootstrap);
      writeCachedBootstrap(state.sessionKey, bootstrap);
      try { state.friends = await apiJson('/api/friends', {}, state.sessionKey); } catch { state.friends = []; }
      try { state.leaderboard = await apiJson('/api/leaderboard', {}, state.sessionKey); } catch { state.leaderboard = []; }
      try { state.wikiHome = await apiJson('/api/wiki/home'); } catch { state.wikiHome = null; }
      // URL-driven deep link: /game-run/:id loads the active run into prep
      // when the ids match (§2.7 bookmarkable runs).
      const urlParams = parseStartParams();
      const urlWantsGameRun = urlParams.screen === 'game-run' && urlParams.gameRunId;
      const urlMissingRequiredRunId = ['runComplete', 'runSummary'].includes(urlParams.screen) && !urlParams.gameRunId;

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
      if (missedRoundResult) {
        state.gameRunResult = {
          id: run.id,
          mode: run.mode,
          status: run.status,
          currentRound: run.currentRound,
          endedAt: run.endedAt || null,
          endReason: run.endReason || null,
          completionBonus: null,
          season: null,
          achievements: [],
          fusions: Array.isArray(run.pendingFusions) ? run.pendingFusions : [],
          player: run.player || null,
          lastRound,
          rounds: run.rounds || []
        };
      }

      if (!state.bootstrap.activeMushroomId) {
        navigate('onboarding');
      } else if (urlMissingRequiredRunId) {
        navigate(fallbackScreenAfterBootstrap());
      } else if (urlWantsGameRun && state.gameRun && state.gameRun.id === urlParams.gameRunId) {
        navigate('prep');
      } else if (urlWantsGameRun && !state.gameRun) {
        // Deep link to a game run that's no longer active — drop to home.
        navigate('home');
      } else if (missedRoundResult) {
        // [Req 12-B] Will be routed to replay by main.js after loadReplay is available
        navigate('prep');
      } else if (isReconnecting) {
        navigate(state.gameRun ? 'prep' : 'home');
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
      clearSessionState();
      navigate('auth');
    } finally {
      if (loadingTimer) clearTimeout(loadingTimer);
      state.loading = false;
      state.showLoading = false;
      state.bootstrapReady = true;
    }
  }

  let authPollTimer = null;
  function clearAuthPoll() {
    if (authPollTimer != null) {
      clearTimeout(authPollTimer);
      authPollTimer = null;
    }
  }

  function openTelegramAuthLink(botUrl) {
    if (!botUrl) return;
    const tg = telegram.getWebApp?.();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(botUrl);
      return;
    }
    globalThis.open?.(botUrl, '_blank', 'noopener,noreferrer');
  }

  async function verifyTelegramAuthCode(privateCode) {
    const response = await fetch('/api/auth/telegram/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privateCode })
    });
    const json = await response.json();
    if (!json.success && !json.needsBotAuth) {
      throw new Error(json.error || 'Telegram bot login failed');
    }
    return json;
  }

  function pollTelegramAuthCode(privateCode, attempt = 0) {
    clearAuthPoll();
    authPollTimer = globalThis.setTimeout(async () => {
      try {
        const result = await verifyTelegramAuthCode(privateCode);
        if (result.success) {
          state.sessionKey = result.data.sessionKey;
          localStorage.setItem('sessionKey', result.data.sessionKey);
          state.authCode = null;
          await refreshBootstrap();
          return;
        }
        if (attempt + 1 >= TELEGRAM_AUTH_MAX_POLLS) {
          state.authCode = null;
          state.error = state.lang === 'ru'
            ? 'Вход через Telegram не подтверждён. Попробуй ещё раз.'
            : 'Telegram login was not confirmed. Try again.';
          return;
        }
        pollTelegramAuthCode(privateCode, attempt + 1);
      } catch (error) {
        state.authCode = null;
        state.error = error.message || 'Telegram bot login failed';
      }
    }, TELEGRAM_AUTH_POLL_INTERVAL_MS);
  }

  async function startTelegramBotCodeLogin() {
    const data = await apiJson('/api/auth/telegram/code', { method: 'POST' });
    state.authCode = data;
    openTelegramAuthLink(data.botUrl);
    pollTelegramAuthCode(data.privateCode);
  }

  async function loginViaTelegram() {
    clearAuthPoll();
    state.error = '';
    try {
      const initData = extractTelegramInitData({ telegram });
      if (!initData) {
        await startTelegramBotCodeLogin();
        return;
      }
      const data = await apiJson('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      state.authCode = null;
      await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Telegram login failed';
    }
  }

  function cancelTelegramCodeLogin() {
    clearAuthPoll();
    state.authCode = null;
  }

  async function loginViaBrowserCode() {
    clearAuthPoll();
    let clientId = localStorage.getItem(WEB_CLIENT_ID_KEY);
    if (!clientId) {
      clientId = globalThis.crypto?.randomUUID?.() || `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(WEB_CLIENT_ID_KEY, clientId);
    }
    try {
      const data = await apiJson('/api/auth/web', {
        method: 'POST',
        body: JSON.stringify({ clientId, lang: state.lang })
      });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      state.authCode = null;
      await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Browser login failed';
    }
  }

  async function loginViaDevSession() {
    clearAuthPoll();
    try {
      state.error = '';
      const data = await apiJson('/api/dev/session', { method: 'POST', body: JSON.stringify({}) });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      await refreshBootstrap();
    } catch (error) {
      state.error = error.message || 'Dev login failed';
    }
  }

  async function logout() {
    clearAuthPoll();
    const sessionKey = state.sessionKey;
    state.error = '';
    if (sessionKey) {
      try {
        await apiJson('/api/auth/logout', { method: 'POST' }, sessionKey);
      } catch {
        // Local logout should still clear this device even if the session
        // already expired or the network request fails.
      }
    }
    clearSessionState();
    state.loading = false;
    state.showLoading = true;
    state.bootstrapReady = false;
    navigate('auth', {}, { replaceHistory: true });
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
      // First pick chains immediately into startNewGameRun(). A full bootstrap
      // here briefly re-renders the character list between the click and the
      // round-1 prep redirect, which reads as a route flicker.
      if (wasFirstPick) return { wasFirstPick };
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
          battleSpeed: state.bootstrap.settings.battleSpeed,
          replaySpeed: state.bootstrap.settings.replaySpeed
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
    cancelTelegramCodeLogin,
    logout,
    saveCharacter, saveSettings
  };
}
