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
  data() {
    return {
      resultOverlayCollapsed: false
    };
  },
  computed: {
    // Inline rewards summary — prefer the transient resolveRound payload,
    // but fall back to the persisted round data on the battle itself so a
    // refreshed replay can still show spore/mycelium/rating results.
    roundResult() {
      return this.state.gameRunResult?.lastRound || this.state.currentBattle?.roundResult || null;
    },
    showInlineRewards() {
      return this.replayFinished && !!this.roundResult;
    },
    roundRewards() {
      return this.roundResult?.rewards || { spore: 0, mycelium: 0 };
    },
    ratingDelta() {
      const r = this.roundResult;
      if (!r || r.ratingAfter == null || r.ratingBefore == null) return null;
      return r.ratingAfter - r.ratingBefore;
    },
    roundOutcome() {
      return this.roundResult?.outcome;
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
    },
    overlayToggleLabel() {
      return this.resultOverlayCollapsed
        ? (this.t.expandResult || 'Show result')
        : (this.t.collapseResult || 'Hide result');
    },
    resultTitleText() {
      if (!this.showInlineRewards) return this.resultOutcomeText || this.t.results;
      if (this.roundOutcome === 'win') return this.t.roundWin;
      if (this.roundOutcome === 'loss') return this.t.roundLoss;
      return this.t.outcomeDraw;
    },
    resultOutcomeText() {
      return (this.visibleReplayEvents || []).find((event) => event?.type === 'battle_end')?.display?.logText || '';
    },
    resultSummaryText() {
      return this.showInlineRewards
        ? (this.resultOutcomeText || this.battleStatusText || '')
        : (this.battleStatusText || '');
    },
    battleRecapRows() {
      const currentBattle = this.state.currentBattle;
      const rows = ['left', 'right'].map((side) => ({
        side,
        name: this.combatantName(side),
        damageDealt: 0,
        stunsMade: 0,
        damageBlocked: 0
      }));
      const bySide = Object.fromEntries(rows.map((row) => [row.side, row]));
      for (const event of currentBattle?.events || []) {
        if (event?.type !== 'action') continue;
        const actor = bySide[event.actorSide];
        const target = bySide[event.targetSide];
        if (actor) {
          actor.damageDealt += Math.max(0, Number(event.damage) || 0);
          if (event.stunned) actor.stunsMade += 1;
        }
        if (target) {
          target.damageBlocked += this.blockedDamageForEvent(event);
        }
      }
      return rows;
    }
  },
  methods: {
    statSignClass(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return '';
      return n > 0 ? 'stat--pos' : 'stat--neg';
    },
    toggleResultOverlay() {
      this.resultOverlayCollapsed = !this.resultOverlayCollapsed;
    },
    combatantName(side) {
      const mushroomId = this.state.currentBattle?.snapshots?.[side]?.mushroomId;
      return this.getMushroom(mushroomId)?.name?.[this.state.lang] || mushroomId || side;
    },
    blockedDamageForEvent(event) {
      const exact = Number(event?.blockedDamage);
      if (Number.isFinite(exact)) return Math.max(0, exact);
      const armor = event?.artifactAttribution?.armor || [];
      return armor.reduce((sum, item) => sum + Math.max(0, Number(item.value) || 0), 0);
    }
  },
  template: `
    <section
      class="replay-layout"
      :class="{
        'replay-layout--result-ready': replayFinished,
        'replay-layout--result-collapsed': replayFinished && resultOverlayCollapsed
      }"
    >
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
          :active-event="activeEvent"
          :status-text="battleStatusText"
          :lang="state.lang"
          :replay-speed="state.replaySpeed || 1"
          @set-speed="$emit('set-speed', $event)"
        />
      </div>
      <section
        v-if="replayFinished"
        class="replay-result-overlay"
        :class="{ 'replay-result-overlay--collapsed': resultOverlayCollapsed }"
        aria-live="polite"
      >
        <div class="replay-result-sheet">
          <button
            type="button"
            class="replay-sheet-toggle"
            :aria-label="overlayToggleLabel"
            :aria-expanded="!resultOverlayCollapsed"
            @click="toggleResultOverlay"
          >
            <span class="replay-sheet-grip" aria-hidden="true"></span>
            <span class="replay-sheet-mini-title" aria-hidden="true"></span>
            <svg class="replay-sheet-chevron" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 12 L10 6 L16 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div class="replay-sheet-body">
            <div class="replay-result-hero" :class="'replay-result-hero--' + (roundOutcome || 'history')">
              <p class="replay-result-kicker">{{ t.battleRecap || t.results }}</p>
              <h3>{{ resultTitleText }}</h3>
              <p v-if="resultSummaryText" class="replay-result-summary">{{ resultSummaryText }}</p>
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
            <div class="battle-summary-card">
              <p class="battle-summary-title">{{ t.battleSummary || t.battleRecap || t.results }}</p>
              <div class="battle-summary-grid">
                <article
                  v-for="row in battleRecapRows"
                  :key="row.side"
                  class="battle-summary-row"
                  :class="'battle-summary-row--' + row.side"
                >
                  <strong>{{ row.name }}</strong>
                  <dl>
                    <div>
                      <dt>{{ t.damageDealt || 'Damage dealt' }}</dt>
                      <dd>{{ row.damageDealt }}</dd>
                    </div>
                    <div>
                      <dt>{{ t.stunsMade || 'Stuns' }}</dt>
                      <dd>{{ row.stunsMade }}</dd>
                    </div>
                    <div>
                      <dt>{{ t.damageBlocked || 'Blocked' }}</dt>
                      <dd>{{ row.damageBlocked }}</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>
            <button class="primary replay-result-button-full" @click="$emit('go-results')">{{ continueLabel }}</button>
          </div>
        </div>
      </section>
      <div v-else class="replay-log">
        <button
          v-for="event in visibleReplayEvents" :key="event.replayIndex"
          class="log-entry" :class="{ active: event.replayIndex === state.replayIndex }"
          @click="state.replayIndex = event.replayIndex"
        >{{ event.display.logText }}</button>
      </div>
    </section>
  `
};
