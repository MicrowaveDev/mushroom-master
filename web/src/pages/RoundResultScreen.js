export const RoundResultScreen = {
  name: 'RoundResultScreen',
  props: ['state', 't', 'formatDelta'],
  emits: ['continue', 'view-replay'],
  computed: {
    leveledUp() {
      const r = this.state.gameRunResult?.lastRound;
      return r && r.levelAfter != null && r.levelBefore != null && r.levelAfter > r.levelBefore;
    }
  },
  template: `
    <section class="round-result-screen">
      <div class="panel round-result-card">
        <h2 :class="state.gameRunResult.lastRound?.outcome === 'win' ? 'result-win' : 'result-loss'">
          {{ state.gameRunResult.lastRound?.outcome === 'win' ? t.roundWin : t.roundLoss }}
        </h2>
        <dl class="stat-grid">
          <div class="stat"><dt>{{ t.spore }}</dt><dd>+{{ state.gameRunResult.lastRound?.rewards?.spore || 0 }}</dd></div>
          <div class="stat"><dt>{{ t.mycelium }}</dt><dd>+{{ state.gameRunResult.lastRound?.rewards?.mycelium || 0 }}</dd></div>
          <div class="stat" v-if="state.gameRunResult.lastRound?.ratingAfter != null">
            <dt>{{ t.rating }}</dt>
            <dd>{{ formatDelta(state.gameRunResult.lastRound.ratingAfter - state.gameRunResult.lastRound.ratingBefore) }}</dd>
          </div>
        </dl>
        <div v-if="leveledUp" class="level-up-toast">
          {{ t.levelUp.replace('{level}', state.gameRunResult.lastRound.levelAfter) }}
        </div>
        <dl class="stat-grid">
          <div class="stat"><dt>{{ t.wins }}</dt><dd>{{ state.gameRunResult.player?.wins || 0 }}</dd></div>
          <div class="stat"><dt>{{ t.lives }}</dt><dd>{{ state.gameRunResult.player?.livesRemaining || 0 }}</dd></div>
          <div class="stat"><dt>{{ t.coins }}</dt><dd>{{ state.gameRunResult.player?.coins || 0 }}</dd></div>
        </dl>
        <div class="round-result-actions">
          <button class="primary" @click="$emit('continue')">{{ t.continueRound }}</button>
          <button class="ghost" @click="$emit('view-replay', state.gameRunResult.lastRound?.battleId)">{{ t.viewReplay }}</button>
        </div>
      </div>
    </section>
  `
};
