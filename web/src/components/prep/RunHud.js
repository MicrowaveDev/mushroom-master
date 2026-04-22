export const RunHud = {
  name: 'RunHud',
  props: ['state', 't'],
  template: `
    <div class="run-hud">
      <span class="run-hud-item">{{ t.wins }}: {{ state.gameRun.player?.wins || 0 }}</span>
      <span class="run-hud-item">{{ t.lives }}: {{ state.gameRun.player?.livesRemaining || 0 }}</span>
      <span class="run-hud-item run-hud-coins">\uD83E\uDE99 {{ state.gameRun.player?.coins || 0 }}</span>
    </div>
  `
};
