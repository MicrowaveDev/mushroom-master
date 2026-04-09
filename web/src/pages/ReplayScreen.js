import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';

export const ReplayScreen = {
  name: 'ReplayScreen',
  props: [
    'state', 't',
    'activeEvent', 'activeSpeech', 'battleStatusText', 'replayFinished',
    'activeReplayState', 'visibleReplayEvents',
    'buildReplayFighter', 'getMushroom', 'loadoutStatsText',
    'renderArtifactFigure', 'getArtifact'
  ],
  emits: ['go-results'],
  components: {
    ReplayDuel: defineAsyncComponent(() => import('../components/ReplayDuel.js').then(m => m.ReplayDuel))
  },
  template: `
    <section class="replay-layout">
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
      <button v-if="replayFinished" class="primary replay-result-button-full" @click="$emit('go-results')">{{ t.results }}</button>
      <div class="replay-log">
        <button
          v-for="event in visibleReplayEvents" :key="event.replayIndex"
          class="log-entry" :class="{ active: event.replayIndex === state.replayIndex }"
          @click="state.replayIndex = event.replayIndex"
        >{{ event.display.logText }}</button>
      </div>
    </section>
  `
};
