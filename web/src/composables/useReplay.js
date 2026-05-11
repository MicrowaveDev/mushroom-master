import { computed } from 'vue/dist/vue.esm-bundler.js';
import { apiJson } from '../api.js';
import { formatReplayEvent } from '../replay/format.js';
import { readReplayDelay } from '../constants.js';

const DEFAULT_REPLAY_AUTOPLAY_MS = readReplayDelay(import.meta.env?.VITE_REPLAY_AUTOPLAY_MS, 1200);
const DEFAULT_REPLAY_AUTOPLAY_FAST_MS = readReplayDelay(import.meta.env?.VITE_REPLAY_AUTOPLAY_FAST_MS, 600);
export const LONG_BATTLE_SPEED_BOOST_2X_INDEX = 45;
export const LONG_BATTLE_SPEED_BOOST_3X_INDEX = 90;
export const LONG_BATTLE_SPEED_BOOST_4X_INDEX = 120;

export function replayLongBattleSpeedBoost(eventCount, replayIndex) {
  const count = Number(eventCount) || 0;
  const index = Number(replayIndex) || 0;
  if (count <= LONG_BATTLE_SPEED_BOOST_2X_INDEX || index < LONG_BATTLE_SPEED_BOOST_2X_INDEX) return 1;
  if (count > LONG_BATTLE_SPEED_BOOST_4X_INDEX && index >= LONG_BATTLE_SPEED_BOOST_4X_INDEX) return 4;
  if (count > LONG_BATTLE_SPEED_BOOST_3X_INDEX && index >= LONG_BATTLE_SPEED_BOOST_3X_INDEX) return 3;
  return 2;
}

export function useReplay(state, goTo, getMushroom) {
  const activeEvent = computed(() => state.currentBattle?.events?.[state.replayIndex] || null);
  const activeReplayDisplay = computed(() =>
    formatReplayEvent(
      activeEvent.value,
      state.currentBattle,
      (mushroomId) => getMushroom(mushroomId)?.name?.[state.lang] || getMushroom(mushroomId)?.name?.en,
      (mushroomId) => getMushroom(mushroomId)?.active?.name?.[state.lang],
      state.lang
    )
  );
  const replayFinished = computed(() => {
    if (!state.currentBattle?.events?.length) return false;
    return state.replayIndex >= state.currentBattle.events.length - 1;
  });
  const activeSpeech = computed(() => {
    if (!activeReplayDisplay.value?.speechSide || !activeReplayDisplay.value?.speechText) return null;
    return {
      side: activeReplayDisplay.value.speechSide,
      narration: activeReplayDisplay.value.speechText,
      parts: activeReplayDisplay.value.speechParts || []
    };
  });
  const battleStatusText = computed(() => activeReplayDisplay.value?.statusText || '');
  const visibleReplayEvents = computed(() => {
    if (!state.currentBattle?.events?.length) return [];
    return state.currentBattle.events
      .slice(0, state.replayIndex + 1)
      .map((event, index) => ({
        ...event,
        replayIndex: index,
        display: formatReplayEvent(
          event, state.currentBattle,
          (mushroomId) => getMushroom(mushroomId)?.name?.[state.lang] || getMushroom(mushroomId)?.name?.en,
          (mushroomId) => getMushroom(mushroomId)?.active?.name?.[state.lang],
          state.lang
        )
      }))
      .reverse();
  });
  const activeReplayState = computed(() => activeEvent.value?.state || null);
  const longBattleSpeedBoost = computed(() =>
    replayLongBattleSpeedBoost(state.currentBattle?.events?.length || 0, state.replayIndex)
  );

  function stopReplay() {
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
  }

  function preferredReplaySpeed() {
    const fromSettings = Number(state.bootstrap?.settings?.replaySpeed);
    return [2, 4, 8].includes(fromSettings) ? fromSettings : 2;
  }

  function autoplayReplay() {
    stopReplay();
    const selectedSpeed = state.replaySpeed || preferredReplaySpeed();
    const boost = replayLongBattleSpeedBoost(state.currentBattle?.events?.length || 0, state.replayIndex);
    const speed = selectedSpeed * boost;
    const baseDelay = state.bootstrap?.settings?.battleSpeed === '2x'
      ? DEFAULT_REPLAY_AUTOPLAY_FAST_MS
      : DEFAULT_REPLAY_AUTOPLAY_MS;
    const delay = Math.max(50, Math.round(baseDelay / speed));
    state.replayTimer = window.setInterval(() => {
      if (!state.currentBattle) { stopReplay(); return; }
      if (state.replayIndex >= state.currentBattle.events.length - 1) { stopReplay(); return; }
      const previousBoost = replayLongBattleSpeedBoost(state.currentBattle.events.length, state.replayIndex);
      state.replayIndex += 1;
      const nextBoost = replayLongBattleSpeedBoost(state.currentBattle.events.length, state.replayIndex);
      if (nextBoost !== previousBoost && state.replayIndex < state.currentBattle.events.length - 1) {
        autoplayReplay();
      }
    }, delay);
  }

  function persistReplaySpeed(speed) {
    if (!state.sessionKey || !state.bootstrap?.settings) return;
    state.bootstrap.settings.replaySpeed = speed;
    apiJson('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        lang: state.bootstrap.settings.lang,
        reducedMotion: state.bootstrap.settings.reducedMotion,
        battleSpeed: state.bootstrap.settings.battleSpeed,
        replaySpeed: speed
      })
    }, state.sessionKey).catch(() => {});
  }

  function setReplaySpeed(speed) {
    state.replaySpeed = speed;
    persistReplaySpeed(speed);
    if (state.replayTimer) {
      autoplayReplay();
    }
  }

  async function loadReplay(battleId, options = {}) {
    try {
      state.currentBattle = await apiJson(`/api/battles/${battleId}`, {}, state.sessionKey);
      state.replayIndex = 0;
      state.replaySpeed = preferredReplaySpeed();
      // Allow signalReady() to pre-fetch the replay payload without navigating
      // away from the round-result screen. The replay screen is opt-in
      // (Flow B Step 4) — autoplay only starts when the user actually opens it.
      if (options.navigate === false) return;
      goTo('replay', { replay: battleId }, options.routeOptions || {});
      autoplayReplay();
    } catch (error) {
      state.error = error.message || 'Could not load replay';
    }
  }

  return {
    activeEvent, activeSpeech, battleStatusText, replayFinished,
    activeReplayState, visibleReplayEvents, longBattleSpeedBoost,
    stopReplay, autoplayReplay, loadReplay,
    setReplaySpeed
  };
}
