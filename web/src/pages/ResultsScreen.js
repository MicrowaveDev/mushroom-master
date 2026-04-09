import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';

export const ResultsScreen = {
  name: 'ResultsScreen',
  props: ['state', 't', 'getMushroom', 'loadoutStatsText', 'resultSpeech', 'replayBubbleStyle', 'renderArtifactFigure', 'getArtifact'],
  emits: ['go-home'],
  components: {
    FighterCard: defineAsyncComponent(() => import('../components/FighterCard.js').then(m => m.FighterCard))
  },
  computed: {
    overallOutcome() {
      const b = this.state.currentBattle;
      if (b.outcome === 'draw') return 'draw';
      return b.outcome === 'win' ? 'win' : 'loss';
    },
    overallLabel() {
      if (this.overallOutcome === 'draw') return this.t.outcomeDraw;
      return this.overallOutcome === 'win' ? this.t.outcomeWin : this.t.outcomeLoss;
    }
  },
  template: `
    <section class="results-screen">
      <div class="results-banner" :class="'results-banner--' + overallOutcome">
        <span class="results-banner-text">{{ overallLabel }}</span>
      </div>
      <div class="results-fighters">
        <div
          v-for="(snapshot, side) in state.currentBattle.snapshots" :key="side"
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
      <button class="primary" @click="$emit('go-home')">{{ t.home }}</button>
    </section>
  `
};
