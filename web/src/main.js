import { createApp, reactive, onMounted, onUnmounted, watch } from 'vue/dist/vue.esm-bundler.js';
import './styles.css';
import { parseStartParams } from './api.js';
import { apiJson } from './api.js';
import { MAX_ARTIFACT_COINS } from './constants.js';

// Composables
import { useGameState } from './composables/useGameState.js';
import { useAuth } from './composables/useAuth.js';
import { useShop } from './composables/useShop.js';
import { useGameRun } from './composables/useGameRun.js';
import { useReplay } from './composables/useReplay.js';
import { useSocial } from './composables/useSocial.js';
import { useSSE } from './composables/useSSE.js';
import { useTouch } from './composables/useTouch.js';

// Page components
import { AuthScreen } from './pages/AuthScreen.js';
import { OnboardingScreen } from './pages/OnboardingScreen.js';
import { HomeScreen } from './pages/HomeScreen.js';
import { CharactersScreen } from './pages/CharactersScreen.js';
import { ArtifactsScreen } from './pages/ArtifactsScreen.js';
import { PrepScreen } from './pages/PrepScreen.js';
import { BattlePrepScreen } from './pages/BattlePrepScreen.js';
import { ReplayScreen } from './pages/ReplayScreen.js';
import { ResultsScreen } from './pages/ResultsScreen.js';
import { RoundResultScreen } from './pages/RoundResultScreen.js';
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
    ArtifactsScreen, PrepScreen, BattlePrepScreen,
    ReplayScreen, ResultsScreen, RoundResultScreen, RunCompleteScreen,
    FriendsScreen, LeaderboardScreen, WikiScreen, WikiDetailScreen, SettingsScreen
  },
  setup() {
    const state = reactive({
      sessionKey: localStorage.getItem('sessionKey') || '',
      bootstrap: null,
      appConfig: { localAiLabEnabled: false, localDevAuthEnabled: false },
      authCode: null,
      loading: true,
      error: '',
      screen: parseStartParams().screen || 'auth',
      lang: 'ru',
      builderItems: [],
      containerItems: [],
      freshPurchases: [],
      shopOffer: [],
      rerollSpent: 0,
      menuOpen: false,
      draggingArtifactId: '',
      draggingSource: '',
      currentBattle: null,
      replayIndex: 0,
      replayTimer: null,
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
      opponentReady: false
    });

    // --- Composables ---
    const gs = useGameState(state);
    const auth = useAuth(state, gs.goTo);
    const shop = useShop(state, gs.getArtifact, auth.persistShopOffer);
    const gameRun = useGameRun(state, gs.goTo, gs.getArtifact, auth.refreshBootstrap, auth.persistShopOffer);
    const replay = useReplay(state, gs.goTo, gs.getMushroom);
    const social = useSocial(state, gs.goTo);
    const sse = useSSE(state, gs.goTo);
    const touch = useTouch(state);

    // --- Battle (legacy single-duel) ---
    async function saveLoadout() {
      if (state.actionInFlight) return;
      if (!state.bootstrap?.activeMushroomId) { state.error = gs.t.value.invalidLoadout; return; }
      const freshCost = state.freshPurchases.reduce((sum, id) => sum + gs.getArtifactPrice(gs.getArtifact(id)), 0);
      if (freshCost + state.rerollSpent > MAX_ARTIFACT_COINS) { state.error = gs.t.value.invalidLoadout; return; }
      state.actionInFlight = true;
      try {
        await apiJson('/api/artifact-loadout', {
          method: 'PUT',
          body: JSON.stringify({ mushroomId: state.bootstrap.activeMushroomId, items: state.builderItems })
        }, state.sessionKey);
        await auth.refreshBootstrap();
        gs.goTo('battle');
      } catch (error) {
        state.error = error.message || 'Could not save loadout';
      } finally {
        state.actionInFlight = false;
      }
    }

    async function startBattle() {
      if (state.actionInFlight) return;
      state.actionInFlight = true;
      try {
        state.error = '';
        state.currentBattle = await apiJson('/api/battles', {
          method: 'POST',
          body: JSON.stringify({ mode: 'ghost', idempotencyKey: crypto.randomUUID() })
        }, state.sessionKey);
        state.replayIndex = 0;
        state.rerollSpent = 0;
        state.freshPurchases = [];
        shop.rerollShop(true);
        gs.goTo('replay', { replay: state.currentBattle.id });
        replay.autoplayReplay();
      } catch (error) {
        state.error = error.message || 'Could not start battle';
      } finally {
        state.actionInFlight = false;
      }
    }

    // --- Dev-only ---
    async function runLocalLab() {
      const results = await apiJson('/api/local-tests/battle-narration', {
        method: 'POST',
        body: JSON.stringify({
          fixtureNarration: state.localLabInput,
          variants: [
            { name: 'compact-ru', model: 'gpt-4.1-mini', prompt: 'Сделай короткое боевое описание на русском.' },
            { name: 'dramatic-en', model: 'gpt-4.1-mini', prompt: 'Write a dramatic but compact English battle recap.' }
          ]
        })
      }, state.sessionKey);
      state.localLab = results.results;
    }

    async function loadInventoryReview() {
      state.inventoryReviewSamples = await apiJson('/api/dev/inventory-review', {}, state.sessionKey);
    }

    function handleRunComplete() {
      state.gameRun = null;
      state.gameRunResult = null;
      auth.refreshBootstrap();
      gs.goTo('home');
    }

    // --- Watchers ---
    watch(() => state.lang, () => { document.documentElement.lang = state.lang; });
    watch(() => state.screen, async (screen, oldScreen) => {
      if (screen === 'inventory-review' && gs.isLocalDevAuthEnabled.value && state.sessionKey) {
        await loadInventoryReview();
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
    onMounted(async () => {
      auth.applyTelegramTheme();
      // Attach touch handlers to the app root element
      appRootEl = document.getElementById('app');
      touch.attachTouch(appRootEl);
      await auth.refreshBootstrap();
      const startParams = parseStartParams();
      if (startParams.challenge && state.sessionKey) await social.openChallenge(startParams.challenge);
      if (startParams.replay && state.sessionKey) await replay.loadReplay(startParams.replay);
      if (state.screen === 'inventory-review' && gs.isLocalDevAuthEnabled.value && state.sessionKey) {
        await loadInventoryReview();
      }
      // Connect SSE if resuming a challenge run
      if (state.screen === 'prep' && state.gameRun?.mode === 'challenge') {
        sse.connect();
      }
    });
    onUnmounted(() => {
      sse.disconnect();
      touch.detachTouch(appRootEl);
    });

    return {
      state, ...gs, ...shop, ...gameRun, ...replay, ...social,
      refreshBootstrap: auth.refreshBootstrap,
      loginViaTelegram: auth.loginViaTelegram,
      loginViaBrowserCode: auth.loginViaBrowserCode,
      loginViaDevSession: auth.loginViaDevSession,
      saveCharacter: auth.saveCharacter,
      saveSettings: auth.saveSettings,
      saveLoadout, startBattle,
      runLocalLab, loadInventoryReview, handleRunComplete,
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
          <button class="nav-btn" @click="goTo('artifacts')">{{ t.artifacts }}</button>
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

        <artifacts-screen v-else-if="state.screen === 'artifacts'"
          :state="state" :t="t" :remaining-coins="remainingCoins" :builder-totals="builderTotals"
          :shop-artifacts="shopArtifacts" :container-artifacts="containerArtifacts"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact" :get-artifact-price="getArtifactPrice"
          :format-artifact-bonus="formatArtifactBonus" :preferred-orientation="preferredOrientation"
          @buy="buyFromShop($event)" @return-to-shop="returnToShop($event)"
          @auto-place="autoPlaceFromContainer($event)" @unplace="unplaceToContainer($event)"
          @rotate="rotatePlacedArtifact($event)" @save-loadout="saveLoadout" @reroll="rerollShop($event)"
          @container-dragover="onContainerDragOver($event)" @container-drop="onContainerDrop($event)"
          @container-drag-start="onContainerPieceDragStart($event[0] || $event, $event[1])"
          @shop-dragover="onShopDragOver($event)" @shop-drop="onShopDrop($event)"
          @shop-drag-start="onShopPieceDragStart($event[0] || $event, $event[1])"
          @cell-drop="onInventoryCellDrop($event)" @inventory-drag-start="onInventoryPieceDragStart($event)"
          @drag-end="onDragEndAny"
        />

        <prep-screen v-else-if="state.screen === 'prep' && state.gameRun"
          :state="state" :t="t" :container-artifacts="containerArtifacts" :builder-totals="builderTotals"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          :format-artifact-bonus="formatArtifactBonus" :preferred-orientation="preferredOrientation"
          :get-artifact-price="getArtifactPrice"
          @auto-place="autoPlaceFromContainer($event)" @container-drag-start="onContainerPieceDragStart($event[0] || $event, $event[1])"
          @drag-end="onDragEndAny" @container-dragover="onContainerDragOver($event)" @container-drop="onContainerDrop($event)"
          @unplace="unplaceToContainer($event)" @rotate="rotatePlacedArtifact($event)"
          @cell-drop="onInventoryCellDrop($event)" @inventory-drag-start="onInventoryPieceDragStart($event)"
          @buy-run-item="buyRunShopItem($event)" @refresh-shop="refreshRunShop"
          @sell-dragover="onSellZoneDragOver($event)" @sell-dragleave="onSellZoneDragLeave"
          @sell-drop="onSellZoneDrop($event)"
          @signal-ready="signalReady" @abandon="abandonRun"
        />

        <round-result-screen v-else-if="state.screen === 'roundResult' && state.gameRunResult"
          :state="state" :t="t" :format-delta="formatDelta"
          @continue="continueToNextRound" @view-replay="viewRoundReplay($event)"
        />

        <run-complete-screen v-else-if="state.screen === 'runComplete'"
          :state="state" :t="t" @go-home="handleRunComplete"
        />

        <battle-prep-screen v-else-if="state.screen === 'battle' && activeMushroom"
          :state="state" :t="t" :active-mushroom="activeMushroom" :builder-totals="builderTotals"
          :used-coins="usedCoins" :max-coins="maxCoins" :portrait-position="portraitPosition"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          @start-battle="startBattle"
        />

        <replay-screen v-else-if="state.screen === 'replay' && state.currentBattle"
          :state="state" :t="t"
          :active-event="activeEvent" :active-speech="activeSpeech" :battle-status-text="battleStatusText"
          :replay-finished="replayFinished" :active-replay-state="activeReplayState" :visible-replay-events="visibleReplayEvents"
          :build-replay-fighter="buildReplayFighter" :get-mushroom="getMushroom" :loadout-stats-text="loadoutStatsText"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          @go-results="goTo('results')"
        />

        <results-screen v-else-if="state.screen === 'results' && state.currentBattle"
          :state="state" :t="t" :get-mushroom="getMushroom" :loadout-stats-text="loadoutStatsText"
          :result-speech="resultSpeech" :replay-bubble-style="replayBubbleStyle"
          :render-artifact-figure="renderArtifactFigure" :get-artifact="getArtifact"
          @go-home="goTo('home')"
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
          :state="state" :t="t" @go="goTo($event)"
        />

        <section v-else-if="state.screen === 'profile'" class="grid cards">
          <article class="panel" v-for="entry in Object.values(state.bootstrap.progression)" :key="entry.mushroomId">
            <h3>{{ entry.mushroomId }}</h3>
            <p>{{ t.level }} {{ entry.level }}</p>
            <p>{{ t.mycelium }} {{ entry.mycelium }}</p>
          </article>
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
