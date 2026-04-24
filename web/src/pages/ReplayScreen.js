import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';

export const ReplayScreen = {
  name: 'ReplayScreen',
  props: [
    'state', 't', 'formatDelta',
    'activeEvent', 'activeSpeech', 'battleStatusText', 'replayFinished',
    'activeReplayState', 'visibleReplayEvents',
    'buildReplayFighter', 'getMushroom', 'loadoutStatsText',
    'renderArtifactFigure', 'getArtifact'
  ],
  emits: ['go-results', 'set-speed'],
  components: {
    ReplayDuel: defineAsyncComponent(() => import('../components/ReplayDuel.js').then(m => m.ReplayDuel))
  },
  computed: {
    // Inline rewards summary — shown under the battle stage once the
    // replay finishes, but only when we're inside an active run (Flow B
    // and Flow C). A standalone replay from history (Flow E) has no
    // gameRunResult set and should not render a rewards card.
    showInlineRewards() {
      return this.replayFinished && this.state.gameRun && this.state.gameRunResult?.lastRound;
    },
    roundRewards() {
      return this.state.gameRunResult?.lastRound?.rewards || { spore: 0, mycelium: 0 };
    },
    ratingDelta() {
      const r = this.state.gameRunResult?.lastRound;
      if (!r || r.ratingAfter == null || r.ratingBefore == null) return null;
      return r.ratingAfter - r.ratingBefore;
    },
    roundOutcome() {
      return this.state.gameRunResult?.lastRound?.outcome;
    },
    runLivesRemaining() {
      return this.state.gameRun?.player?.livesRemaining;
    },
    runWins() {
      return this.state.gameRun?.player?.wins || 0;
    },
    opponentMushroomId() {
      return this.state.currentBattle?.snapshots?.right?.mushroomId;
    },
    opponentMushroom() {
      return this.opponentMushroomId ? this.getMushroom(this.opponentMushroomId) : null;
    },
    opponentName() {
      return this.opponentMushroom?.name?.[this.state.lang] || this.opponentMushroomId || '';
    },
    opponentStatsText() {
      const loadout = this.state.currentBattle?.snapshots?.right?.loadout;
      return loadout ? this.loadoutStatsText(loadout) : '';
    },
    opponentStatChips() {
      return (this.opponentStatsText || '').split(' / ').filter(Boolean);
    },
    continueLabel() {
      // No active run → standalone replay from history → "Home".
      // Active run, any state → "Continue". onReplayFinish in main.js
      // routes to runComplete automatically when the run has ended, so
      // one label covers mid-run-next-prep and final-battle-to-summary.
      return this.state.gameRun ? this.t.continueRound : this.t.home;
    }
  },
  methods: {
    statSignClass(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return '';
      return n > 0 ? 'stat--pos' : 'stat--neg';
    }
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
          :replay-speed="state.replaySpeed || 1"
          @set-speed="$emit('set-speed', $event)"
        />
      </div>
      <div v-if="showInlineRewards" class="panel replay-rewards-card" :class="'replay-rewards-card--' + roundOutcome" data-testid="replay-rewards">
        <div class="replay-rewards-header" :class="'replay-rewards-header--' + roundOutcome">
          <h3 class="replay-rewards-title" :class="roundOutcome === 'win' ? 'result-win' : 'result-loss'">
            {{ roundOutcome === 'win' ? t.roundWin : t.roundLoss }}
          </h3>
          <div v-if="opponentMushroom" class="replay-rewards-opponent">
            <span class="replay-rewards-vs">vs <b>{{ opponentName }}</b></span>
            <div v-if="opponentStatChips.length" class="replay-rewards-opponent-stats">
              <span v-for="chip in opponentStatChips" :key="chip" class="replay-rewards-stat-chip">{{ chip }}</span>
            </div>
          </div>
        </div>
        <dl class="stat-grid">
          <div class="stat" :class="statSignClass(roundRewards.spore)"><dt>{{ t.spore }}</dt><dd>{{ formatDelta(roundRewards.spore || 0) || '0' }}</dd></div>
          <div class="stat" :class="statSignClass(roundRewards.mycelium)"><dt>{{ t.mycelium }}</dt><dd>{{ formatDelta(roundRewards.mycelium || 0) || '0' }}</dd></div>
          <div v-if="ratingDelta != null" class="stat" :class="statSignClass(ratingDelta)">
            <dt>{{ t.rating }}</dt>
            <dd>{{ formatDelta(ratingDelta) }}</dd>
          </div>
        </dl>
        <div v-if="runLivesRemaining != null" class="replay-run-status">
          <span class="replay-run-chip"><span class="replay-run-chip-label">{{ t.wins }}</span><span class="replay-run-chip-value">{{ runWins }}</span></span>
          <span class="replay-run-chip"><span class="replay-run-chip-label">{{ t.lives }}</span><span class="replay-run-chip-value">{{ runLivesRemaining }}</span></span>
        </div>
      </div>
      <button v-if="replayFinished" class="primary replay-result-button-full" @click="$emit('go-results')">{{ continueLabel }}</button>
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
