import { createApp, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue/dist/vue.esm-bundler.js';
import './styles.css';
import { parseStartParams } from './api.js';
import { getRunAchievementsByIds } from '../../app/shared/run-achievements.js';

// Composables
import { useGameState } from './composables/useGameState.js';
import { useAuth } from './composables/useAuth.js';
import { useShop } from './composables/useShop.js';
import { useGameRun } from './composables/useGameRun.js';
import { useReplay } from './composables/useReplay.js';
import { useSocial } from './composables/useSocial.js';
import { useSSE } from './composables/useSSE.js';
import { useTouch } from './composables/useTouch.js';
import { useDevTools } from './composables/useDevTools.js';
import { useCustomization } from './composables/useCustomization.js';
import { useTelegramWebApp } from './composables/useTelegramWebApp.js';
import { createReducedMotionTracker } from './composables/useReducedMotion.js';

// Page components
// Legacy single-battle screens (ArtifactsScreen, BattlePrepScreen, ResultsScreen)
// were deleted 2026-04-13 along with the rest of the legacy flow.
import { AuthScreen } from './pages/AuthScreen.js';
import { OnboardingScreen } from './pages/OnboardingScreen.js';
import { HomeScreen } from './pages/HomeScreen.js';
import { CharactersScreen } from './pages/CharactersScreen.js';
import { PrepScreen } from './pages/PrepScreen.js';
import { ReplayScreen } from './pages/ReplayScreen.js';
import { RunCompleteScreen } from './pages/RunCompleteScreen.js';
import { RunSummaryScreen } from './pages/RunSummaryScreen.js';
import { FriendsScreen } from './pages/FriendsScreen.js';
import { LeaderboardScreen } from './pages/LeaderboardScreen.js';
import { WikiScreen } from './pages/WikiScreen.js';
import { WikiDetailScreen } from './pages/WikiDetailScreen.js';
import { RecipesScreen } from './pages/RecipesScreen.js';
import { FusionAnimationLabScreen } from './pages/FusionAnimationLabScreen.js';
import { ProfileScreen } from './pages/ProfileScreen.js';
import { SettingsScreen } from './pages/SettingsScreen.js';

// Existing components
import { ArtifactGridBoard } from './components/ArtifactGridBoard.js';
import { FighterCard } from './components/FighterCard.js';
import { ReplayDuel } from './components/ReplayDuel.js';
import { HomeSocialSidebar } from './components/HomeSocialSidebar.js';

const App = {
  components: {
    ArtifactGridBoard, FighterCard, ReplayDuel, HomeSocialSidebar,
    AuthScreen, OnboardingScreen, HomeScreen, CharactersScreen,
    PrepScreen,
    ReplayScreen, RunCompleteScreen, RunSummaryScreen, ProfileScreen,
    FriendsScreen, LeaderboardScreen, WikiScreen, WikiDetailScreen, RecipesScreen,
    FusionAnimationLabScreen, SettingsScreen
  },
  setup() {
    const startParams = parseStartParams();
    function readStoredTelegramGameContext() {
      try {
        return JSON.parse(sessionStorage.getItem('telegramGameContext') || 'null');
      } catch {
        return null;
      }
    }
    const telegramGameContext = startParams.telegramGameContext
      || readStoredTelegramGameContext();
    if (startParams.telegramGameContext) {
      sessionStorage.setItem('telegramGameContext', JSON.stringify(startParams.telegramGameContext));
    }

    const state = reactive({
      sessionKey: localStorage.getItem('sessionKey') || '',
      bootstrap: null,
      catalogCounts: { mushrooms: 0, artifacts: 0 },
      appConfig: { localAiLabEnabled: false, localDevAuthEnabled: false },
      authCode: null,
      loading: true,
      showLoading: !localStorage.getItem('sessionKey'),
      bootstrapReady: false,
      error: '',
      screen: startParams.screen || 'auth',
      telegramGameContext,
      lang: 'ru',
      builderItems: [],
      containerItems: [],
      activeBags: [],
      rotatedBags: [],
      freshPurchases: [],
      shopOffer: [],
      rerollSpent: 0,
      menuOpen: false,
      gameSidebarPanel: '',
      mobileHomeActionsMode: localStorage.getItem('mobileHomeActionsMode') || 'auto',
      draggingArtifactId: '',
      draggingItem: null,
      draggingBagId: '',
      draggingSource: '',
      currentBattle: null,
      replayIndex: 0,
      replayTimer: null,
      replaySpeed: 2,
      selectedWiki: null,
      wikiHome: null,
      friends: [],
      leaderboard: [],
      challenge: null,
      inventoryReviewSamples: [],
      localLab: [],
      localLabInput: 'Step 1: Thalla uses Spore Lash, deals 8 damage, and stuns the target.',
      gameRun: null,
      gameRunResult: null,
      gameRunRounds: [],
      gameRunSummary: null,
      gameRunShopOffer: [],
      gameRunRefreshCount: 0,
      fusionRevealQueue: [],
      abandonConfirmOpen: false,
      pendingAbandonCurrentPoints: 0,
      pendingAbandonPenalty: -2,
      pendingAbandonNetPoints: -2,
      startingFirstRun: false,
      sellDragOver: false,
      actionInFlight: false,
      opponentReady: false,
      sseConnected: true
    });

    // --- Composables ---
    const telegram = useTelegramWebApp();
    // Single source of truth for "should the UI animate?" — combines
    // matchMedia(prefers-reduced-motion: reduce) with the in-app
    // reducedMotion setting. Used by useGameState to gate View Transitions.
    // See docs/html5-ux-optimization-plan.md §V1 item 1.
    const motionTracker = createReducedMotionTracker();
    const gs = useGameState(state, {
      shouldAnimate: () => !motionTracker.getValue()
    });
    const auth = useAuth(state, gs.goTo, telegram);
    const replay = useReplay(state, gs.goTo, gs.getMushroom);
    const gameRun = useGameRun(state, gs.goTo, gs.getArtifact, auth.refreshBootstrap, replay.loadReplay, telegram);
    const shop = useShop(state, gs.getArtifact, gameRun.persistRunLoadout, telegram);
    const social = useSocial(state, gs.goTo);
    const sse = useSSE(state, gs.goTo, replay.loadReplay);
    const touch = useTouch(state);

    // --- Character pick: first-pick auto-starts a game run, re-pick goes home ---
    // Spec: docs/user-flows.md Flow A Step 3. Wrapping auth.saveCharacter here
    // (instead of inside useAuth) avoids a circular dependency on useGameRun,
    // which is constructed after useAuth.
    async function saveCharacter(mushroomId) {
      const expectedFirstPick = !state.bootstrap?.activeMushroomId;
      if (expectedFirstPick) {
        state.startingFirstRun = true;
        state.screen = 'firstRunStarting';
        state.menuOpen = false;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      try {
        const result = await auth.saveCharacter(mushroomId);
        if (result.failed) {
          if (expectedFirstPick) gs.goTo('characters');
          return;
        }
        if (result.wasFirstPick && !state.gameRun) {
          // First-pick branch: a brand-new player should not have to discover
          // "Start Game" on the home screen. Auto-start a solo run; the run
          // creates its own prep screen with the starter preset already seeded.
          await gameRun.startNewGameRun('solo', { skipTransition: true });
        } else {
          // Re-pick branch: existing player switching mushroom. Don't clobber
          // an active run by auto-starting a new one.
          gs.goTo('home');
        }
      } finally {
        state.startingFirstRun = false;
        if (state.screen === 'firstRunStarting') gs.goTo('characters');
      }
    }

    const customization = useCustomization(state, gs.refreshBootstrap);
    const devTools = useDevTools(state);

    function handleRunComplete() {
      state.gameRun = null;
      state.gameRunResult = null;
      state.gameRunRounds = [];
      auth.refreshBootstrap();
      gs.goTo('home');
    }

    async function handleRunRetry() {
      state.gameRun = null;
      state.gameRunResult = null;
      state.gameRunRounds = [];
      await auth.refreshBootstrap();
      await gameRun.startNewGameRun('solo');
    }

    function handleRunSummaryClose() {
      state.gameRunSummary = null;
      gs.goTo('home');
    }

    function completeFusionReveal() {
      state.fusionRevealQueue = state.fusionRevealQueue.slice(1);
    }

    function showGameSocialActions() {
      return state.screen === 'prep' || state.screen === 'replay';
    }

    function gameSidebarMode() {
      return state.mobileHomeActionsMode || 'auto';
    }

    function showGameBottomActions() {
      const mode = gameSidebarMode();
      return mode === 'always' || mode === 'auto';
    }

    function openGameSidebarPanel(panel) {
      state.gameSidebarPanel = panel;
    }

    function closeGameSidebarPanel() {
      state.gameSidebarPanel = '';
    }

    function activityDayLabel(date) {
      const tr = gs.t.value;
      const value = date ? new Date(date) : new Date();
      if (Number.isNaN(value.getTime())) return tr.today;
      const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const diff = Math.round((startOf(new Date()) - startOf(value)) / 86400000);
      if (diff <= 0) return tr.today;
      if (diff === 1) return tr.yesterday;
      return value.toLocaleDateString(state.lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' });
    }

    const gameActivityGroups = computed(() => {
      const tr = gs.t.value;
      const achievements = getRunAchievementsByIds(state.bootstrap?.season?.recentAchievements || [], state.lang || 'en')
        .slice(0, 4)
        .map((achievement) => ({
          id: `achievement-${achievement.id}`,
          title: achievement.name,
          meta: state.lang === 'ru' ? 'Достижение получено' : 'Achievement unlocked',
          type: 'achievement',
          achievement,
          at: new Date().toISOString()
        }));
      const runs = (state.bootstrap?.gameRunHistory || [])
        .slice(0, 4)
        .map((run) => {
          const described = gs.describeRun(run);
          const completedRounds = described?.completedRounds || 0;
          const title = tr.runActivityTitle
            .replace('{mode}', described?.modeLabel || tr.gameRuns)
            .replace('{outcome}', described?.outcomeLabel || tr.gameRuns)
            .replace('{rounds}', completedRounds);
          const meta = [
            described?.ourName || '',
            tr.runStatsRecord.replace('{wins}', described?.wins || 0).replace('{losses}', described?.losses || 0).replace('{rounds}', completedRounds),
            described?.dateLabel || ''
          ].filter(Boolean).join(' · ');
          return {
            id: `run-${run.id}`,
            title,
            meta,
            type: described?.outcomeKey || 'run',
            at: run.endedAt || run.startedAt || run.createdAt || new Date().toISOString()
          };
        });
      const groups = new Map();
      [...achievements, ...runs]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 8)
        .forEach((item) => {
          const label = activityDayLabel(item.at);
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label).push(item);
        });
      return Array.from(groups, ([label, items]) => ({ label, items }));
    });

    function fallbackScreenForRoute() {
      if (!state.sessionKey) return 'auth';
      if (!state.bootstrap?.activeMushroomId) return 'onboarding';
      return state.gameRun ? 'prep' : 'home';
    }

    async function handleLogout() {
      sse.disconnect();
      await auth.logout();
    }

    async function openRoute(startParams, routeOptions = {}) {
      const options = { routeOptions };
      if (startParams.screen === 'runComplete' && startParams.gameRunId && state.sessionKey) {
        await gameRun.loadRunComplete(startParams.gameRunId, options);
      } else if (startParams.screen === 'runSummary' && startParams.gameRunId && state.sessionKey) {
        await gameRun.loadRunSummary(startParams.gameRunId, options);
      } else if (['runComplete', 'runSummary'].includes(startParams.screen) && !startParams.gameRunId) {
        gs.goTo(fallbackScreenForRoute(), {}, routeOptions);
      } else if (startParams.replay && state.sessionKey) {
        await replay.loadReplay(startParams.replay, options);
      } else if (startParams.challenge && state.sessionKey) {
        await social.openChallenge(startParams.challenge, options);
      } else if (startParams.screen === 'game-run' && state.gameRun?.id === startParams.gameRunId) {
        gs.goTo('prep', {}, routeOptions);
      } else if (startParams.screen) {
        gs.goTo(startParams.screen, {}, routeOptions);
      }
    }

    async function onReplayFinish() {
      if (state.gameRun) {
        if (state.gameRun.status === 'completed' || state.gameRun.status === 'abandoned') {
          gs.goTo('runComplete', { gameRunId: state.gameRunResult?.id || state.gameRun.id });
        } else if (state.gameRunResult) {
          await gameRun.continueToNextRound();
        } else {
          // Replay loaded standalone (e.g. via URL param) but a game run is active —
          // return to prep instead of the results screen.
          gs.goTo('prep');
        }
      } else {
        // Standalone replay (no active game run) — return to home.
        // [Req 13-D] post-replay button says "Домой" so behavior must match label.
        // The user can re-open the run summary from home if needed.
        state.gameRunSummary = null;
        gs.goTo('home');
      }
    }

    // --- Watchers ---
    // Auto-dismiss errors after 5 seconds so stale messages don't linger.
    let errorDismissTimer = null;
    watch(() => state.error, (msg) => {
      if (errorDismissTimer) { clearTimeout(errorDismissTimer); errorDismissTimer = null; }
      if (msg) { errorDismissTimer = setTimeout(() => { state.error = ''; }, 5000); }
    });
    watch(() => state.lang, () => { document.documentElement.lang = state.lang; });
    watch(() => state.mobileHomeActionsMode, (mode) => {
      localStorage.setItem('mobileHomeActionsMode', mode || 'auto');
    });
    watch(() => state.bootstrap?.settings?.reducedMotion, (reduced) => {
      document.documentElement.classList.toggle('reduced-motion', !!reduced);
      motionTracker.setAppPreference(!!reduced);
    }, { immediate: true });
    watch(() => state.screen, async (screen, oldScreen) => {
      if (screen !== oldScreen) {
        await nextTick();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
      if (!showGameSocialActions()) {
        state.gameSidebarPanel = '';
      }
      if (screen === 'inventory-review' && gs.isLocalDevAuthEnabled.value && state.sessionKey) {
        await devTools.loadInventoryReview();
      }
      // SSE: connect when entering prep in challenge mode, disconnect when leaving
      const isChallengePrep = screen === 'prep' && state.gameRun?.mode === 'challenge';
      const wasChallengePrep = oldScreen === 'prep' && state.gameRun?.mode === 'challenge';
      if (isChallengePrep && !wasChallengePrep) {
        sse.connect();
      } else if (!isChallengePrep && wasChallengePrep) {
        sse.disconnect();
      }
    });

    // --- Mount ---
    let appRootEl = null;
    let cleanupTelegram = () => {};
    let cleanupPopstate = () => {};
    onMounted(async () => {
      cleanupTelegram = telegram.init();
      auth.applyTelegramTheme();
      // Attach touch handlers to the app root element
      appRootEl = document.getElementById('app');
      touch.attachTouch(appRootEl);
      await auth.refreshBootstrap();
      if (state.gameRun) gameRun.loadRunShopOffer();
      // [Req 12-B] If bootstrap detected a missed round result (combat
      // completed while disconnected), load the replay now that all
      // composables are initialized.
      if (state.pendingReconnectBattleId && state.sessionKey) {
        await replay.loadReplay(state.pendingReconnectBattleId);
        state.pendingReconnectBattleId = null;
      }
      await openRoute(parseStartParams(), { replaceHistory: true });
      const onPopstate = () => {
        openRoute(parseStartParams(), { skipHistory: true, skipTransition: true });
      };
      window.addEventListener('popstate', onPopstate);
      cleanupPopstate = () => window.removeEventListener('popstate', onPopstate);
      if (state.screen === 'inventory-review' && gs.isLocalDevAuthEnabled.value && state.sessionKey) {
        await devTools.loadInventoryReview();
      }
      // Connect SSE if resuming a challenge run
      if (state.screen === 'prep' && state.gameRun?.mode === 'challenge') {
        sse.connect();
      }
    });
    onUnmounted(() => {
      sse.disconnect();
      cleanupTelegram();
      cleanupPopstate();
      touch.detachTouch(appRootEl);
      motionTracker.destroy();
    });

    return {
      state, ...gs, ...shop, ...gameRun, ...replay, ...social,
      refreshBootstrap: auth.refreshBootstrap,
      loginViaTelegram: auth.loginViaTelegram,
      loginViaBrowserCode: auth.loginViaBrowserCode,
      loginViaDevSession: auth.loginViaDevSession,
      handleLogout,
      saveCharacter,
      completeFusionReveal,
      showGameSocialActions,
      gameSidebarMode,
      showGameBottomActions,
      openGameSidebarPanel,
      closeGameSidebarPanel,
      gameActivityGroups,
      ...customization,
      saveSettings: auth.saveSettings,
      ...devTools, handleRunComplete, handleRunRetry, handleRunSummaryClose, onReplayFinish,
      acceptChallenge: () => social.acceptChallenge(replay.autoplayReplay)
    };
  },
  template: `
    <div class="shell">
      <header v-if="state.sessionKey && state.bootstrap" class="app-header">
        <button class="menu-toggle" @click="toggleMenu" :aria-expanded="state.menuOpen" aria-label="Menu">
          <span class="menu-toggle-bar"></span>
          <span class="menu-toggle-bar"></span>
          <span class="menu-toggle-bar"></span>
        </button>
        <span class="app-header-title">{{ t.title }}</span>
        <div class="lang-toggle-group">
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'ru' }" @click="state.lang = 'ru'">RU</button>
          <button class="lang-toggle-btn" :class="{ active: state.lang === 'en' }" @click="state.lang = 'en'">EN</button>
        </div>
      </header>

      <template v-if="state.sessionKey && state.bootstrap && showGameSocialActions()">
        <div class="home-action-rail game-social-action-rail" :class="{ 'home-action-rail--mobile': gameSidebarMode() === 'side' }">
          <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openGameSidebarPanel('notifications')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openGameSidebarPanel('friends')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--recipes" :class="{ 'home-action-btn--fusion-candidate': hasFusionCandidates }" :aria-label="t.recipes" @click="openGameSidebarPanel('recipes')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M8 7h8M8 11h6"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="openGameSidebarPanel('settings')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
          </button>
        </div>

        <home-social-sidebar
          :open="!!state.gameSidebarPanel"
          :panel="state.gameSidebarPanel"
          :state="state"
          :t="t"
          :activity-groups="gameActivityGroups"
          :mobile-action-mode="gameSidebarMode()"
          :get-artifact="getArtifact"
          :format-artifact-bonus="formatArtifactBonus"
          :has-fusion-candidates="hasFusionCandidates"
          @close="closeGameSidebarPanel"
          @add-friend="addFriend($event)"
          @challenge-friend="challengeFriend($event)"
          @accept-challenge="acceptChallenge"
          @decline-challenge="declineChallenge"
          @set-mobile-action-mode="state.mobileHomeActionsMode = $event"
          @switch-panel="state.gameSidebarPanel = $event"
        />

        <div v-if="gameSidebarMode() === 'menu' && state.menuOpen" class="home-menu-actions game-menu-actions">
          <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openGameSidebarPanel('notifications')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openGameSidebarPanel('friends')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--recipes" :class="{ 'home-action-btn--fusion-candidate': hasFusionCandidates }" :aria-label="t.recipes" @click="openGameSidebarPanel('recipes')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M8 7h8M8 11h6"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="openGameSidebarPanel('settings')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
          </button>
        </div>

        <nav
          v-if="gameSidebarMode() !== 'menu'"
          class="home-bottom-actions game-bottom-actions"
          :class="{ 'home-bottom-actions--visible': showGameBottomActions() }"
          :aria-hidden="!showGameBottomActions()"
        >
          <button class="home-action-btn home-action-btn--notifications" :aria-label="t.notifications" @click="openGameSidebarPanel('notifications')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17H9m10-2-1.2-1.2A2.7 2.7 0 0 1 17 11.9V9a5 5 0 0 0-10 0v2.9c0 .7-.3 1.4-.8 1.9L5 15h14Zm-5.3 3a2 2 0 0 1-3.4 0"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--friends" :aria-label="t.friends" @click="openGameSidebarPanel('friends')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4m12 0c0-1.6-1-3-2.4-3.6M4 19c0-1.6 1-3 2.4-3.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-1a2.4 2.4 0 1 0 0-4.8M6 11a2.4 2.4 0 1 1 0-4.8"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--recipes" :class="{ 'home-action-btn--fusion-candidate': hasFusionCandidates }" :aria-label="t.recipes" @click="openGameSidebarPanel('recipes')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"/><path d="M8 7h8M8 11h6"/></svg>
          </button>
          <button class="home-action-btn home-action-btn--settings" :aria-label="t.settings" @click="openGameSidebarPanel('settings')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.4-2.2a7.7 7.7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.2 7.2 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.5h4l.3-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"/></svg>
          </button>
        </nav>
      </template>

      <div
        v-if="state.error"
        class="error app-notification app-notification--error"
        role="alert"
        aria-live="assertive"
        data-testid="error-notification"
      >
        {{ state.error }}
      </div>

      <section v-if="state.loading && state.showLoading" class="route-loading-screen" data-testid="app-loading">
        <div class="route-loading-card panel">
          <span class="route-loading-spinner" aria-hidden="true"></span>
          <h2>{{ t.title }}</h2>
        </div>
      </section>

      <auth-screen
        v-else-if="!state.sessionKey"
        :state="state" :t="t" :is-local-dev-auth-enabled="isLocalDevAuthEnabled"
        @login-telegram="loginViaTelegram"
        @login-browser="loginViaBrowserCode"
        @login-dev="loginViaDevSession"
      />

      <template v-else-if="state.bootstrap">
        <template v-if="state.menuOpen">
          <div class="nav-sidebar-backdrop" @click="state.menuOpen = false"></div>
          <aside class="nav-sidebar" aria-label="Menu">
            <div class="home-section-header">
              <h3>{{ t.title }}</h3>
              <button class="ghost nav-sidebar-close" @click="state.menuOpen = false" aria-label="Close">×</button>
            </div>
            <nav class="nav-sidebar-list">
              <button class="nav-btn" :class="{ active: state.screen === 'home' }" @click="goTo('home')">{{ t.home }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'characters' }" @click="goTo('characters')">{{ t.characters }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'friends' }" @click="goTo('friends')">{{ t.friends }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'leaderboard' }" @click="goTo('leaderboard')">{{ t.leaderboard }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'profile' }" @click="goTo('profile')">{{ t.profile }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'wiki' || state.screen === 'wiki-detail' }" @click="goTo('wiki')">{{ t.wiki }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'recipes' }" @click="goTo('recipes')">{{ t.recipes }}</button>
              <button v-if="isLocalDevAuthEnabled" class="nav-btn" :class="{ active: state.screen === 'fusion-lab' }" @click="goTo('fusion-lab')">{{ t.fusionLab }}</button>
              <button class="nav-btn" :class="{ active: state.screen === 'settings' }" @click="goTo('settings')">{{ t.settings }}</button>
              <button class="nav-btn nav-btn--logout" data-testid="menu-logout" @click="handleLogout">{{ t.logout }}</button>
            </nav>
          </aside>
        </template>

        <section v-if="state.screen === 'firstRunStarting' || state.startingFirstRun" class="route-loading-screen" data-testid="first-run-starting">
          <div class="route-loading-card panel">
            <span class="route-loading-spinner" aria-hidden="true"></span>
            <h2>{{ t.startingRun }}</h2>
          </div>
        </section>

        <onboarding-screen
          v-else-if="state.screen === 'onboarding'"
          :state="state"
          :t="t"
          :portrait-position="portraitPosition"
          @go="goTo($event)"
        />

        <home-screen v-else-if="state.screen === 'home'"
          :state="state" :t="t" :active-mushroom="activeMushroom" :builder-totals="builderTotals"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact" :get-mushroom="getMushroom"
          :describe-replay="describeReplay" :describe-run="describeRun" :format-delta="formatDelta"
          :format-artifact-bonus="formatArtifactBonus"
          :portrait-position="portraitPosition" :portrait-position-for="portraitPositionFor"
          @resume-run="resumeGameRun" @start-run="startNewGameRun($event)" @abandon-run="requestAbandonRun"
          @load-replay="loadReplay($event)" @load-run-summary="loadRunSummary($event)" @go="goTo($event)"
          @add-friend="addFriend($event)" @challenge-friend="challengeFriend($event)"
          @accept-challenge="acceptChallenge" @decline-challenge="declineChallenge"
          @select-mushroom="saveCharacter($event)"
          @switch-portrait="switchPortrait($event)" @switch-preset="switchPreset($event)"
        />

        <characters-screen v-else-if="state.screen === 'characters'"
          :state="state" :t="t" :portrait-position="portraitPosition"
          @save-character="saveCharacter($event)"
        />

        <section v-else-if="state.screen === 'bubble-review' && isLocalDevAuthEnabled" class="stack bubble-review-screen">
          <h2>Bubble Review</h2>
          <div class="bubble-review-grid">
            <section
              v-for="group in portraitReviewGroups()"
              :key="group.mushroomId"
              class="bubble-review-character"
              :data-mushroom-id="group.mushroomId"
            >
              <h3>{{ group.nameText }}</h3>
              <article class="panel battle-stage bubble-review-stage" v-for="item in group.items" :key="item.id">
                <replay-duel
                  :left-fighter="buildReplayFighter(item.mushroomId, { nameText: item.nameText, speechText: sampleBubbleText(item.mushroom), portraitId: item.portraitId, imagePath: item.imagePath })"
                  :right-fighter="buildReplayFighter(item.mushroomId, { nameText: item.nameText, portraitId: item.portraitId, imagePath: item.imagePath })"
                  :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
                  status-text=" "
                />
              </article>
            </section>
          </div>
        </section>

        <section v-else-if="state.screen === 'inventory-review' && isLocalDevAuthEnabled" class="stack bubble-review-screen">
          <h2>Inventory Review</h2>
          <div class="bubble-review-grid inventory-review-grid">
            <article class="panel battle-stage bubble-review-stage" v-for="sample in state.inventoryReviewSamples" :key="sample.id">
              <fighter-card
                :mushroom="getMushroom(sample.mushroomId)"
                :name-text="getMushroom(sample.mushroomId)?.name[state.lang] || sample.mushroomId"
                :health-text="getMushroom(sample.mushroomId)?.baseStats.health + ' HP'"
                :loadout="sample.loadout"
                :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
              />
            </article>
          </div>
        </section>

        <prep-screen v-else-if="state.screen === 'prep' && state.gameRun"
          :state="state" :t="t" :container-artifacts="containerArtifacts" :builder-totals="builderTotals"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          :format-artifact-bonus="formatArtifactBonus" :preferred-orientation="preferredOrientation"
          :get-artifact-price="getArtifactPrice" :effective-rows="effectiveRows()" :placement-preview-at="placementPreviewAt"
          :fusion-ingredient-row-ids="fusionIngredientRowIds"
          :fusion-candidate-row-ids="fusionCandidateRowIds"
          :fusion-candidate-shop-artifact-ids="fusionCandidateShopArtifactIds"
          @auto-place="autoPlaceFromContainer($event)" @container-drag-start="onContainerPieceDragStart($event[0] || $event, $event[1])"
          @drag-end="onDragEndAny" @container-dragover="onContainerDragOver($event)" @container-drop="onContainerDrop($event)"
          @unplace="unplaceToContainer($event)" @rotate="rotatePlacedArtifact($event)"
          @cell-drop="onInventoryCellDrop($event)" @inventory-drag-start="onInventoryPieceDragStart($event)"
          @buy-run-item="buyRunShopItem($event)" @refresh-shop="refreshRunShop"
          @sell-dragover="onSellZoneDragOver($event)" @sell-dragleave="onSellZoneDragLeave"
          @sell-drop="onSellZoneDrop($event)"
          @signal-ready="signalReady" @abandon="requestAbandonRun"
          @deactivate-bag="deactivateBag($event)"
          @rotate-bag="rotateBag($event)"
          @bag-chip-drag-start="onBagChipDragStart($event.bagId, $event.event)"
          @fusion-reveal-complete="completeFusionReveal"
        />

        <run-complete-screen v-else-if="state.screen === 'runComplete' && state.gameRunResult"
          :state="state" :t="t" @go-home="handleRunComplete" @play-again="handleRunRetry"
        />

        <section v-else-if="state.screen === 'runComplete'" class="route-loading-screen" data-testid="run-complete-loading">
          <div class="route-loading-card panel">
            <span class="route-loading-spinner" aria-hidden="true"></span>
            <h2>{{ t.runComplete }}</h2>
          </div>
        </section>

        <run-summary-screen v-else-if="state.screen === 'runSummary' && state.gameRunSummary"
          :state="state" :t="t" :get-mushroom="getMushroom" :portrait-position="portraitPosition"
          @go-home="handleRunSummaryClose" @load-replay="loadReplay($event)"
        />

        <section v-else-if="state.screen === 'runSummary'" class="route-loading-screen" data-testid="run-summary-loading">
          <div class="route-loading-card panel">
            <span class="route-loading-spinner" aria-hidden="true"></span>
            <h2>{{ t.runComplete }}</h2>
          </div>
        </section>

        <replay-screen v-else-if="state.screen === 'replay' && state.currentBattle"
          :state="state" :t="t" :format-delta="formatDelta"
          :active-event="activeEvent" :active-speech="activeSpeech" :battle-status-text="battleStatusText"
          :replay-finished="replayFinished" :active-replay-state="activeReplayState" :visible-replay-events="visibleReplayEvents"
          :long-battle-speed-boost="longBattleSpeedBoost"
          :build-replay-fighter="buildReplayFighter" :get-mushroom="getMushroom" :loadout-stats-text="loadoutStatsText"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          @go-results="onReplayFinish"
          @set-speed="setReplaySpeed($event)"
        />

        <section v-else-if="state.screen === 'history'" class="panel stack">
          <h2>{{ t.runHistory }}</h2>
          <p v-if="!state.bootstrap.gameRunHistory?.length">{{ t.noGameRunsYet }}</p>
          <ul v-else class="run-list">
            <li
              v-for="run in state.bootstrap.gameRunHistory"
              :key="run.id"
              class="run-card"
              :class="'run-card--' + (describeRun(run)?.outcomeKey || 'abandoned')"
              @click="loadRunSummary(run.id)"
              role="button" tabindex="0"
              @keydown.enter.prevent="loadRunSummary(run.id)"
              @keydown.space.prevent="loadRunSummary(run.id)"
            >
              <div class="run-card-header">
                <span class="run-card-outcome">{{ describeRun(run)?.outcomeLabel }}</span>
                <span class="run-card-meta">
                  <span class="run-card-kind">{{ describeRun(run)?.modeLabel }}</span>
                  <span class="run-card-date">{{ describeRun(run)?.dateLabel }}</span>
                </span>
              </div>
              <div class="run-card-matchup">
                <div class="run-card-fighter">
                  <img v-if="describeRun(run)?.ourImage" :src="describeRun(run).ourImage" :alt="describeRun(run)?.ourName" class="run-card-portrait" />
                  <span class="run-card-name">{{ describeRun(run)?.ourName }}</span>
                </div>
                <span class="run-card-vs">·</span>
                <span class="run-card-name">{{ t.runStatsRecord.replace('{wins}', describeRun(run)?.wins).replace('{losses}', describeRun(run)?.losses).replace('{rounds}', describeRun(run)?.completedRounds) }}</span>
              </div>
            </li>
          </ul>
        </section>

        <friends-screen v-else-if="state.screen === 'friends'"
          :state="state" :t="t"
          @add-friend="addFriend($event)" @challenge-friend="challengeFriend($event)"
          @accept-challenge="acceptChallenge" @decline-challenge="declineChallenge"
        />

        <leaderboard-screen v-else-if="state.screen === 'leaderboard'" :state="state" :t="t" />

        <wiki-screen v-else-if="state.screen === 'wiki'" :state="state" :t="t" @open-wiki="openWiki($event[0], $event[1])" />

        <wiki-detail-screen v-else-if="state.screen === 'wiki-detail' && state.selectedWiki"
          :state="state" :t="t" @go="goTo($event)" @open-wiki="openWiki($event[0], $event[1])"
        />

        <recipes-screen v-else-if="state.screen === 'recipes'"
          :state="state" :t="t" :get-artifact="getArtifact" :format-artifact-bonus="formatArtifactBonus"
        />

        <fusion-animation-lab-screen v-else-if="state.screen === 'fusion-lab' && isLocalDevAuthEnabled"
          :state="state" :t="t" :get-artifact="getArtifact"
        />

        <profile-screen v-else-if="state.screen === 'profile'" :state="state" :t="t" :get-mushroom="getMushroom" :portrait-position="portraitPosition" />

        <settings-screen v-else-if="state.screen === 'settings'" :state="state" :t="t" @save-settings="saveSettings" />

        <section v-else-if="state.screen === 'lab' && isLocalLabEnabled" class="panel stack">
          <h2>{{ t.lab }}</h2>
          <p>{{ t.localOnly }}</p>
          <textarea v-model="state.localLabInput" rows="6"></textarea>
          <button class="primary" @click="runLocalLab">Run</button>
          <article class="panel" v-for="result in state.localLab" :key="result.variant.name">
            <h3>{{ result.variant.name }}</h3>
            <p>{{ result.output }}</p>
          </article>
        </section>
      </template>

      <section v-else-if="state.sessionKey" class="route-loading-screen" data-testid="app-pending" aria-hidden="true"></section>

      <section v-else class="panel stack">
        <h2>{{ t.authTitle }}</h2>
        <p>{{ t.authTagline }}</p>
      </section>

      <div
        v-if="state.abandonConfirmOpen"
        class="confirm-backdrop"
        role="presentation"
        @click.self="cancelAbandonRun"
      >
        <section class="confirm-dialog panel" role="dialog" aria-modal="true" :aria-label="t.abandonConfirmTitle">
          <h2>{{ t.abandonConfirmTitle }}</h2>
          <p>{{ t.abandonConfirmBody }}</p>
          <p class="confirm-penalty">
            {{ t.abandonConfirmPenalty.replace('{points}', state.pendingAbandonPenalty) }}
          </p>
          <div class="confirm-rank-impact" aria-live="polite">
            <span>
              <span>{{ t.rankNoPenalty }}</span>
              <strong>{{ formatDelta(state.pendingAbandonCurrentPoints) }}</strong>
            </span>
            <span>
              <span>{{ t.rankExitNow }}</span>
              <strong>{{ formatDelta(state.pendingAbandonNetPoints) }}</strong>
            </span>
          </div>
          <div class="confirm-actions">
            <button class="ghost" :disabled="state.actionInFlight" @click="cancelAbandonRun">{{ t.cancel }}</button>
            <button class="primary confirm-danger" :disabled="state.actionInFlight" @click="confirmAbandonRun">{{ state.actionInFlight ? t.abandonConfirming : t.abandonConfirmAction }}</button>
          </div>
        </section>
      </div>
    </div>
  `
};

createApp(App).mount('#app');
