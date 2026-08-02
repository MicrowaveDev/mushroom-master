import { computed } from 'vue/dist/vue.esm-bundler.js';
import { createMushroomGameApiClient } from '../api.js';
import { formatReplayEvent } from '../replay/format.js';
import { readReplayDelay } from '../constants.js';
import {
  LONG_BATTLE_SPEED_BOOST_2X_INDEX,
  LONG_BATTLE_SPEED_BOOST_3X_INDEX,
  LONG_BATTLE_SPEED_BOOST_4X_INDEX,
  preferredReplaySpeed as corePreferredReplaySpeed,
  replayAdvanceTickViewState,
  replayAutoplayDelayViewState,
  replayLoadResultViewState,
  replayLongBattleSpeedBoost,
  replaySetSpeedViewState,
  replayTimelineViewState
} from '@microwavedev/backpack-game-core/client-view-model';

const DEFAULT_REPLAY_AUTOPLAY_MS = readReplayDelay(import.meta.env?.VITE_REPLAY_AUTOPLAY_MS, 1200);
const DEFAULT_REPLAY_AUTOPLAY_FAST_MS = readReplayDelay(import.meta.env?.VITE_REPLAY_AUTOPLAY_FAST_MS, 600);
export {
  LONG_BATTLE_SPEED_BOOST_2X_INDEX,
  LONG_BATTLE_SPEED_BOOST_3X_INDEX,
  LONG_BATTLE_SPEED_BOOST_4X_INDEX,
  replayLongBattleSpeedBoost
};

export function useReplay(state, goTo, getMushroom) {
  function gameApi() {
    return createMushroomGameApiClient(state.sessionKey);
  }

  function formatDisplay(event) {
    return formatReplayEvent(
      event,
      state.currentBattle,
      (mushroomId) => getMushroom(mushroomId)?.name?.[state.lang] || getMushroom(mushroomId)?.name?.en,
      (mushroomId) => getMushroom(mushroomId)?.active?.name?.[state.lang],
      state.lang
    );
  }

  const replayTimeline = computed(() => replayTimelineViewState({
    battle: state.currentBattle,
    replayIndex: state.replayIndex,
    formatEvent: formatDisplay
  }));
  const activeEvent = computed(() => replayTimeline.value.activeEvent);
  const activeReplayDisplay = computed(() => replayTimeline.value.activeDisplay);
  const replayFinished = computed(() => replayTimeline.value.replayFinished);
  const activeSpeech = computed(() => replayTimeline.value.activeSpeech);
  const battleStatusText = computed(() => replayTimeline.value.battleStatusText);
  const visibleReplayEvents = computed(() => replayTimeline.value.visibleReplayEvents);
  const activeReplayState = computed(() => replayTimeline.value.activeReplayState);
  const longBattleSpeedBoost = computed(() => replayTimeline.value.longBattleSpeedBoost);

  function stopReplay() {
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
  }

  function preferredReplaySpeed() {
    return corePreferredReplaySpeed(state.bootstrap?.settings);
  }

  function autoplayReplay() {
    stopReplay();
    const { delay } = replayAutoplayDelayViewState({
      eventCount: state.currentBattle?.events?.length || 0,
      replayIndex: state.replayIndex,
      replaySpeed: state.replaySpeed || preferredReplaySpeed(),
      settings: state.bootstrap?.settings || null,
      defaultDelayMs: DEFAULT_REPLAY_AUTOPLAY_MS,
      fastDelayMs: DEFAULT_REPLAY_AUTOPLAY_FAST_MS
    });
    state.replayTimer = window.setInterval(() => {
      const tick = replayAdvanceTickViewState({
        battle: state.currentBattle,
        replayIndex: state.replayIndex
      });
      if (tick.shouldStop) { stopReplay(); return; }
      state.replayIndex = tick.replayIndex;
      if (tick.shouldRestartTimer) {
        autoplayReplay();
      }
    }, delay);
  }

  function persistReplaySpeed(speed) {
    if (!state.sessionKey || !state.bootstrap?.settings) return;
    gameApi().postRoute('settings', {}, {
      lang: state.bootstrap.settings.lang,
      reducedMotion: state.bootstrap.settings.reducedMotion,
      battleSpeed: state.bootstrap.settings.battleSpeed,
      replaySpeed: speed,
      tutorial: state.bootstrap.settings.tutorial
    }).catch(() => {});
  }

  function setReplaySpeed(speed) {
    const viewState = replaySetSpeedViewState(speed, {
      settings: state.bootstrap?.settings || null
    });
    state.replaySpeed = viewState.replaySpeed;
    if (state.bootstrap?.settings && viewState.settings) {
      state.bootstrap.settings = viewState.settings;
    }
    if (viewState.shouldPersist) {
      persistReplaySpeed(viewState.replaySpeed);
    }
    if (state.replayTimer) {
      autoplayReplay();
    }
  }

  async function loadReplay(battleId, options = {}) {
    try {
      const battle = options.battle || await gameApi().getRoute('battle', { battleId });
      const viewState = replayLoadResultViewState(battle, {
        settings: state.bootstrap?.settings || null
      });
      state.currentBattle = viewState.currentBattle;
      state.replayIndex = viewState.replayIndex;
      state.replaySpeed = viewState.replaySpeed;
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
