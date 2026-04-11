import { computed } from 'vue/dist/vue.esm-bundler.js';
import { messages } from '../i18n.js';
import { apiJson, parseStartParams, setScreenQuery } from '../api.js';
import { deriveTotals, getArtifactPrice, buildOccupancy, preferredOrientation } from '../artifacts/grid.js';
import { renderArtifactFigure } from '../artifacts/render.js';
import { defaultReplayPortraitConfig, replayPortraitConfigByMushroom } from '../replay-portrait-config.js';
import { formatReplayEvent } from '../replay/format.js';
import { MAX_ARTIFACT_COINS } from '../constants.js';

export function useGameState(state) {
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
  const containerArtifacts = computed(() =>
    state.containerItems.map((id) => getArtifact(id)).filter(Boolean)
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
    if (totals.damage) parts.push(`${labels.damage} +${totals.damage}`);
    if (totals.armor) parts.push(`${labels.armor} +${totals.armor}`);
    if (totals.speed) parts.push(`${labels.speed} +${totals.speed}`);
    if (totals.stunChance) parts.push(`${labels.stunChance} +${totals.stunChance}%`);
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

  function describeReplay(battle) {
    if (!battle) return null;
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
    return {
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
