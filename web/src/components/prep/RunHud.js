export const RunHud = {
  name: 'RunHud',
  props: ['state', 't'],
  computed: {
    player() {
      return this.state.gameRun?.player || {};
    }
  },
  template: `
    <div class="run-hud-wrap">
      <div class="run-hud">
        <span class="run-hud-item">{{ t.wins }}: {{ player.wins || 0 }}</span>
        <span class="run-hud-item">{{ t.lives }}: {{ player.livesRemaining || 0 }}</span>
        <span class="run-hud-item run-hud-coins">\uD83E\uDE99 {{ player.coins || 0 }}</span>
      </div>
    </div>
  `
};
