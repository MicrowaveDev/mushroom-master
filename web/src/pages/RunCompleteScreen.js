export const RunCompleteScreen = {
  name: 'RunCompleteScreen',
  props: ['state', 't'],
  emits: ['go-home'],
  computed: {
    bonus() {
      return this.state.gameRun?.completionBonus || null;
    },
    hasBonus() {
      const b = this.bonus;
      return b && (b.spore > 0 || b.mycelium > 0);
    }
  },
  template: `
    <section class="run-complete-screen">
      <div class="panel run-complete-card">
        <h2>{{ t.runComplete }}</h2>
        <p v-if="state.gameRun?.endReason === 'max_losses'" class="run-end-reason">{{ t.eliminated }}</p>
        <p v-else-if="state.gameRun?.endReason === 'max_rounds'" class="run-end-reason">{{ t.maxRounds }}</p>
        <p v-else class="run-end-reason">{{ t.abandonRun }}</p>
        <dl class="stat-grid">
          <div class="stat"><dt>{{ t.wins }}</dt><dd>{{ state.gameRunResult?.player?.wins || state.gameRun?.player?.wins || 0 }}</dd></div>
          <div class="stat"><dt>{{ t.round }}</dt><dd>{{ state.gameRunResult?.player?.completedRounds || state.gameRun?.player?.completedRounds || 0 }}</dd></div>
        </dl>
        <dl v-if="hasBonus" class="stat-grid run-complete-bonus">
          <div class="stat"><dt>{{ t.completionBonus }}</dt><dd></dd></div>
          <div class="stat"><dt>{{ t.spore }}</dt><dd>+{{ bonus.spore }}</dd></div>
          <div class="stat"><dt>{{ t.mycelium }}</dt><dd>+{{ bonus.mycelium }}</dd></div>
        </dl>
        <button class="primary" @click="$emit('go-home')">{{ t.home }}</button>
      </div>
    </section>
  `
};
