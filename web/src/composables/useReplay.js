import { computed } from 'vue/dist/vue.esm-bundler.js';
import { apiJson } from '../api.js';
import { formatReplayEvent } from '../replay/format.js';
import { readReplayDelay } from '../constants.js';

const DEFAULT_REPLAY_AUTOPLAY_MS = readReplayDelay(import.meta.env.VITE_REPLAY_AUTOPLAY_MS, 1200);
const DEFAULT_REPLAY_AUTOPLAY_FAST_MS = readReplayDelay(import.meta.env.VITE_REPLAY_AUTOPLAY_FAST_MS, 600);

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
    return { side: activeReplayDisplay.value.speechSide, narration: activeReplayDisplay.value.speechText };
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

  function stopReplay() {
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
  }

  function autoplayReplay() {
    stopReplay();
    const speed = state.replaySpeed || 1;
    const baseDelay = state.bootstrap?.settings?.battleSpeed === '2x'
      ? DEFAULT_REPLAY_AUTOPLAY_FAST_MS
      : DEFAULT_REPLAY_AUTOPLAY_MS;
    const delay = Math.max(50, Math.round(baseDelay / speed));
    state.replayTimer = window.setInterval(() => {
      if (!state.currentBattle) { stopReplay(); return; }
      if (state.replayIndex >= state.currentBattle.events.length - 1) { stopReplay(); return; }
      state.replayIndex += 1;
    }, delay);
  }

  function setReplaySpeed(speed) {
    state.replaySpeed = speed;
    if (state.replayTimer) {
      autoplayReplay();
    }
  }

  async function loadReplay(battleId, options = {}) {
    try {
      state.currentBattle = await apiJson(`/api/battles/${battleId}`, {}, state.sessionKey);
      state.replayIndex = 0;
      state.replaySpeed = 1;
      // Allow signalReady() to pre-fetch the replay payload without navigating
      // away from the round-result screen. The replay screen is opt-in
      // (Flow B Step 4) — autoplay only starts when the user actually opens it.
      if (options.navigate === false) return;
      goTo('replay', { replay: battleId });
      autoplayReplay();
    } catch (error) {
      state.error = error.message || 'Could not load replay';
    }
  }

  async function viewRoundReplay(battleId) {
    if (!battleId) return;
    await loadReplay(battleId);
  }

  return {
    activeEvent, activeSpeech, battleStatusText, replayFinished,
    activeReplayState, visibleReplayEvents,
    stopReplay, autoplayReplay, loadReplay, viewRoundReplay,
    setReplaySpeed
  };
}
