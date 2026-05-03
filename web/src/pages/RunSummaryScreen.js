export const RunSummaryScreen = {
  name: 'RunSummaryScreen',
  props: ['state', 't', 'getMushroom', 'portraitPosition'],
  emits: ['go-home', 'load-replay'],
  computed: {
    run() {
      return this.state.gameRunSummary || null;
    },
    viewerPlayer() {
      const viewerId = this.state.bootstrap?.player?.id;
      return this.run?.players?.find((p) => p.playerId === viewerId) || null;
    },
    mushroom() {
      return this.viewerPlayer?.mushroomId ? this.getMushroom(this.viewerPlayer.mushroomId) : null;
    },
    outcomeKey() {
      const r = this.run;
      if (!r) return 'abandoned';
      if (r.endReason === 'max_rounds' && (this.viewerPlayer?.livesRemaining || 0) > 0) return 'win';
      if (r.endReason === 'max_losses') return 'loss';
      if (r.endReason === 'abandoned') return 'abandoned';
      return 'abandoned';
    },
    outcomeLabel() {
      if (this.outcomeKey === 'win') return this.t.runOutcomeWin;
      if (this.outcomeKey === 'loss') return this.t.runOutcomeLoss;
      return this.t.runOutcomeAbandoned;
    },
    viewerRounds() {
      const viewerId = this.state.bootstrap?.player?.id;
      return (this.run?.rounds || [])
        .filter((r) => r.playerId === viewerId && r.battleId)
        .sort((a, b) => a.roundNumber - b.roundNumber);
    }
  },
  template: `
    <section class="run-complete-screen">
      <div class="panel run-complete-card" v-if="run">
        <h2>{{ t.gameSummaryTitle }}</h2>
        <div class="run-summary-header" v-if="mushroom">
          <img :src="mushroom.imagePath" :alt="mushroom.name[state.lang]"
               class="run-summary-portrait" :style="{ objectPosition: portraitPosition(mushroom.id) }" />
          <div>
            <strong>{{ mushroom.name[state.lang] }}</strong>
            <p class="run-end-reason" :class="'run-summary-outcome--' + outcomeKey">{{ outcomeLabel }}</p>
          </div>
        </div>
        <dl class="stat-grid">
          <div class="stat"><dt>{{ t.wins }}</dt><dd>{{ viewerPlayer?.wins || 0 }}</dd></div>
          <div class="stat"><dt>{{ t.lossesShort }}</dt><dd>{{ viewerPlayer?.losses || 0 }}</dd></div>
          <div class="stat"><dt>{{ t.roundsCompleted }}</dt><dd>{{ viewerPlayer?.completedRounds || 0 }}</dd></div>
        </dl>

        <div v-if="viewerRounds.length" class="run-summary-rounds">
          <h3>{{ t.rounds }}</h3>
          <ul class="run-summary-round-list">
            <li v-for="r in viewerRounds" :key="r.id"
                class="run-summary-round-item"
                :class="'run-summary-round-item--' + (r.outcome || 'unknown')"
                @click="$emit('load-replay', r.battleId)"
                role="button" tabindex="0"
                @keydown.enter.prevent="$emit('load-replay', r.battleId)"
                @keydown.space.prevent="$emit('load-replay', r.battleId)">
              <span class="run-summary-round-num">{{ t.round }} {{ r.roundNumber }}</span>
              <span class="run-summary-round-outcome">{{ r.outcome === 'win' ? t.outcomeWin : r.outcome === 'loss' ? t.outcomeLoss : t.outcomeDraw }}</span>
              <span class="run-summary-round-cta">▶</span>
            </li>
          </ul>
        </div>

        <button class="primary" @click="$emit('go-home')">{{ t.home }}</button>
      </div>
    </section>
  `
};
