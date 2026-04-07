import { createApp, reactive, ref, computed, onMounted, watch } from 'vue/dist/vue.esm-bundler.js';
import './styles.css';
import { defaultReplayPortraitConfig, replayPortraitConfigByMushroom } from './replay-portrait-config.js';
import {
  INVENTORY_COLUMNS,
  INVENTORY_ROWS,
  MAX_ARTIFACT_COINS,
  SHOP_OFFER_SIZE,
  REROLL_COST,
  MAX_INVENTORY_PIECES,
  readReplayDelay
} from './constants.js';
import { messages } from './i18n.js';
import { apiJson, parseStartParams, setScreenQuery } from './api.js';
import {
  buildOccupancy,
  deriveTotals,
  getArtifactPrice,
  pickRandomShopOffer,
  preferredOrientation
} from './artifacts/grid.js';
import { renderArtifactFigure } from './artifacts/render.js';
import { formatReplayEvent } from './replay/format.js';
import { ArtifactGridBoard } from './components/ArtifactGridBoard.js';
import { FighterCard } from './components/FighterCard.js';
import { ReplayDuel } from './components/ReplayDuel.js';

const DEFAULT_REPLAY_AUTOPLAY_MS = readReplayDelay(import.meta.env.VITE_REPLAY_AUTOPLAY_MS, 1200);
const DEFAULT_REPLAY_AUTOPLAY_FAST_MS = readReplayDelay(import.meta.env.VITE_REPLAY_AUTOPLAY_FAST_MS, 600);

