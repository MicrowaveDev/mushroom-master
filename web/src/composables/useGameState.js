import { computed, nextTick } from 'vue/dist/vue.esm-bundler.js';
import { messages } from '../i18n.js';
import { apiJson, parseStartParams, setScreenQuery } from '../api.js';
import { deriveTotals, getArtifactPrice, buildOccupancy, preferredOrientation } from '../artifacts/grid.js';
import { renderArtifactFigure } from '../artifacts/render.js';
import { defaultReplayPortraitConfig, replayPortraitConfigByMushroom } from '../replay-portrait-config.js';
import { formatReplayEvent } from '../replay/format.js';
import { MAX_ARTIFACT_COINS } from '../constants.js';

export function useGameState(state, options = {}) {
  // Progressive enhancement: wrap screen changes in the View Transitions API
  // when the browser supports it and the caller says animations are allowed.
  // Falls back to an immediate state.screen mutation in every other case.
  // See docs/html5-ux-optimization-plan.md §V1 item 3.
  const shouldAnimateTransitions = typeof options.shouldAnimate === 'function'
    ? options.shouldAnimate
    : () => true;
  const t = computed(() => messages[state.lang] || messages.ru);
  const isLocalLabEnabled = computed(() => state.appConfig.localAiLabEnabled);
  const isLocalDevAuthEnabled = computed(() => state.appConfig.localDevAuthEnabled);

  const activeMushroom = computed(() =>
    state.bootstrap?.mushrooms?.find((item) => item.id === state.bootstrap.activeMushroomId) || null
  );
  const builderTotals = computed(() => deriveTotals(state.builderItems, state.bootstrap?.artifacts || []));
  const usedCoins = computed(() => {
    const freshCost = state.freshPurchases.reduce((sum, id) => {
      return sum + getArtifactPrice(getArtifact(id));
    }, 0);
    return freshCost + state.rerollSpent;
  });
  const remainingCoins = computed(() => Math.max(0, MAX_ARTIFACT_COINS - usedCoins.value));
  const shopArtifacts = computed(() =>
    state.shopOffer.map((id) => getArtifact(id)).filter(Boolean)
  );
  // containerItems is Array<{ id, artifactId }> and may contain duplicates
  // (the player can own two moss_pouches, two burning_caps, etc.). Emit
  // each visible slot with the artifact definition spread in, plus the
  // slot's server row id under `rowId` (NOT `id`, to avoid clobbering the
  // artifact catalogue id), plus a stable `instanceKey` for Vue's v-for.
  // PrepScreen passes `{ rowId, artifactId }` back as the sell/unplace
  // target so downstream composables can disambiguate duplicates.
  const containerArtifacts = computed(() =>
    state.containerItems
      .map((slot, idx) => {
        const artifact = getArtifact(slot.artifactId);
        if (!artifact) return null;
        return {
          ...artifact,
          rowId: slot.id || null,
          instanceKey: slot.id || `${slot.artifactId}#${idx}`
        };
      })
      .filter(Boolean)
  );

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

  function goTo(screen, extra = {}) {
    const applyScreenChange = () => {
      state.screen = screen;
      state.menuOpen = false;
      // When entering prep with an active game run, bind the URL to
      // /game-run/:id so the tab is bookmarkable and shareable (§2.7).
      // Other screens write their own URL via the default mapping.
      if (screen === 'prep' && state.gameRun?.id) {
        setScreenQuery('game-run', { gameRunId: state.gameRun.id });
      } else {
        setScreenQuery(screen, extra);
      }
    };
    const hasViewTransitions = typeof document !== 'undefined'
      && typeof document.startViewTransition === 'function';
    // Skip View Transitions under automated drivers (Playwright, Puppeteer).
    // Otherwise the ~180ms cross-fade is still playing when the test takes
    // a screenshot, which captures the outgoing AND incoming DOM overlaid
    // via ::view-transition pseudo-elements. Real users on the same build
    // still get the animation; only automated test runs skip it.
    const isAutomatedDriver = typeof navigator !== 'undefined'
      && !!navigator.webdriver;
    if (hasViewTransitions && shouldAnimateTransitions() && !isAutomatedDriver) {
      // Return a Promise from the update callback so View Transitions waits
      // for Vue's DOM patch (scheduled on the microtask queue) to flush
      // before snapshotting the "new" state. Without nextTick, the
      // "after" snapshot would still show the old screen.
      document.startViewTransition(async () => {
        applyScreenChange();
        await nextTick();
      });
    } else {
      applyScreenChange();
    }
  }

  function toggleMenu() {
    state.menuOpen = !state.menuOpen;
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

  function loadoutStatsText(loadout) {
    if (!loadout?.items?.length) return '';
    const totals = deriveTotals(loadout.items, state.bootstrap?.artifacts || []);
    const labels = state.lang === 'ru'
      ? { damage: 'Урон', armor: 'Броня', speed: 'Скорость', stunChance: 'Оглушение' }
      : { damage: 'Damage', armor: 'Armor', speed: 'Speed', stunChance: 'Stun' };
    const parts = [];
    if (totals.damage) parts.push(`${labels.damage} ${formatDelta(totals.damage)}`);
    if (totals.armor) parts.push(`${labels.armor} ${formatDelta(totals.armor)}`);
    if (totals.speed) parts.push(`${labels.speed} ${formatDelta(totals.speed)}`);
    if (totals.stunChance) parts.push(`${labels.stunChance} ${formatDelta(totals.stunChance)}%`);
    return parts.join(' / ');
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

  function portraitPosition(mushroomId) {
    return (replayPortraitConfigByMushroom[mushroomId] || defaultReplayPortraitConfig).imagePosition;
  }

  function sampleBubbleText(mushroom) {
    if (!mushroom) return '';
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

  const _replayDescCache = new Map();
  function describeReplay(battle) {
    if (!battle) return null;
    const cacheKey = `${battle.id}:${state.lang}`;
    if (_replayDescCache.has(cacheKey)) return _replayDescCache.get(cacheKey);
    const viewerId = battle.viewerPlayerId || state.bootstrap?.player?.id;
    const leftSnap = battle.snapshots?.left || {};
    const rightSnap = battle.snapshots?.right || {};
    const viewerSide = leftSnap.playerId === viewerId ? 'left' : rightSnap.playerId === viewerId ? 'right' : 'left';
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
    const outcomeLabel = outcomeKey === 'win' ? t.value.outcomeWin : outcomeKey === 'loss' ? t.value.outcomeLoss : t.value.outcomeDraw;
    const opponentKindLabel = battle.opponentKind === 'bot' ? t.value.opponentBot : battle.opponentKind === 'ghost' ? t.value.opponentGhost : battle.opponentKind === 'friend' ? t.value.opponentFriend : t.value.opponentPlayer;
    const viewerReward = (battle.rewards || []).find((r) => r.playerId === viewerId) || null;
    const ratingDelta = viewerReward && viewerReward.ratingAfter != null && viewerReward.ratingBefore != null ? viewerReward.ratingAfter - viewerReward.ratingBefore : null;
    const desc = {
      outcomeKey, outcomeLabel,
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
    _replayDescCache.set(cacheKey, desc);
    return desc;
  }

  function artifactGridStyle(item) {
    return {
      gridColumn: `${item.x + 1} / span ${item.width}`,
      gridRow: `${item.y + 1} / span ${item.height}`
    };
  }

  return {
    t, isLocalLabEnabled, isLocalDevAuthEnabled,
    activeMushroom, builderTotals, usedCoins, remainingCoins,
    shopArtifacts, containerArtifacts,
    maxCoins: MAX_ARTIFACT_COINS,
    getArtifact, getMushroom, mushroomDisplayName,
    goTo, toggleMenu,
    formatArtifactBonus, formatDelta,
    loadoutStatsText, portraitPosition,
    replayBubbleStyle, sampleBubbleText, buildReplayFighter,
    resultSpeech, describeReplay, artifactGridStyle,
    getArtifactPrice, renderArtifactFigure, buildOccupancy, preferredOrientation
  };
}
