import { calculateSeasonAbandonPenalty, calculateSeasonPoints } from '../../../../app/shared/season-levels.js';

export const RunHud = {
  name: 'RunHud',
  props: ['state', 't'],
  computed: {
    player() {
      return this.state.gameRun?.player || {};
    },
    currentRunPoints() {
      return calculateSeasonPoints({
        wins: this.player.wins || 0,
        losses: this.player.losses || 0,
        roundsCompleted: this.player.completedRounds || 0
      });
    },
    abandonPenalty() {
      return calculateSeasonAbandonPenalty({
        endReason: 'abandoned',
        roundsCompleted: this.player.completedRounds || 0
      });
    },
    rankStakesText() {
      const current = this.formatSigned(this.currentRunPoints);
      const exit = this.formatSigned(this.currentRunPoints + this.abandonPenalty);
      return this.t.rankStakes
        .replace('{current}', current)
        .replace('{exit}', exit);
    }
  },
  methods: {
    formatSigned(value) {
      const n = Number(value || 0);
      return n > 0 ? `+${n}` : String(n);
    }
  },
  template: `
    <div class="run-hud-wrap">
      <div class="run-hud">
        <span class="run-hud-item">{{ t.wins }}: {{ player.wins || 0 }}</span>
        <span class="run-hud-item">{{ t.lives }}: {{ player.livesRemaining || 0 }}</span>
        <span class="run-hud-item run-hud-coins">\uD83E\uDE99 {{ player.coins || 0 }}</span>
      </div>
      <span class="run-rank-stakes">{{ rankStakesText }}</span>
    </div>
  `
};