const App = {
  components: {
    ArtifactGridBoard,
    FighterCard,
    ReplayDuel
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
      localLabInput: 'Round 1: Thalla uses Spore Lash, deals 8 damage, and stuns the target.'
    });

    const t = computed(() => messages[state.lang] || messages.ru);
    const isLocalLabEnabled = computed(() => state.appConfig.localAiLabEnabled);
    const isLocalDevAuthEnabled = computed(() => state.appConfig.localDevAuthEnabled);
    const activeEvent = computed(() => state.currentBattle?.events?.[state.replayIndex] || null);
    const activeReplayDisplay = computed(() =>
      formatReplayEvent(activeEvent.value, state.currentBattle, (mushroomId) => getMushroom(mushroomId)?.name?.[state.lang] || getMushroom(mushroomId)?.name?.en, (mushroomId) => getMushroom(mushroomId)?.active?.name?.[state.lang])
    );
    const replayFinished = computed(() => {
      if (!state.currentBattle?.events?.length) {
        return false;
      }
      return state.replayIndex >= state.currentBattle.events.length - 1;
    });
    const activeSpeech = computed(() => {
      if (!activeReplayDisplay.value?.speechSide || !activeReplayDisplay.value?.speechText) {
        return null;
      }
      return {
        side: activeReplayDisplay.value.speechSide,
        narration: activeReplayDisplay.value.speechText
      };
    });
    const battleStatusText = computed(() => activeReplayDisplay.value?.statusText || '');
    const visibleReplayEvents = computed(() => {
      if (!state.currentBattle?.events?.length) {
        return [];
      }
      return state.currentBattle.events
        .slice(0, state.replayIndex + 1)
        .map((event, index) => ({
          ...event,
          replayIndex: index,
          display: formatReplayEvent(event, state.currentBattle, (mushroomId) => getMushroom(mushroomId)?.name?.[state.lang] || getMushroom(mushroomId)?.name?.en, (mushroomId) => getMushroom(mushroomId)?.active?.name?.[state.lang])
        }))
        .reverse();
    });

    function applyTelegramTheme() {
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        return;
      }
      tg.ready();
      tg.expand();
      const theme = tg.themeParams || {};
      const root = document.documentElement;
      root.style.setProperty('--telegram-accent', theme.button_color || '#7b5b3b');
      root.style.setProperty('--telegram-surface', theme.secondary_bg_color || '#f6f0df');
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
        // Prefer shop state's builder items (unsaved session) over the DB loadout,
        // unless the shop state is empty and the DB has items.
        state.builderItems = shopBuilderItems.length ? shopBuilderItems : [...savedLoadout];
        loadOrGenerateShopOffer();
        state.friends = await apiJson('/api/friends', {}, state.sessionKey);
        state.leaderboard = await apiJson('/api/leaderboard', {}, state.sessionKey);
        state.wikiHome = await apiJson('/api/wiki/home');
        if (!state.bootstrap.activeMushroomId) {
          state.screen = 'onboarding';
        } else if (state.screen === 'auth') {
          state.screen = 'home';
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
      const data = await apiJson('/api/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData })
      });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      await refreshBootstrap();
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
        } catch (_error) {
        }
        window.setTimeout(poll, 3000);
      };
      window.open(state.authCode.botUrl, '_blank');
      poll();
    }

    async function loginViaDevSession() {
      state.error = '';
      const data = await apiJson('/api/dev/session', { method: 'POST', body: JSON.stringify({}) });
      state.sessionKey = data.sessionKey;
      localStorage.setItem('sessionKey', data.sessionKey);
      state.screen = 'home';
      await refreshBootstrap();
    }

    async function saveCharacter(mushroomId) {
      await apiJson(
        '/api/active-character',
        { method: 'PUT', body: JSON.stringify({ mushroomId }) },
        state.sessionKey
      );
      await refreshBootstrap();
      goTo('artifacts');
    }

    function goTo(screen, extra = {}) {
      state.screen = screen;
      state.menuOpen = false;
      setScreenQuery(screen, extra);
    }

    function toggleMenu() {
      state.menuOpen = !state.menuOpen;
    }

    function getArtifact(artifactId) {
      return state.bootstrap?.artifacts?.find((item) => item.id === artifactId) || null;
    }

    function getMushroom(mushroomId) {
      return state.bootstrap?.mushrooms?.find((item) => item.id === mushroomId) || null;
    }

    function mushroomDisplayName(mushroomId) {
      const mushroom = getMushroom(mushroomId);
      return mushroom?.name?.[state.lang] || mushroom?.name?.en || mushroomId || '';
    }

    function formatReplayDate(value) {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      try {
        const locale = state.lang === 'ru' ? 'ru-RU' : 'en-US';
        return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) +
          ' · ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return date.toISOString().slice(0, 16).replace('T', ' ');
      }
    }

    function describeReplay(battle) {
      if (!battle) return null;
      const viewerId = battle.viewerPlayerId || state.bootstrap?.player?.id;
      const leftSnap = battle.snapshots?.left || {};
      const rightSnap = battle.snapshots?.right || {};
      const viewerSide = leftSnap.playerId === viewerId
        ? 'left'
        : rightSnap.playerId === viewerId
          ? 'right'
          : 'left';
      const oppSide = viewerSide === 'left' ? 'right' : 'left';
      const ourMushroomId = battle.snapshots?.[viewerSide]?.mushroomId;
      const oppMushroomId = battle.snapshots?.[oppSide]?.mushroomId;

      let outcomeKey = 'draw';
      if (battle.winnerSide) {
        outcomeKey = battle.winnerSide === viewerSide ? 'win' : 'loss';
      } else if (battle.outcome === 'draw') {
        outcomeKey = 'draw';
      } else if (battle.outcome === 'win' || battle.outcome === 'victory') {
        outcomeKey = 'win';
      } else if (battle.outcome === 'loss' || battle.outcome === 'defeat') {
        outcomeKey = 'loss';
      }

      const outcomeLabel = outcomeKey === 'win'
        ? t.value.outcomeWin
        : outcomeKey === 'loss'
          ? t.value.outcomeLoss
          : t.value.outcomeDraw;

      const opponentKindLabel = battle.opponentKind === 'bot'
        ? t.value.opponentBot
        : battle.opponentKind === 'ghost'
          ? t.value.opponentGhost
          : battle.opponentKind === 'friend'
            ? t.value.opponentFriend
            : t.value.opponentPlayer;

      const viewerReward = (battle.rewards || []).find((r) => r.playerId === viewerId) || null;
      const ratingDelta = viewerReward && viewerReward.ratingAfter != null && viewerReward.ratingBefore != null
        ? viewerReward.ratingAfter - viewerReward.ratingBefore
        : null;

      return {
        outcomeKey,
        outcomeLabel,
        ourName: mushroomDisplayName(ourMushroomId),
        oppName: mushroomDisplayName(oppMushroomId),
        ourImage: getMushroom(ourMushroomId)?.imagePath || '',
        oppImage: getMushroom(oppMushroomId)?.imagePath || '',
        opponentKindLabel,
        mode: battle.mode || '',
        dateLabel: formatReplayDate(battle.createdAt),
        sporeDelta: viewerReward?.sporeDelta ?? null,
        myceliumDelta: viewerReward?.myceliumDelta ?? null,
        ratingDelta
      };
    }

    function formatArtifactBonus(artifact) {
      if (!artifact?.bonus) return [];
      const labels = state.lang === 'ru'
        ? { damage: 'Урон', armor: 'Броня', speed: 'Скорость', stunChance: 'Оглушение' }
        : { damage: 'Damage', armor: 'Armor', speed: 'Speed', stunChance: 'Stun' };
      const result = [];
      for (const [key, raw] of Object.entries(artifact.bonus)) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value === 0) continue;
        const sign = value > 0 ? '+' : '';
        const suffix = key === 'stunChance' ? '%' : '';
        result.push({ key, label: labels[key] || key, value: `${sign}${value}${suffix}`, positive: value > 0 });
      }
      return result;
    }

    function formatDelta(value) {
      if (value == null) return '';
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return n === 0 ? '0' : '';
      return n > 0 ? '+' + n : String(n);
    }

    function replayBubbleStyle(mushroomId) {
      const layout = replayPortraitConfigByMushroom[mushroomId] || defaultReplayPortraitConfig;
      return {
        '--bubble-top': layout.top,
        '--bubble-inset-left': layout.insetLeft,
        '--bubble-inset-right': layout.insetRight,
        '--bubble-tail-left': layout.tailLeft,
        '--fighter-object-position': layout.imagePosition
      };
    }

    function sampleBubbleText(mushroom) {
      if (!mushroom) {
        return '';
      }
      return state.lang === 'ru'
        ? `Я использую ${mushroom.active.name.ru} и наношу 16 урона.`
        : `I use ${mushroom.active.name.en} for 16 damage.`;
    }

    function buildReplayFighter(mushroomId, options = {}) {
      const mushroom = getMushroom(mushroomId);
      return {
        mushroom,
        nameText: options.nameText || mushroom?.name?.[state.lang] || mushroom?.name?.en || mushroomId || '',
        healthText: options.healthText || '',
        statsText: options.statsText || '',
        speechText: options.speechText || '',
        loadout: options.loadout || null,
        bubbleStyle: mushroomId ? replayBubbleStyle(mushroomId) : {}
      };
    }

    function loadoutStatsText(loadout) {
      if (!loadout?.items?.length) {
        return '';
      }
      const totals = deriveTotals(loadout.items, state.bootstrap?.artifacts || []);
      const parts = [];
      if (totals.damage) parts.push(`Урон +${totals.damage}`);
      if (totals.armor) parts.push(`Броня +${totals.armor}`);
      if (totals.speed) parts.push(`Скорость +${totals.speed}`);
      if (totals.stunChance) parts.push(`Оглушение +${totals.stunChance}%`);
      return parts.join(' / ');
    }

    function pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function resultSpeech(side, outcome) {
      const tr = t.value;
      if (outcome === 'draw') {
        return pick(side === 'left' ? tr.resultPlayerDraw : tr.resultOpponentDraw);
      }
      const isWinner = (side === 'left') === (outcome === 'win');
      if (side === 'left') {
        return pick(isWinner ? tr.resultPlayerWin : tr.resultPlayerLoss);
      }
      return pick(isWinner ? tr.resultOpponentWin : tr.resultOpponentLoss);
    }

    function portraitPosition(mushroomId) {
      return (replayPortraitConfigByMushroom[mushroomId] || defaultReplayPortraitConfig).imagePosition;
    }

    function artifactGridStyle(item) {
      return {
        gridColumn: `${item.x + 1} / span ${item.width}`,
        gridRow: `${item.y + 1} / span ${item.height}`
      };
    }

    function normalizePlacement(artifact, x, y, width, height) {
      const w = width || artifact.width;
      const h = height || artifact.height;
      const candidate = {
        artifactId: artifact.id,
        x,
        y,
        width: w,
        height: h
      };
      const next = state.builderItems.filter((item) => item.artifactId !== artifact.id);
      const occupied = buildOccupancy(next);
      if (x + w > INVENTORY_COLUMNS || y + h > INVENTORY_ROWS) {
        return null;
      }
      for (let dx = 0; dx < w; dx += 1) {
        for (let dy = 0; dy < h; dy += 1) {
          if (occupied.has(`${x + dx}:${y + dy}`)) {
            return null;
          }
        }
      }
      next.push(candidate);
      return next;
    }

    function rotatePlacedArtifact(item) {
      const artifact = state.bootstrap?.artifacts?.find((a) => a.id === item.artifactId);
      if (!artifact || artifact.width === artifact.height) {
        return;
      }
      const newWidth = item.height;
      const newHeight = item.width;
      // Check if rotated shape fits at current x,y against other items.
      const others = state.builderItems.filter((it) => it.artifactId !== item.artifactId);
      const occupied = buildOccupancy(others);
      if (item.x + newWidth > INVENTORY_COLUMNS || item.y + newHeight > INVENTORY_ROWS) {
        state.error = t.value.invalidLoadout;
        return;
      }
      for (let dx = 0; dx < newWidth; dx += 1) {
        for (let dy = 0; dy < newHeight; dy += 1) {
          if (occupied.has(`${item.x + dx}:${item.y + dy}`)) {
            state.error = t.value.invalidLoadout;
            return;
          }
        }
      }
      state.builderItems = state.builderItems.map((it) =>
        it.artifactId === item.artifactId
          ? { ...it, width: newWidth, height: newHeight }
          : it
      );
      state.error = '';
    }

    function removeArtifact(artifactId) {
      state.builderItems = state.builderItems.filter((item) => item.artifactId !== artifactId);
    }

    // ---- Shop / coin budget ----
    function persistShopOffer() {
      if (!state.sessionKey) return;
      const payload = {
        offer: state.shopOffer,
        container: state.containerItems,
        freshPurchases: state.freshPurchases,
        builderItems: state.builderItems,
        rerollSpent: state.rerollSpent
      };
      // Fire-and-forget save to backend.
      apiJson('/api/shop-state', {
        method: 'PUT',
        body: JSON.stringify(payload)
      }, state.sessionKey).catch(() => { /* ignore */ });
    }

    function loadOrGenerateShopOffer() {
      const artifactsList = state.bootstrap?.artifacts || [];
      const builderIds = new Set(state.builderItems.map((i) => i.artifactId));
      const stored = state.bootstrap?.shopState || null;

      const available = new Set(artifactsList.map((a) => a.id));
      if (stored?.container?.length) {
        state.containerItems = stored.container.filter(
          (id) => available.has(id) && !builderIds.has(id)
        );
      }
      state.rerollSpent = stored?.rerollSpent || 0;
      if (stored?.freshPurchases?.length) {
        state.freshPurchases = stored.freshPurchases.filter((id) => available.has(id));
      }

      const ownedIds = new Set([...builderIds, ...state.containerItems]);
      if (stored?.offer?.length) {
        state.shopOffer = stored.offer.filter(
          (id) => available.has(id) && !ownedIds.has(id)
        );
      } else {
        state.shopOffer = pickRandomShopOffer(artifactsList, ownedIds);
      }
      // Only backfill to 5 when generating a fresh offer (no stored state).
      if (!stored && state.shopOffer.length < SHOP_OFFER_SIZE) {
        const exclude = new Set([...state.shopOffer, ...ownedIds]);
        const extras = pickRandomShopOffer(artifactsList, exclude).slice(
          0,
          SHOP_OFFER_SIZE - state.shopOffer.length
        );
        state.shopOffer = [...state.shopOffer, ...extras];
      }
      persistShopOffer();
    }

    function rerollShop(free) {
      if (!free) {
        if (remainingCoins.value < REROLL_COST) {
          state.error = state.lang === 'ru'
            ? `Недостаточно монет для обновления (нужна ${REROLL_COST})`
            : `Not enough coins to reroll (need ${REROLL_COST})`;
          return;
        }
        state.rerollSpent += REROLL_COST;
      }
      const ownedIds = new Set([
        ...state.builderItems.map((i) => i.artifactId),
        ...state.containerItems
      ]);
      state.shopOffer = pickRandomShopOffer(state.bootstrap?.artifacts || [], ownedIds);
      persistShopOffer();
    }

    function computeUsedCoins() {
      // Only count coins spent THIS round: fresh purchases (wherever they are now) + rerolls.
      const freshCost = state.freshPurchases.reduce((sum, id) => {
        return sum + getArtifactPrice(getArtifact(id));
      }, 0);
      return freshCost + state.rerollSpent;
    }

    // ---- Shop → Container (buy) ----
    function buyFromShop(artifactId) {
      const artifact = getArtifact(artifactId);
      if (!artifact) return false;
      const price = getArtifactPrice(artifact);
      if (price > remainingCoins.value) {
        state.error = state.lang === 'ru'
          ? `Недостаточно монет (нужно ${price}, осталось ${remainingCoins.value})`
          : `Not enough coins (need ${price}, left ${remainingCoins.value})`;
        return false;
      }
      state.shopOffer = state.shopOffer.filter((id) => id !== artifactId);
      state.containerItems = [...state.containerItems, artifactId];
      state.freshPurchases = [...state.freshPurchases, artifactId];
      state.error = '';
      persistShopOffer();
      return true;
    }

    function getSellPrice(artifactId) {
      const artifact = getArtifact(artifactId);
      const full = getArtifactPrice(artifact);
      return state.freshPurchases.includes(artifactId) ? full : Math.max(1, Math.floor(full / 2));
    }

    // ---- Container → Shop (refund/sell) ----
    function returnToShop(artifactId) {
      if (!state.containerItems.includes(artifactId)) return;
      state.containerItems = state.containerItems.filter((id) => id !== artifactId);
      state.freshPurchases = state.freshPurchases.filter((id) => id !== artifactId);
      if (!state.shopOffer.includes(artifactId)) {
        state.shopOffer = [...state.shopOffer, artifactId];
      }
      persistShopOffer();
    }

    // ---- Container → Inventory (place) ----
    function placeFromContainer(artifactId, x, y) {
      const artifact = getArtifact(artifactId);
      if (!artifact) return false;
      const preferred = preferredOrientation(artifact);
      const orientations = [preferred];
      if (artifact.width !== artifact.height) {
        orientations.push({ width: preferred.height, height: preferred.width });
      }
      for (const orientation of orientations) {
        const next = normalizePlacement(artifact, x, y, orientation.width, orientation.height);
        if (next) {
          state.builderItems = next;
          state.containerItems = state.containerItems.filter((id) => id !== artifactId);
          state.error = '';
          persistShopOffer();
          return true;
        }
      }
      state.error = state.lang === 'ru' ? 'Не помещается' : 'Does not fit here';
      return false;
    }

    // ---- Container → Inventory (auto-place by click) ----
    function autoPlaceFromContainer(artifactId) {
      const artifact = getArtifact(artifactId);
      if (!artifact) return;
      const orientations = [preferredOrientation(artifact)];
      if (artifact.width !== artifact.height) {
        orientations.push({ width: orientations[0].height, height: orientations[0].width });
      }
      for (const o of orientations) {
        for (let y = 0; y < INVENTORY_ROWS; y += 1) {
          for (let x = 0; x < INVENTORY_COLUMNS; x += 1) {
            const next = normalizePlacement(artifact, x, y, o.width, o.height);
            if (next) {
              state.builderItems = next;
              state.containerItems = state.containerItems.filter((id) => id !== artifactId);
              state.error = '';
              persistShopOffer();
              return;
            }
          }
        }
      }
      state.error = state.lang === 'ru' ? 'Не помещается в инвентарь' : 'Does not fit in inventory';
    }

    // ---- Inventory → Container (unplace) ----
    function unplaceToContainer(artifactId) {
      if (!state.builderItems.some((i) => i.artifactId === artifactId)) return;
      state.builderItems = state.builderItems.filter((i) => i.artifactId !== artifactId);
      if (!state.containerItems.includes(artifactId)) {
        state.containerItems = [...state.containerItems, artifactId];
      }
      persistShopOffer();
    }

    // ---- Drag-and-drop handlers ----
    function onInventoryCellDrop({ x, y }) {
      const artifactId = state.draggingArtifactId;
      if (!artifactId) return;
      if (state.draggingSource === 'container') {
        placeFromContainer(artifactId, x, y);
      } else if (state.draggingSource === 'inventory') {
        const item = state.builderItems.find((i) => i.artifactId === artifactId);
        if (!item) return;
        const others = state.builderItems.filter((i) => i.artifactId !== artifactId);
        const occupied = buildOccupancy(others);
        const w = item.width;
        const h = item.height;
        if (x + w > INVENTORY_COLUMNS || y + h > INVENTORY_ROWS) return;
        for (let dx = 0; dx < w; dx += 1) {
          for (let dy = 0; dy < h; dy += 1) {
            if (occupied.has(`${x + dx}:${y + dy}`)) return;
          }
        }
        state.builderItems = [...others, { ...item, x, y }];
        persistShopOffer();
      }
    }

    function onContainerDrop(event) {
      event.preventDefault();
      if (!state.draggingArtifactId) return;
      if (state.draggingSource === 'shop') {
        buyFromShop(state.draggingArtifactId);
      } else if (state.draggingSource === 'inventory') {
        unplaceToContainer(state.draggingArtifactId);
      }
    }

    function onContainerDragOver(event) {
      if (state.draggingSource === 'shop' || state.draggingSource === 'inventory') {
        event.preventDefault();
      }
    }

    function onShopDrop(event) {
      event.preventDefault();
      if (!state.draggingArtifactId) return;
      if (state.draggingSource === 'container') {
        returnToShop(state.draggingArtifactId);
      } else if (state.draggingSource === 'inventory') {
        // Inventory → container first, then container → shop
        unplaceToContainer(state.draggingArtifactId);
        returnToShop(state.draggingArtifactId);
      }
    }

    function onShopDragOver(event) {
      if (state.draggingSource === 'container' || state.draggingSource === 'inventory') {
        event.preventDefault();
      }
    }

    function onShopPieceDragStart(artifactId, event) {
      const artifact = getArtifact(artifactId);
      const price = getArtifactPrice(artifact);
      if (price > remainingCoins.value) {
        event.preventDefault();
        state.error = state.lang === 'ru'
          ? `Недостаточно монет (нужно ${price}, осталось ${remainingCoins.value})`
          : `Not enough coins (need ${price}, left ${remainingCoins.value})`;
        return;
      }
      state.draggingArtifactId = artifactId;
      state.draggingSource = 'shop';
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', artifactId);
      }
    }

    function onContainerPieceDragStart(artifactId, event) {
      state.draggingArtifactId = artifactId;
      state.draggingSource = 'container';
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', artifactId);
      }
    }

    function onInventoryPieceDragStart({ item, event }) {
      state.draggingArtifactId = item.artifactId;
      state.draggingSource = 'inventory';
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    }

    function onDragEndAny() {
      state.draggingArtifactId = '';
      state.draggingSource = '';
    }

    async function saveLoadout() {
      if (!state.bootstrap?.activeMushroomId) {
        state.error = t.value.invalidLoadout;
        return;
      }
      if (computeUsedCoins() > MAX_ARTIFACT_COINS) {
        state.error = t.value.invalidLoadout;
        return;
      }
      await apiJson(
        '/api/artifact-loadout',
        {
          method: 'PUT',
          body: JSON.stringify({
            mushroomId: state.bootstrap.activeMushroomId,
            items: state.builderItems
          })
        },
        state.sessionKey
      );
      await refreshBootstrap();
      goTo('battle');
    }

    async function startBattle() {
      try {
        state.error = '';
        state.currentBattle = await apiJson(
          '/api/battles',
          {
            method: 'POST',
            body: JSON.stringify({
              mode: 'ghost',
              idempotencyKey: crypto.randomUUID()
            })
          },
          state.sessionKey
        );
        state.replayIndex = 0;
        // New round: reset budget, clear fresh-purchase tracking, free reroll.
        state.rerollSpent = 0;
        state.freshPurchases = [];
        rerollShop(true);
        goTo('replay', { replay: state.currentBattle.id });
        autoplayReplay();
      } catch (error) {
        state.error = error.message || 'Could not start battle';
      }
    }

    function stopReplay() {
      if (state.replayTimer) {
        clearInterval(state.replayTimer);
        state.replayTimer = null;
      }
    }

    function autoplayReplay() {
      stopReplay();
      const delay = state.bootstrap?.settings?.battleSpeed === '2x'
        ? DEFAULT_REPLAY_AUTOPLAY_FAST_MS
        : DEFAULT_REPLAY_AUTOPLAY_MS;
      state.replayTimer = window.setInterval(() => {
        if (!state.currentBattle) {
          stopReplay();
          return;
        }
        if (state.replayIndex >= state.currentBattle.events.length - 1) {
          stopReplay();
          return;
        }
        state.replayIndex += 1;
      }, delay);
    }

    async function loadReplay(battleId) {
      state.currentBattle = await apiJson(`/api/battles/${battleId}`, {}, state.sessionKey);
      state.replayIndex = 0;
      goTo('replay', { replay: battleId });
      autoplayReplay();
    }

    async function saveSettings() {
      await apiJson(
        '/api/settings',
        {
          method: 'POST',
          body: JSON.stringify({
            lang: state.lang,
            reducedMotion: state.bootstrap.settings.reducedMotion,
            battleSpeed: state.bootstrap.settings.battleSpeed
          })
        },
        state.sessionKey
      );
      await refreshBootstrap();
    }

    async function addFriend(event) {
      const friendCode = event.target.friendCode.value.trim();
      state.friends = await apiJson(
        '/api/friends/add-by-code',
        { method: 'POST', body: JSON.stringify({ friendCode }) },
        state.sessionKey
      );
      event.target.reset();
    }

    async function challengeFriend(friendPlayerId) {
      state.challenge = await apiJson(
        '/api/friends/challenges',
        { method: 'POST', body: JSON.stringify({ friendPlayerId }) },
        state.sessionKey
      );
      goTo('friends', { challenge: state.challenge.id });
    }

    async function openChallenge(challengeId) {
      state.challenge = await apiJson(`/api/friends/challenges/${challengeId}`, {}, state.sessionKey);
      goTo('friends', { challenge: challengeId });
    }

    async function acceptChallenge() {
      if (!state.challenge) {
        return;
      }
      state.currentBattle = await apiJson(
        `/api/friends/challenges/${state.challenge.id}/accept`,
        { method: 'POST', body: JSON.stringify({}) },
        state.sessionKey
      );
      goTo('replay', { replay: state.currentBattle.id });
      autoplayReplay();
    }

    async function declineChallenge() {
      if (!state.challenge) {
        return;
      }
      state.challenge = await apiJson(
        `/api/friends/challenges/${state.challenge.id}/decline`,
        { method: 'POST', body: JSON.stringify({}) },
        state.sessionKey
      );
    }

    async function openWiki(section, slug) {
      state.selectedWiki = await apiJson(`/api/wiki/${section}/${slug}`);
      goTo('wiki-detail');
    }

    async function runLocalLab() {
      const results = await apiJson(
        '/api/local-tests/battle-narration',
        {
          method: 'POST',
          body: JSON.stringify({
            fixtureNarration: state.localLabInput,
            variants: [
              { name: 'compact-ru', model: 'gpt-4.1-mini', prompt: 'Сделай короткое боевое описание на русском.' },
              { name: 'dramatic-en', model: 'gpt-4.1-mini', prompt: 'Write a dramatic but compact English battle recap.' }
            ]
          })
        },
        state.sessionKey
      );
      state.localLab = results.results;
    }

    async function loadInventoryReview() {
      state.inventoryReviewSamples = await apiJson('/api/dev/inventory-review', {}, state.sessionKey);
    }

    const activeMushroom = computed(() =>
      state.bootstrap?.mushrooms?.find((item) => item.id === state.bootstrap.activeMushroomId) || null
    );
    const builderTotals = computed(() => deriveTotals(state.builderItems, state.bootstrap?.artifacts || []));
    const usedCoins = computed(() => computeUsedCoins());
    const remainingCoins = computed(() => Math.max(0, MAX_ARTIFACT_COINS - usedCoins.value));
    const shopArtifacts = computed(() =>
      state.shopOffer
        .map((id) => getArtifact(id))
        .filter(Boolean)
    );
    const containerArtifacts = computed(() =>
      state.containerItems
        .map((id) => getArtifact(id))
        .filter(Boolean)
    );
    const activeReplayState = computed(() => activeEvent.value?.state || null);

    watch(
      () => state.lang,
      () => {
        document.documentElement.lang = state.lang;
      }
    );

    watch(
      () => state.screen,
      async (screen) => {
        if (screen === 'inventory-review' && isLocalDevAuthEnabled.value && state.sessionKey) {
          await loadInventoryReview();
        }
      }
    );

    onMounted(async () => {
      applyTelegramTheme();
      await refreshBootstrap();
      const startParams = parseStartParams();
      if (startParams.challenge && state.sessionKey) {
        await openChallenge(startParams.challenge);
      }
      if (startParams.replay && state.sessionKey) {
        await loadReplay(startParams.replay);
      }
      if (state.screen === 'inventory-review' && isLocalDevAuthEnabled.value && state.sessionKey) {
        await loadInventoryReview();
      }
    });

    return {
      state,
      t,
      isLocalLabEnabled,
      isLocalDevAuthEnabled,
      activeMushroom,
      builderTotals,
      usedCoins,
      remainingCoins,
      shopArtifacts,
      containerArtifacts,
      maxCoins: MAX_ARTIFACT_COINS,
      getArtifactPrice,
      rerollShop,
      buyFromShop,
      returnToShop,
      getSellPrice,
      autoPlaceFromContainer,
      unplaceToContainer,
      onInventoryCellDrop,
      onInventoryPieceDragStart,
      onContainerDrop,
      onContainerDragOver,
      onContainerPieceDragStart,
      onShopDrop,
      onShopDragOver,
      onShopPieceDragStart,
      onDragEndAny,
      activeEvent,
      activeSpeech,
      battleStatusText,
      replayFinished,
      activeReplayState,
      visibleReplayEvents,
      goTo,
      toggleMenu,
      loginViaTelegram,
      loginViaBrowserCode,
      loginViaDevSession,
      saveCharacter,
      getArtifact,
      getMushroom,
      describeReplay,
      formatDelta,
      formatArtifactBonus,
      portraitPosition,
      loadoutStatsText,
      replayBubbleStyle,
      resultSpeech,
      sampleBubbleText,
      buildReplayFighter,
      artifactGridStyle,
      renderArtifactFigure,
      buildOccupancy,
      removeArtifact,
      rotatePlacedArtifact,
      preferredOrientation,
      saveLoadout,
      startBattle,
      loadReplay,
      stopReplay,
      autoplayReplay,
      saveSettings,
      addFriend,
      challengeFriend,
      openChallenge,
      acceptChallenge,
      declineChallenge,
      openWiki,
      runLocalLab,
      loadInventoryReview
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
          <button class="lang-toggle-btn" :class="{ active: state.lang !== 'ru' }" disabled>EN</button>
        </div>
      </header>

      <p v-if="state.error" class="error">{{ state.error }}</p>

      <section v-if="state.loading" class="auth-screen">
        <div class="auth-hero-card panel">
          <h2 class="auth-title">{{ t.authTitle }}</h2>
          <p class="auth-tagline">{{ t.authTagline }}</p>
        </div>
      </section>

      <section v-else-if="!state.sessionKey" class="auth-screen">
        <div class="auth-hero-card panel">
          <p class="eyebrow auth-eyebrow">{{ t.title }}</p>
          <div class="auth-portraits">
            <img src="/data/channel/assets/2026-03-27T23-32-46-000Z-53.bin.jpg" alt="" class="auth-portrait" />
            <img src="/data/channel/assets/2026-03-28T02-06-35-000Z-214.bin.jpg" alt="" class="auth-portrait" />
            <img src="/data/channel/assets/2026-03-28T02-06-16-000Z-212.bin.jpg" alt="" class="auth-portrait" />
          </div>
          <h2 class="auth-title">{{ t.authTitle }}</h2>
          <p class="auth-tagline">{{ t.authTagline }}</p>
          <ul class="auth-features">
            <li>{{ t.authFeature1 }}</li>
            <li>{{ t.authFeature2 }}</li>
            <li>{{ t.authFeature3 }}</li>
          </ul>
          <div class="auth-actions">
            <button class="primary auth-cta" @click="loginViaTelegram">{{ t.authTelegram }}</button>
            <button class="secondary" @click="loginViaBrowserCode">{{ t.authBrowser }}</button>
            <button v-if="isLocalDevAuthEnabled" class="ghost" @click="loginViaDevSession">{{ t.authDev }}</button>
          </div>
          <div v-if="state.authCode" class="note">
            <p>{{ t.botCodeHint }}</p>
            <a :href="state.authCode.botUrl" target="_blank">{{ state.authCode.botUrl }}</a>
          </div>
          <div class="auth-lang-row">
            <button class="lang-toggle-btn" :class="{ active: state.lang === 'ru' }" @click="state.lang = 'ru'">RU</button>
            <button class="lang-toggle-btn" :class="{ active: state.lang !== 'ru' }" disabled>EN</button>
          </div>
        </div>
      </section>

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

        <section v-if="state.screen === 'onboarding'" class="onboarding-screen">
          <div class="panel onboarding-card">
            <h2 class="onboarding-title">{{ t.onboardingTitle }}</h2>
            <div class="onboarding-body">
              <ol class="onboarding-steps">
                <li class="onboarding-step">
                  <span class="onboarding-step-num">1</span>
                  <div>
                    <strong>{{ t.onboardingStep1 }}</strong>
                    <p>{{ t.onboardingStep1Sub }}</p>
                  </div>
                </li>
                <li class="onboarding-step">
                  <span class="onboarding-step-num">2</span>
                  <div>
                    <strong>{{ t.onboardingStep2 }}</strong>
                    <p>{{ t.onboardingStep2Sub }}</p>
                  </div>
                </li>
                <li class="onboarding-step">
                  <span class="onboarding-step-num">3</span>
                  <div>
                    <strong>{{ t.onboardingStep3 }}</strong>
                    <p>{{ t.onboardingStep3Sub }}</p>
                  </div>
                </li>
              </ol>
              <div class="onboarding-preview">
                <div class="onboarding-preview-roster">
                  <img v-for="m in state.bootstrap.mushrooms.slice(0, 5)" :key="m.id"
                    :src="m.imagePath"
                    :alt="m.name[state.lang]"
                    class="onboarding-preview-portrait"
                  />
                </div>
                <p class="onboarding-preview-caption">{{ t.onboardingStep1Sub }}</p>
              </div>
            </div>
            <button class="primary" @click="goTo('characters')">{{ t.continue }}</button>
          </div>
        </section>

        <section v-else-if="state.screen === 'home'" class="dashboard">
          <article class="panel player-summary">
            <h2>{{ state.bootstrap.player.name }}</h2>
            <dl class="stat-grid">
              <div class="stat">
                <dt>{{ t.rating }}</dt>
                <dd>{{ state.bootstrap.player.rating }}</dd>
              </div>
              <div class="stat">
                <dt>{{ t.spore }}</dt>
                <dd>{{ state.bootstrap.player.spore }}</dd>
              </div>
              <div class="stat">
                <dt>{{ t.battleLimit }}</dt>
                <dd>{{ state.bootstrap.battleLimit.used }} / {{ state.bootstrap.battleLimit.limit }}</dd>
              </div>
            </dl>
          </article>
          <article class="panel active-mushroom" v-if="activeMushroom">
            <div class="active-mushroom-media">
              <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="portrait"/>
              <span class="active-mushroom-badge">{{ t.active }}</span>
            </div>
            <h3>{{ activeMushroom.name[state.lang] }}</h3>
          </article>
          <article class="panel">
            <h3>{{ t.selectedArtifacts }}</h3>
            <artifact-grid-board
              v-if="state.builderItems.length"
              variant="inventory"
              class="inventory-shell home-inventory"
              :items="state.builderItems"
              :render-artifact-figure="renderArtifactFigure"
              :get-artifact="getArtifact"
            />
            <p v-else>{{ t.selectCell }}</p>
          </article>
          <article class="panel" v-if="Object.keys(state.bootstrap.progression || {}).length">
            <h3>{{ t.profile }}</h3>
            <div class="progression-list">
              <div v-for="entry in Object.values(state.bootstrap.progression)" :key="entry.mushroomId" class="progression-entry">
                <strong>{{ getMushroom(entry.mushroomId)?.name?.[state.lang] || entry.mushroomId }}</strong>
                <span>{{ t.level }} {{ entry.level }} · {{ t.mycelium }} {{ entry.mycelium }}</span>
              </div>
            </div>
          </article>
          <article class="panel panel-wide" v-if="state.bootstrap.battleHistory?.length">
            <h3>{{ t.history }}</h3>
            <ul class="replay-list">
              <li
                v-for="battle in state.bootstrap.battleHistory"
                :key="battle.id"
                class="replay-card"
                :class="'replay-card--' + (describeReplay(battle)?.outcomeKey || 'draw')"
                @click="loadReplay(battle.id)"
                role="button"
                tabindex="0"
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
                    <img
                      v-if="describeReplay(battle)?.ourImage"
                      :src="describeReplay(battle).ourImage"
                      :alt="describeReplay(battle)?.ourName"
                      class="replay-card-portrait"
                    />
                    <span class="replay-card-name">{{ describeReplay(battle)?.ourName }}</span>
                  </div>
                  <span class="replay-card-vs">vs</span>
                  <div class="replay-card-fighter">
                    <img
                      v-if="describeReplay(battle)?.oppImage"
                      :src="describeReplay(battle).oppImage"
                      :alt="describeReplay(battle)?.oppName"
                      class="replay-card-portrait"
                    />
                    <span class="replay-card-name">{{ describeReplay(battle)?.oppName }}</span>
                  </div>
                </div>
                <div class="replay-card-rewards" v-if="describeReplay(battle)?.ratingDelta != null || describeReplay(battle)?.sporeDelta || describeReplay(battle)?.myceliumDelta">
                  <span v-if="describeReplay(battle)?.ratingDelta != null" class="replay-chip">
                    {{ t.rating }} {{ formatDelta(describeReplay(battle).ratingDelta) }}
                  </span>
                  <span v-if="describeReplay(battle)?.sporeDelta" class="replay-chip">
                    {{ t.spore }} {{ formatDelta(describeReplay(battle).sporeDelta) }}
                  </span>
                  <span v-if="describeReplay(battle)?.myceliumDelta" class="replay-chip">
                    {{ t.mycelium }} {{ formatDelta(describeReplay(battle).myceliumDelta) }}
                  </span>
                </div>
              </li>
            </ul>
          </article>
        </section>

        <section v-else-if="state.screen === 'characters'" class="character-grid">
          <article class="character-card" v-for="mushroom in state.bootstrap.mushrooms" :key="mushroom.id" @click="saveCharacter(mushroom.id)">
            <div class="card-portrait-wrap">
              <img :src="mushroom.imagePath" :alt="mushroom.name[state.lang]" class="portrait character-portrait" :style="{ objectPosition: portraitPosition(mushroom.id) }"/>
              <h3 class="card-portrait-name">{{ mushroom.name[state.lang] }}</h3>
            </div>
            <div class="character-card-meta">
              <span class="fighter-style-tag">{{ mushroom.styleTag }}</span>
              <span class="card-stats">{{ mushroom.baseStats.health }} HP · {{ mushroom.baseStats.attack }} ATK · {{ mushroom.baseStats.speed }} SPD</span>
            </div>
          </article>
        </section>

        <section v-else-if="state.screen === 'bubble-review' && isLocalDevAuthEnabled" class="stack bubble-review-screen">
          <h2>Bubble Review</h2>
          <div class="bubble-review-grid">
            <article class="panel battle-stage bubble-review-stage" v-for="mushroom in state.bootstrap.mushrooms" :key="mushroom.id">
              <replay-duel
                :left-fighter="buildReplayFighter(mushroom.id, { nameText: mushroom.name[state.lang], speechText: sampleBubbleText(mushroom) })"
                :right-fighter="buildReplayFighter(mushroom.id, { nameText: mushroom.name[state.lang] })"
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
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
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
              />
            </article>
          </div>
        </section>

        <section v-else-if="state.screen === 'artifacts'" class="artifact-screen">
          <div class="artifact-header-row">
            <h2>{{ t.artifacts }}</h2>
            <div class="coin-hud">
              <span class="coin-hud-label">💰 {{ remainingCoins }}</span>
            </div>
          </div>

          <div
            class="artifact-container-zone"
            @dragover="onContainerDragOver($event)"
            @drop="onContainerDrop($event)"
          >
            <div class="artifact-container-header">
              <strong>{{ t.container }}</strong>
              <span v-if="containerArtifacts.length" class="artifact-container-count">{{ containerArtifacts.length }}</span>
            </div>
            <div v-if="containerArtifacts.length" class="artifact-container-items">
              <div
                v-for="artifact in containerArtifacts"
                :key="artifact.id"
                class="container-item"
                draggable="true"
                @click="autoPlaceFromContainer(artifact.id)"
                @dragstart="onContainerPieceDragStart(artifact.id, $event)"
                @dragend="onDragEndAny()"
                :data-artifact-id="artifact.id"
              >
                <button
                  class="container-item-sell"
                  type="button"
                  :title="state.lang === 'ru' ? 'Вернуть в магазин' : 'Return to shop'"
                  @click.stop="returnToShop(artifact.id)"
                >💰 {{ getSellPrice(artifact.id) }}</button>
                <artifact-grid-board
                  class="container-item-visual"
                  variant="catalog"
                  :columns="preferredOrientation(artifact).width"
                  :rows="preferredOrientation(artifact).height"
                  :items="[{ artifactId: artifact.id, x: 0, y: 0, width: preferredOrientation(artifact).width, height: preferredOrientation(artifact).height }]"
                  :render-artifact-figure="renderArtifactFigure"
                  :get-artifact="getArtifact"
                />
                <div class="container-item-copy">
                  <strong>{{ artifact.name[state.lang] }}</strong>
                  <span class="artifact-stat-chips">
                    <span
                      v-for="stat in formatArtifactBonus(artifact)"
                      :key="stat.key"
                      class="artifact-stat-chip"
                      :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
                    >{{ stat.label }} {{ stat.value }}</span>
                  </span>
                </div>
              </div>
            </div>
            <p v-else class="artifact-container-empty">{{ t.containerHint }}</p>
          </div>

          <div class="artifact-inventory-section panel">
            <div class="artifact-inventory-header">
              <strong>{{ t.inventory }}</strong>
              <span v-if="state.builderItems.length" class="artifact-inventory-badge">{{ state.builderItems.length }}</span>
            </div>
            <artifact-grid-board
              variant="inventory"
              class="inventory-shell artifact-inventory-grid"
              :items="state.builderItems"
              :render-artifact-figure="renderArtifactFigure"
              :get-artifact="getArtifact"
              :clickable-pieces="true"
              :rotatable-pieces="true"
              :droppable="true"
              :draggable-pieces="true"
              @piece-click="unplaceToContainer($event.artifactId)"
              @piece-rotate="rotatePlacedArtifact($event)"
              @cell-drop="onInventoryCellDrop($event)"
              @piece-drag-start="onInventoryPieceDragStart($event)"
              @piece-drag-end="onDragEndAny()"
            />
            <div v-if="state.builderItems.length" class="artifact-inventory-footer">
              <span class="artifact-inventory-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
              <button class="primary" @click="saveLoadout">{{ t.save }}</button>
            </div>
            <p v-else class="artifact-inventory-hint">{{ t.selectCell }}</p>
          </div>

          <div
            class="artifact-shop"
            @dragover="onShopDragOver($event)"
            @drop="onShopDrop($event)"
            @dragend="onDragEndAny()"
          >
            <div class="artifact-shop-header">
              <strong>{{ t.shop }}</strong>
              <button type="button" class="link" :disabled="remainingCoins < 1" @click="rerollShop(false)">↻ {{ t.reroll }} (💰 1)</button>
            </div>
            <div class="artifact-shop-items">
              <div
                v-for="artifact in shopArtifacts"
                :key="artifact.id"
                class="shop-item"
                :class="{ 'shop-item--expensive': getArtifactPrice(artifact) > remainingCoins }"
                :draggable="getArtifactPrice(artifact) <= remainingCoins"
                @click="buyFromShop(artifact.id)"
                @dragstart="onShopPieceDragStart(artifact.id, $event)"
                @dragend="onDragEndAny()"
                :data-artifact-id="artifact.id"
              >
                <artifact-grid-board
                  class="shop-item-visual"
                  variant="catalog"
                  :columns="preferredOrientation(artifact).width"
                  :rows="preferredOrientation(artifact).height"
                  :items="[{ artifactId: artifact.id, x: 0, y: 0, width: preferredOrientation(artifact).width, height: preferredOrientation(artifact).height }]"
                  :render-artifact-figure="renderArtifactFigure"
                  :get-artifact="getArtifact"
                />
                <div class="shop-item-copy">
                  <strong>{{ artifact.name[state.lang] }}</strong>
                  <span class="shop-item-price">💰 {{ getArtifactPrice(artifact) }}</span>
                  <span class="artifact-stat-chips">
                    <span
                      v-for="stat in formatArtifactBonus(artifact)"
                      :key="stat.key"
                      class="artifact-stat-chip"
                      :class="stat.positive ? 'artifact-stat-chip--pos' : 'artifact-stat-chip--neg'"
                    >{{ stat.label }} {{ stat.value }}</span>
                  </span>
                </div>
              </div>
              <div v-if="!shopArtifacts.length" class="shop-empty">{{ t.shop }} — ↻</div>
            </div>
          </div>
        </section>

        <section v-else-if="state.screen === 'battle'" class="battle-prep-screen" v-if="activeMushroom">
          <div class="battle-prep-card">
            <div class="battle-prep-portrait-wrap">
              <img :src="activeMushroom.imagePath" :alt="activeMushroom.name[state.lang]" class="battle-prep-portrait" :style="{ objectPosition: portraitPosition(activeMushroom.id) }"/>
              <div class="battle-prep-portrait-overlay">
                <h3>{{ activeMushroom.name[state.lang] }}</h3>
                <div class="battle-prep-tags">
                  <span class="fighter-style-tag">{{ activeMushroom.styleTag }}</span>
                  <span class="battle-prep-stat-tag">{{ activeMushroom.baseStats.health }} HP</span>
                  <span class="battle-prep-stat-tag">{{ activeMushroom.baseStats.attack }} ATK</span>
                  <span class="battle-prep-stat-tag">{{ activeMushroom.baseStats.speed }} SPD</span>
                </div>
              </div>
            </div>
            <div class="battle-prep-loadout" v-if="state.builderItems.length">
              <artifact-grid-board
                variant="inventory"
                class="inventory-shell battle-prep-inventory"
                :items="state.builderItems"
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
              />
              <span class="battle-prep-loadout-stats">+{{ builderTotals.damage }} DMG / +{{ builderTotals.armor }} ARM / +{{ builderTotals.speed }} SPD / +{{ builderTotals.stunChance }}% STUN</span>
            </div>
          </div>
          <button class="primary battle-prep-cta" :disabled="usedCoins > maxCoins" @click="startBattle">{{ t.startBattle }}</button>
        </section>

        <section v-else-if="state.screen === 'replay' && state.currentBattle" class="replay-layout">
          <div class="battle-stage">
            <replay-duel
              :left-fighter="buildReplayFighter(state.currentBattle.snapshots.left.mushroomId, {
                nameText: getMushroom(state.currentBattle.snapshots.left.mushroomId)?.name[state.lang] || state.currentBattle.snapshots.left.mushroomId,
                healthText: activeReplayState?.left.currentHealth + ' / ' + activeReplayState?.left.maxHealth,
                statsText: loadoutStatsText(state.currentBattle.snapshots.left.loadout),
                speechText: activeSpeech?.side === 'left' ? activeSpeech.narration : '',
                loadout: state.currentBattle.snapshots.left.loadout
              })"
              :right-fighter="buildReplayFighter(state.currentBattle.snapshots.right.mushroomId, {
                nameText: getMushroom(state.currentBattle.snapshots.right.mushroomId)?.name[state.lang] || state.currentBattle.snapshots.right.mushroomId,
                healthText: activeReplayState?.right.currentHealth + ' / ' + activeReplayState?.right.maxHealth,
                statsText: loadoutStatsText(state.currentBattle.snapshots.right.loadout),
                speechText: activeSpeech?.side === 'right' ? activeSpeech.narration : '',
                loadout: state.currentBattle.snapshots.right.loadout
              })"
              :render-artifact-figure="renderArtifactFigure"
              :get-artifact="getArtifact"
              :acting-side="activeEvent?.actorSide || ''"
              :status-text="battleStatusText"
            />
          </div>
          <button
            v-if="replayFinished"
            class="primary replay-result-button-full"
            @click="goTo('results')"
          >
            {{ t.results }}
          </button>
          <div class="replay-log">
            <button
              v-for="event in visibleReplayEvents"
              :key="event.replayIndex"
              class="log-entry"
              :class="{ active: event.replayIndex === state.replayIndex }"
              @click="state.replayIndex = event.replayIndex"
            >
              {{ event.display.logText }}
            </button>
          </div>
        </section>

        <section v-else-if="state.screen === 'results' && state.currentBattle" class="results-screen">
          <div class="results-fighters">
            <div
              v-for="(snapshot, side) in state.currentBattle.snapshots"
              :key="side"
              :class="[
                'results-fighter-column',
                state.currentBattle.outcome === 'draw' ? 'results-outcome--draw'
                  : (side === 'left') === (state.currentBattle.outcome === 'win') ? 'results-outcome--win'
                  : 'results-outcome--loss'
              ]"
            >
              <span class="results-fighter-outcome">{{
                state.currentBattle.outcome === 'draw' ? t.outcomeDraw
                  : (side === 'left') === (state.currentBattle.outcome === 'win') ? t.outcomeWin
                  : t.outcomeLoss
              }}</span>
              <fighter-card
                :mushroom="getMushroom(snapshot.mushroomId)"
                :name-text="getMushroom(snapshot.mushroomId)?.name[state.lang] || snapshot.mushroomId"
                :loadout="snapshot.loadout"
                :stats-text="loadoutStatsText(snapshot.loadout)"
                :speech-text="resultSpeech(side, state.currentBattle.outcome)"
                :render-artifact-figure="renderArtifactFigure"
                :get-artifact="getArtifact"
                :bubble-style="replayBubbleStyle(snapshot.mushroomId)"
              />
              <div v-if="state.currentBattle.rewards?.length" class="results-reward-badge">
                <template v-for="reward in state.currentBattle.rewards.filter(r => r.mushroomId === snapshot.mushroomId)" :key="reward.playerId">
                  <span class="results-reward-item">{{ t.spore }} <strong>+{{ reward.sporeDelta }}</strong></span>
                  <span class="results-reward-item">{{ t.mycelium }} <strong>+{{ reward.myceliumDelta }}</strong></span>
                </template>
                <template v-if="!state.currentBattle.rewards.some(r => r.mushroomId === snapshot.mushroomId)">
                  <span class="results-reward-item results-reward-item--ghost">—</span>
                </template>
              </div>
            </div>
          </div>
          <button class="primary" @click="goTo('home')">{{ t.home }}</button>
        </section>

        <section v-else-if="state.screen === 'history'" class="panel stack">
          <h2>{{ t.history }}</h2>
          <button
            v-for="battle in state.bootstrap.battleHistory"
            :key="battle.id"
            class="log-entry"
            @click="loadReplay(battle.id)"
          >
            {{ battle.id }} · {{ battle.mode }} · {{ battle.outcome }}
          </button>
        </section>

        <section v-else-if="state.screen === 'friends'" class="grid cards">
          <article class="panel">
            <h2>{{ t.friends }}</h2>
            <p>{{ t.friendCode }}: {{ state.bootstrap.player.friendCode }}</p>
            <form class="row" @submit.prevent="addFriend">
              <input name="friendCode" :placeholder="t.friendCode" />
              <button class="primary" type="submit">{{ t.addFriend }}</button>
            </form>
          </article>
          <article class="panel">
            <h3>Roster</h3>
            <button v-for="friend in state.friends" :key="friend.id" class="log-entry" @click="challengeFriend(friend.id)">
              {{ friend.name }} · {{ t.createChallenge }}
            </button>
          </article>
          <article class="panel" v-if="state.challenge">
            <h3>Challenge</h3>
            <p>{{ state.challenge.status }}</p>
            <button class="primary" @click="acceptChallenge">{{ t.acceptChallenge }}</button>
            <button class="secondary" @click="declineChallenge">{{ t.declineChallenge }}</button>
          </article>
        </section>

        <section v-else-if="state.screen === 'leaderboard'" class="panel stack">
          <h2>{{ t.leaderboard }}</h2>
          <div class="leaderboard-row" v-for="entry in state.leaderboard" :key="entry.id">
            <strong>#{{ entry.rank }}</strong>
            <span>{{ entry.name }}</span>
            <span>{{ entry.rating }}</span>
          </div>
        </section>

        <section v-else-if="state.screen === 'wiki'" class="grid cards">
          <article class="panel">
            <h2>{{ t.wiki }}</h2>
            <div class="stack">
              <button v-for="entry in state.wikiHome?.characters || []" :key="entry.slug" class="log-entry" @click="openWiki('characters', entry.slug)">
                {{ state.lang === 'ru' ? entry.titleRu : entry.titleEn }}
              </button>
            </div>
          </article>
          <article class="panel">
            <h3>Locations</h3>
            <button v-for="entry in state.wikiHome?.locations || []" :key="entry.slug" class="log-entry" @click="openWiki('locations', entry.slug)">
              {{ entry.titleRu }}
            </button>
          </article>
          <article class="panel">
            <h3>Factions</h3>
            <button v-for="entry in state.wikiHome?.factions || []" :key="entry.slug" class="log-entry" @click="openWiki('factions', entry.slug)">
              {{ entry.titleRu }}
            </button>
          </article>
        </section>

        <section v-else-if="state.screen === 'wiki-detail' && state.selectedWiki" class="panel stack">
          <button class="ghost" @click="goTo('wiki')">{{ t.wiki }}</button>
          <h2>{{ state.lang === 'ru' ? state.selectedWiki.title_ru : state.selectedWiki.title_en }}</h2>
          <img v-if="state.selectedWiki.image" :src="state.selectedWiki.image" :alt="state.selectedWiki.title_ru" class="portrait"/>
          <div v-html="state.selectedWiki.html"></div>
        </section>

        <section v-else-if="state.screen === 'profile'" class="grid cards">
          <article class="panel" v-for="entry in Object.values(state.bootstrap.progression)" :key="entry.mushroomId">
            <h3>{{ entry.mushroomId }}</h3>
            <p>{{ t.level }} {{ entry.level }}</p>
            <p>{{ t.mycelium }} {{ entry.mycelium }}</p>
          </article>
        </section>

        <section v-else-if="state.screen === 'settings'" class="panel stack">
          <h2>{{ t.settings }}</h2>
          <label class="setting-row">
            <span>{{ t.language }}</span>
            <select v-model="state.lang">
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label class="setting-row">
            <span>{{ t.reducedMotion }}</span>
            <input type="checkbox" v-model="state.bootstrap.settings.reducedMotion" />
          </label>
          <label class="setting-row">
            <span>{{ t.battleSpeed }}</span>
            <select v-model="state.bootstrap.settings.battleSpeed">
              <option value="1x">1x</option>
              <option value="2x">2x</option>
            </select>
          </label>
          <button class="primary" @click="saveSettings">{{ t.save }}</button>
        </section>

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
