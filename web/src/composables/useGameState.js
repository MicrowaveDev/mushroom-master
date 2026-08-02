import { computed, nextTick } from 'vue/dist/vue.esm-bundler.js';
import {
  formatArtifactBonusEntries,
  formatLoadoutStatsText as formatCoreLoadoutStatsText,
  formatStatDelta as formatCoreStatDelta
} from '@microwavedev/backpack-game-core/client-view-model';
import { messages } from '../i18n.js';
import { parseStartParams, setScreenQuery } from '../api.js';
import { deriveTotals, getArtifactPrice, buildOccupancy, preferredOrientation } from '../artifacts/grid.js';
import { renderArtifactFigure } from '../artifacts/render.js';
import { replayPortraitConfig } from '../replay-portrait-config.js';
import { formatReplayEvent } from '../replay/format.js';
import { MAX_ARTIFACT_COINS, MAX_ROUNDS_PER_RUN } from '../constants.js';
import {
  artifactFusionRecipes,
  findArtifactFusionMatches,
  fusionIngredientRowIdSet
} from '../../../app/shared/artifact-fusions.js';

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
  const storageItems = computed(() =>
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
  function placedFusionRows() {
    return state.builderItems.map((item) => ({
      id: item.id,
      artifactId: item.artifactId,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height
    }));
  }

  function canCheckFusionCandidates() {
    if (!state.gameRun || state.gameRun.status !== 'active') return false;
    if (Number(state.gameRun.currentRound || 0) >= MAX_ROUNDS_PER_RUN) return false;
    return true;
  }

  function countArtifacts(artifactIds) {
    const counts = new Map();
    for (const artifactId of artifactIds || []) {
      counts.set(artifactId, (counts.get(artifactId) || 0) + 1);
    }
    return counts;
  }

  function countPlacedRows(rows) {
    return countArtifacts((rows || []).map((row) => row.artifactId));
  }

  function countsCover(actualCounts, requiredCounts) {
    for (const [artifactId, required] of requiredCounts.entries()) {
      if ((actualCounts.get(artifactId) || 0) < required) return false;
    }
    return true;
  }

  function countsAfterTakingOne(requiredCounts, artifactId) {
    const next = new Map(requiredCounts);
    const remaining = (next.get(artifactId) || 0) - 1;
    if (remaining > 0) next.set(artifactId, remaining);
    else next.delete(artifactId);
    return next;
  }

  function addPlacedRowsForCounts(rowIds, rows, requiredCounts) {
    for (const [artifactId, required] of requiredCounts.entries()) {
      let added = 0;
      for (const row of rows) {
        if (row.artifactId !== artifactId) continue;
        rowIds.add(row.id);
        added += 1;
        if (added >= required) break;
      }
    }
  }

  const fusionMatches = computed(() => {
    if (!canCheckFusionCandidates()) return [];
    return findArtifactFusionMatches(placedFusionRows(), getArtifact);
  });
  const fusionIngredientRowIds = computed(() => fusionIngredientRowIdSet(fusionMatches.value));
  const fusionCandidateData = computed(() => {
    const rowIds = new Set(fusionIngredientRowIds.value);
    const shopArtifactIds = new Set();
    if (!canCheckFusionCandidates()) return { rowIds, shopArtifactIds };

    const placedRows = placedFusionRows();
    const placedCounts = countPlacedRows(placedRows);
    const shopCounts = countArtifacts(state.gameRunShopOffer || []);

    for (const recipe of artifactFusionRecipes) {
      const requiredCounts = countArtifacts(recipe.ingredientArtifactIds);
      const shopHasFullRecipe = countsCover(shopCounts, requiredCounts);
      const uniqueIngredientIds = [...requiredCounts.keys()];

      if (shopHasFullRecipe) {
        for (const artifactId of uniqueIngredientIds) shopArtifactIds.add(artifactId);
      }

      for (const artifactId of uniqueIngredientIds) {
        if ((shopCounts.get(artifactId) || 0) <= 0) continue;
        const placedNeeded = countsAfterTakingOne(requiredCounts, artifactId);
        if (!countsCover(placedCounts, placedNeeded)) continue;
        shopArtifactIds.add(artifactId);
        addPlacedRowsForCounts(rowIds, placedRows, placedNeeded);
      }
    }

    return { rowIds, shopArtifactIds };
  });
  const fusionAvailableMatches = computed(() => {
    if (!canCheckFusionCandidates()) return [];
    return fusionMatches.value;
  });
  const fusionCandidateRowIds = computed(() => fusionCandidateData.value?.rowIds || new Set());
  const fusionCandidateShopArtifactIds = computed(() => {
    return fusionCandidateData.value?.shopArtifactIds || new Set();
  });
  const hasFusionCandidates = computed(() =>
    fusionMatches.value.length > 0
    || fusionCandidateShopArtifactIds.value.size > 0
    || fusionCandidateRowIds.value.size > 0
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

  function goTo(screen, extra = {}, options = {}) {
    const applyScreenChange = () => {
      state.screen = screen;
      state.menuOpen = false;
      // When entering prep with an active game run, bind the URL to
      // /game-run/:id so the tab is bookmarkable and shareable (§2.7).
      // Other screens write their own URL via the default mapping.
      if (screen === 'prep' && state.gameRun?.id) {
        setScreenQuery('game-run', { gameRunId: state.gameRun.id }, options);
      } else if (screen === 'runComplete') {
        const gameRunId = extra.gameRunId || state.gameRunResult?.id || state.gameRun?.id || null;
        setScreenQuery(screen, gameRunId ? { gameRunId } : extra, options);
      } else if (screen === 'profile') {
        const profilePlayerId = extra.profilePlayerId
          || state.bootstrap?.player?.username
          || state.bootstrap?.player?.friendCode
          || state.bootstrap?.player?.id
          || null;
        setScreenQuery(screen, profilePlayerId ? { profilePlayerId } : extra, options);
      } else {
        setScreenQuery(screen, extra, options);
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
    if (!options.skipTransition && hasViewTransitions && shouldAnimateTransitions() && !isAutomatedDriver) {
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

  function artifactStatLabels() {
    return state.lang === 'ru'
      ? { damage: 'Урон', armor: 'Броня', speed: 'Скорость', stunChance: 'Оглушение' }
      : { damage: 'Damage', armor: 'Armor', speed: 'Speed', stunChance: 'Stun' };
  }

  function formatArtifactBonus(artifact) {
    return formatArtifactBonusEntries(artifact, {
      labels: artifactStatLabels()
    });
  }

  function formatDelta(value) {
    return formatCoreStatDelta(value);
  }

  function loadoutStatsText(loadout) {
    if (!loadout?.items?.length) return '';
    return formatCoreLoadoutStatsText({
      items: loadout.items,
      artifacts: state.bootstrap?.artifacts || [],
      labels: artifactStatLabels()
    });
  }

  function replayBubbleStyle(mushroomId, portraitId = 'default') {
    const layout = replayPortraitConfig(mushroomId, portraitId);
    return {
      '--bubble-top': layout.top,
      '--bubble-underhang': layout.underhang,
      '--bubble-inset-left': layout.insetLeft,
      '--bubble-inset-right': layout.insetRight,
      '--bubble-tail-left': layout.tailLeft,
      '--bubble-tail-edge': layout.tailEdge,
      '--bubble-tail-top': layout.tailEdge === 'bottom' ? 'auto' : '-10px',
      '--bubble-tail-bottom': layout.tailEdge === 'bottom' ? '-10px' : 'auto',
      '--bubble-tail-border-left': layout.tailEdge === 'bottom' ? 'transparent' : 'rgba(138, 97, 53, 0.22)',
      '--bubble-tail-border-top': layout.tailEdge === 'bottom' ? 'transparent' : 'rgba(138, 97, 53, 0.22)',
      '--bubble-tail-border-right': layout.tailEdge === 'bottom' ? 'rgba(138, 97, 53, 0.22)' : 'transparent',
      '--bubble-tail-border-bottom': layout.tailEdge === 'bottom' ? 'rgba(138, 97, 53, 0.22)' : 'transparent',
      '--fighter-object-position': layout.imagePosition,
      '--portrait-head-x': `${layout.headX}`,
      '--portrait-head-y': `${layout.headY}`,
      '--portrait-face-top': `${layout.faceTop}`,
      '--portrait-face-bottom': `${layout.faceBottom}`
    };
  }

  function portraitPosition(mushroomId) {
    return replayPortraitConfig(mushroomId).imagePosition;
  }

  function portraitPositionFor(mushroomId, portraitId = 'default') {
    return replayPortraitConfig(mushroomId, portraitId).imagePosition;
  }

  function portraitPathFor(mushroomId, portraitId = 'default') {
    const mushroom = getMushroom(mushroomId);
    if (!portraitId || portraitId === 'default') return mushroom?.imagePath || '';
    const variants = state.bootstrap?.progression?.[mushroomId]?.portraits || [];
    return variants.find((variant) => variant.id === portraitId)?.path || mushroom?.imagePath || '';
  }

  function portraitReviewItems() {
    return (state.bootstrap?.mushrooms || []).flatMap((mushroom) => {
      const variants = state.bootstrap?.progression?.[mushroom.id]?.portraits || [
        { id: 'default', path: mushroom.imagePath, name: { ru: 'Базовый', en: 'Default' } }
      ];
      return variants.map((variant) => ({
        mushroom,
        id: `${mushroom.id}:${variant.id}`,
        mushroomId: mushroom.id,
        portraitId: variant.id || 'default',
        imagePath: variant.path || mushroom.imagePath,
        nameText: `${mushroom.name?.[state.lang] || mushroom.name?.en || mushroom.id} · ${variant.name?.[state.lang] || variant.name?.en || variant.id}`
      }));
    });
  }

  function portraitReviewGroups() {
    return (state.bootstrap?.mushrooms || []).map((mushroom) => ({
      mushroom,
      mushroomId: mushroom.id,
      nameText: mushroom.name?.[state.lang] || mushroom.name?.en || mushroom.id,
      items: portraitReviewItems().filter((item) => item.mushroomId === mushroom.id)
    }));
  }

  function sampleBubbleText(mushroom) {
    if (!mushroom) return '';
    return state.lang === 'ru'
      ? `Я использую ${mushroom.active.name.ru} и наношу 16 урона.`
      : `I use ${mushroom.active.name.en} for 16 damage.`;
  }

  function buildReplayFighter(mushroomId, options = {}) {
    const mushroom = getMushroom(mushroomId);
    const portraitId = options.portraitId || 'default';
    return {
      mushroom,
      imagePath: options.imagePath || portraitPathFor(mushroomId, portraitId),
      portraitId,
      nameText: options.nameText || mushroom?.name?.[state.lang] || mushroom?.name?.en || mushroomId || '',
      healthText: options.healthText || '',
      statsText: options.statsText || '',
      speechText: options.speechText || '',
      speechParts: options.speechParts || [],
      loadout: options.loadout || null,
      bubbleStyle: mushroomId ? replayBubbleStyle(mushroomId, portraitId) : {}
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

  function describeRun(run) {
    if (!run) return null;
    // Outcome rule (per game-requirements.md §1):
    //   end_reason='max_rounds' && livesRemaining>0 → win (survived 9 rounds)
    //   end_reason='max_losses' → loss (5 losses absorbed)
    //   end_reason='abandoned' → abandoned
    let outcomeKey = 'abandoned';
    if (run.endReason === 'max_rounds' && (run.livesRemaining || 0) > 0) {
      outcomeKey = 'win';
    } else if (run.endReason === 'max_losses') {
      outcomeKey = 'loss';
    } else if (run.endReason === 'abandoned') {
      outcomeKey = 'abandoned';
    }
    const tr = t.value;
    const outcomeLabel = outcomeKey === 'win'
      ? tr.runOutcomeWin
      : outcomeKey === 'loss' ? tr.runOutcomeLoss : tr.runOutcomeAbandoned;
    const ourMushroom = getMushroom(run.mushroomId);
    return {
      outcomeKey,
      outcomeLabel,
      ourName: mushroomDisplayName(run.mushroomId),
      ourImage: ourMushroom?.imagePath || '',
      mushroomId: run.mushroomId || null,
      wins: run.wins || 0,
      losses: run.losses || 0,
      completedRounds: run.completedRounds || 0,
      livesRemaining: run.livesRemaining || 0,
      modeLabel: run.mode === 'challenge' ? tr.modeChallenge : tr.modeSolo,
      dateLabel: formatReplayDate(run.endedAt || run.startedAt)
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
    shopArtifacts, storageItems,
    fusionMatches, fusionIngredientRowIds,
    fusionAvailableMatches, fusionCandidateRowIds, fusionCandidateShopArtifactIds, hasFusionCandidates,
    maxCoins: MAX_ARTIFACT_COINS,
    getArtifact, getMushroom, mushroomDisplayName,
    goTo, toggleMenu,
    formatArtifactBonus, formatDelta,
    loadoutStatsText, portraitPosition, portraitPositionFor, portraitPathFor,
    replayBubbleStyle, sampleBubbleText, portraitReviewItems, portraitReviewGroups, buildReplayFighter,
    resultSpeech, describeReplay, describeRun, artifactGridStyle,
    getArtifactPrice, renderArtifactFigure, buildOccupancy, preferredOrientation
  };
}
