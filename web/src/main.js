import { createApp, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue/dist/vue.esm-bundler.js';
import './styles.css';
import { parseStartParams } from './api.js';

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
import { FriendsScreen } from './pages/FriendsScreen.js';
import { LeaderboardScreen } from './pages/LeaderboardScreen.js';
import { WikiScreen } from './pages/WikiScreen.js';
import { WikiDetailScreen } from './pages/WikiDetailScreen.js';
import { SettingsScreen } from './pages/SettingsScreen.js';

// Existing components
import { ArtifactGridBoard } from './components/ArtifactGridBoard.js';
import { FighterCard } from './components/FighterCard.js';
import { ReplayDuel } from './components/ReplayDuel.js';

const App = {
  components: {
    ArtifactGridBoard, FighterCard, ReplayDuel,
    AuthScreen, OnboardingScreen, HomeScreen, CharactersScreen,
    PrepScreen,
    ReplayScreen, RunCompleteScreen,
    FriendsScreen, LeaderboardScreen, WikiScreen, WikiDetailScreen, SettingsScreen
  },
  setup() {
    const state = reactive({
      sessionKey: localStorage.getItem('sessionKey') || '',
      bootstrap: null,
      appConfig: { localAiLabEnabled: false, localDevAuthEnabled: false },
      authCode: null,
      loading: true,
      bootstrapReady: false,
      error: '',
      screen: parseStartParams().screen || 'auth',
      lang: 'ru',
      builderItems: [],
      containerItems: [],
      activeBags: [],
      rotatedBags: [],
      freshPurchases: [],
      shopOffer: [],
      rerollSpent: 0,
      menuOpen: false,
      draggingArtifactId: '',
      draggingItem: null,
      draggingSource: '',
      currentBattle: null,
      replayIndex: 0,
      replayTimer: null,
      replaySpeed: 1,
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
      gameRunShopOffer: [],
      gameRunRefreshCount: 0,
      sellDragOver: false,
      actionInFlight: false,
      opponentReady: false,
      sseConnected: true
    });

    // --- Composables ---
    const telegram = useTelegramWebApp();
    const gs = useGameState(state);
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
      const result = await auth.saveCharacter(mushroomId);
      if (result.failed) return;
      if (result.wasFirstPick && !state.gameRun) {
        // First-pick branch: a brand-new player should not have to discover
        // "Start Game" on the home screen. Auto-start a solo run; the run
        // creates its own prep screen with the starter preset already seeded.
        await gameRun.startNewGameRun('solo');
      } else {
        // Re-pick branch: existing player switching mushroom. Don't clobber
        // an active run by auto-starting a new one.
        gs.goTo('home');
      }
    }

    const customization = useCustomization(state, gs.refreshBootstrap);
    const devTools = useDevTools(state);

    function handleRunComplete() {
      state.gameRun = null;
      state.gameRunResult = null;
      auth.refreshBootstrap();
      gs.goTo('home');
    }

    async function onReplayFinish() {
      if (state.gameRun) {
        if (state.gameRun.status === 'completed' || state.gameRun.status === 'abandoned') {
          gs.goTo('runComplete');
        } else if (state.gameRunResult) {
          await gameRun.continueToNextRound();
        } else {
          // Replay loaded standalone (e.g. via URL param) but a game run is active —
          // return to prep instead of the results screen.
          gs.goTo('prep');
        }
      } else {
        // Standalone replay (no active game run) — return to home
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
    watch(() => state.bootstrap?.settings?.reducedMotion, (reduced) => {
      document.documentElement.classList.toggle('reduced-motion', !!reduced);
    });
    watch(() => state.screen, async (screen, oldScreen) => {
      if (screen !== oldScreen) {
        await nextTick();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
      const startParams = parseStartParams();
      if (startParams.challenge && state.sessionKey) await social.openChallenge(startParams.challenge);
      if (startParams.replay && state.sessionKey) await replay.loadReplay(startParams.replay);
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
      touch.detachTouch(appRootEl);
    });

    return {
      state, ...gs, ...shop, ...gameRun, ...replay, ...social,
      refreshBootstrap: auth.refreshBootstrap,
      loginViaTelegram: auth.loginViaTelegram,
      loginViaBrowserCode: auth.loginViaBrowserCode,
      loginViaDevSession: auth.loginViaDevSession,
      saveCharacter,
      ...customization,
      saveSettings: auth.saveSettings,
      ...devTools, handleRunComplete, onReplayFinish,
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

      <p v-if="state.error" class="error">{{ state.error }}</p>

      <section v-if="state.loading" class="auth-screen">
        <div class="auth-hero-card panel">
          <h2 class="auth-title">{{ t.authTitle }}</h2>
          <p class="auth-tagline">{{ t.authTagline }}</p>
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
        <nav v-if="state.menuOpen" class="nav-dropdown">
          <button class="nav-btn" @click="goTo('home')">{{ t.home }}</button>
          <button class="nav-btn" @click="goTo('characters')">{{ t.characters }}</button>
          <button class="nav-btn" @click="goTo('friends')">{{ t.friends }}</button>
          <button class="nav-btn" @click="goTo('leaderboard')">{{ t.leaderboard }}</button>
          <button class="nav-btn" @click="goTo('wiki')">{{ t.wiki }}</button>
          <button class="nav-btn" @click="goTo('settings')">{{ t.settings }}</button>
        </nav>

        <onboarding-screen v-if="state.screen === 'onboarding'" :state="state" :t="t" @go="goTo($event)" />

        <home-screen v-else-if="state.screen === 'home'"
          :state="state" :t="t" :active-mushroom="activeMushroom" :builder-totals="builderTotals"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact" :get-mushroom="getMushroom"
          :describe-replay="describeReplay" :format-delta="formatDelta" :portrait-position="portraitPosition"
          @resume-run="resumeGameRun" @start-run="startNewGameRun($event)" @abandon-run="abandonRun"
          @load-replay="loadReplay($event)" @go="goTo($event)"
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
            <article class="panel battle-stage bubble-review-stage" v-for="mushroom in state.bootstrap.mushrooms" :key="mushroom.id">
              <replay-duel
                :left-fighter="buildReplayFighter(mushroom.id, { nameText: mushroom.name[state.lang], speechText: sampleBubbleText(mushroom) })"
                :right-fighter="buildReplayFighter(mushroom.id, { nameText: mushroom.name[state.lang] })"
                :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
                status-text=" "
              />
            </article>
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
          :get-artifact-price="getArtifactPrice" :effective-rows="effectiveRows()"
          @auto-place="autoPlaceFromContainer($event)" @container-drag-start="onContainerPieceDragStart($event[0] || $event, $event[1])"
          @drag-end="onDragEndAny" @container-dragover="onContainerDragOver($event)" @container-drop="onContainerDrop($event)"
          @unplace="unplaceToContainer($event)" @rotate="rotatePlacedArtifact($event)"
          @cell-drop="onInventoryCellDrop($event)" @inventory-drag-start="onInventoryPieceDragStart($event)"
          @buy-run-item="buyRunShopItem($event)" @refresh-shop="refreshRunShop"
          @sell-dragover="onSellZoneDragOver($event)" @sell-dragleave="onSellZoneDragLeave"
          @sell-drop="onSellZoneDrop($event)"
          @signal-ready="signalReady" @abandon="abandonRun"
          @deactivate-bag="deactivateBag($event)"
          @rotate-bag="rotateBag($event)"
        />

        <run-complete-screen v-else-if="state.screen === 'runComplete'"
          :state="state" :t="t" @go-home="handleRunComplete"
        />

        <replay-screen v-else-if="state.screen === 'replay' && state.currentBattle"
          :state="state" :t="t" :format-delta="formatDelta"
          :active-event="activeEvent" :active-speech="activeSpeech" :battle-status-text="battleStatusText"
          :replay-finished="replayFinished" :active-replay-state="activeReplayState" :visible-replay-events="visibleReplayEvents"
          :build-replay-fighter="buildReplayFighter" :get-mushroom="getMushroom" :loadout-stats-text="loadoutStatsText"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          @go-results="onReplayFinish"
          @set-speed="setReplaySpeed($event)"
        />

        <section v-else-if="state.screen === 'history'" class="panel stack">
          <h2>{{ t.history }}</h2>
          <p v-if="!state.bootstrap.battleHistory?.length">{{ t.noReplays }}</p>
          <ul v-else class="replay-list">
            <li
              v-for="battle in state.bootstrap.battleHistory"
              :key="battle.id"
              class="replay-card"
              :class="'replay-card--' + (describeReplay(battle)?.outcomeKey || 'draw')"
              @click="loadReplay(battle.id)"
              role="button" tabindex="0"
              @keydown.enter.prevent="loadReplay(battle.id)"
              @keydown.space.prevent="loadReplay(battle.id)"
            >
              <div class="replay-card-header">
                <span class="replay-card-outcome">{{ describeReplay(battle)?.outcomeLabel }}</span>
                <span class="replay-card-meta">
                  <span class="replay-card-kind">{{ describeReplay(battle)?.opponentKindLabel }}</span>
                  <span class="replay-card-date">{{ describeReplay(battle)?.dateLabel }}</span>
                </span>
              </div>
              <div class="replay-card-matchup">
                <div class="replay-card-fighter">
                  <img v-if="describeReplay(battle)?.ourImage" :src="describeReplay(battle).ourImage" :alt="describeReplay(battle)?.ourName" class="replay-card-portrait" />
                  <span class="replay-card-name">{{ describeReplay(battle)?.ourName }}</span>
                </div>
                <span class="replay-card-vs">vs</span>
                <div class="replay-card-fighter">
                  <img v-if="describeReplay(battle)?.oppImage" :src="describeReplay(battle).oppImage" :alt="describeReplay(battle)?.oppName" class="replay-card-portrait" />
                  <span class="replay-card-name">{{ describeReplay(battle)?.oppName }}</span>
                </div>
              </div>
              <div class="replay-card-rewards" v-if="describeReplay(battle)?.ratingDelta != null || describeReplay(battle)?.sporeDelta || describeReplay(battle)?.myceliumDelta">
                <span v-if="describeReplay(battle)?.ratingDelta != null" class="replay-chip">{{ t.rating }} {{ formatDelta(describeReplay(battle).ratingDelta) }}</span>
                <span v-if="describeReplay(battle)?.sporeDelta" class="replay-chip">{{ t.spore }} {{ formatDelta(describeReplay(battle).sporeDelta) }}</span>
                <span v-if="describeReplay(battle)?.myceliumDelta" class="replay-chip">{{ t.mycelium }} {{ formatDelta(describeReplay(battle).myceliumDelta) }}</span>
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

        <section v-else-if="state.screen === 'profile'" class="profile-screen stack">
          <h2>{{ t.profile }}</h2>
          <div class="grid cards profile-card-grid">
            <article class="panel" v-for="entry in Object.values(state.bootstrap.progression)" :key="entry.mushroomId">
              <h3>{{ getMushroom(entry.mushroomId)?.name?.[state.lang] || entry.mushroomId }}</h3>
              <p>{{ t.level }} {{ entry.level }}</p>
              <p>{{ t.mycelium }} {{ entry.mycelium }}</p>
            </article>
          </div>
        </section>

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

      <section v-else class="panel stack">
        <h2>{{ t.authTitle }}</h2>
        <p>{{ t.authTagline }}</p>
      </section>
    </div>
  `
};

createApp(App).mount('#app');
