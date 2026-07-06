import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';
import { ReplayScreen as CoreReplayScreen } from '@microwavedev/backpack-game-core/vue/components';

export const ReplayScreen = {
  name: 'ReplayScreen',
  props: [
    'state', 't', 'formatDelta',
    'activeEvent', 'activeSpeech', 'battleStatusText', 'replayFinished',
    'activeReplayState', 'visibleReplayEvents', 'longBattleSpeedBoost',
    'buildReplayFighter', 'getMushroom', 'loadoutStatsText',
    'renderArtifactFigure', 'getArtifact'
  ],
  emits: ['go-results', 'set-speed'],
  components: {
    CoreReplayScreen,
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
      return this.state.gameRunResult?.player?.livesRemaining ?? this.state.gameRun?.player?.livesRemaining;
    },
    runWins() {
      return this.state.gameRunResult?.player?.wins ?? this.state.gameRun?.player?.wins ?? 0;
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
    resultHero() {
      return {
        tone: this.roundOutcome || 'history',
        kicker: this.t.battleRecap || this.t.results,
        title: this.resultTitleText,
        summary: this.resultSummaryText
      };
    },
    rewardStats() {
      if (!this.showInlineRewards) return [];
      return [
        {
          key: 'spore',
          label: this.t.spore,
          value: this.formatDelta(this.roundRewards.spore || 0) || '0',
          className: this.statSignClass(this.roundRewards.spore)
        },
        {
          key: 'mycelium',
          label: this.t.mycelium,
          icon: '🍄',
          value: this.formatDelta(this.roundRewards.mycelium || 0) || '0',
          className: this.statSignClass(this.roundRewards.mycelium)
        },
        this.ratingDelta != null
          ? {
              key: 'rating',
              label: this.t.rating,
              value: this.formatDelta(this.ratingDelta),
              className: this.statSignClass(this.ratingDelta)
            }
          : null
      ].filter(Boolean);
    },
    rewardsPanel() {
      if (!this.showInlineRewards) return { visible: false };
      return {
        visible: true,
        tone: this.roundOutcome || 'history',
        testId: 'replay-rewards',
        title: this.roundOutcome === 'win' ? this.t.roundWin : this.t.roundLoss,
        titleClass: this.roundOutcome === 'win' ? 'result-win' : 'result-loss',
        opponentName: this.opponentMushroom ? this.opponentName : '',
        opponentPrefix: 'vs',
        opponentStats: this.opponentStatChips,
        stats: this.rewardStats,
        runStatus: this.runLivesRemaining != null
          ? [
              { key: 'wins', label: this.t.wins, value: this.runWins },
              { key: 'lives', label: this.t.lives, value: this.runLivesRemaining }
            ]
          : []
      };
    },
    battleSummary() {
      return {
        title: this.t.battleSummary || this.t.battleRecap || this.t.results,
        rows: this.battleRecapRows.map((row) => ({
          key: row.side,
          side: row.side,
          name: row.name,
          metrics: [
            { key: 'damageDealt', label: this.t.damageDealt || 'Damage dealt', value: row.damageDealt },
            { key: 'stunsMade', label: this.t.stunsMade || 'Stuns', value: row.stunsMade },
            { key: 'damageBlocked', label: this.t.damageBlocked || 'Blocked', value: row.damageBlocked }
          ]
        }))
      };
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
    },
    replayLogRows() {
      return (this.visibleReplayEvents || []).map((event) => ({
        ...event,
        text: event?.display?.logText || event?.text || '',
        active: event?.replayIndex === this.state.replayIndex
      }));
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
    },
    selectReplayLogRow({ row }) {
      if (row?.replayIndex == null) return;
      this.state.replayIndex = row.replayIndex;
    }
  },
  template: `
    <core-replay-screen
      :finished="replayFinished"
      :result-collapsed="resultOverlayCollapsed"
      :toggle-label="overlayToggleLabel"
      :result-hero="resultHero"
      :rewards-panel="rewardsPanel"
      :battle-summary="battleSummary"
      :continue-label="continueLabel"
      :log-rows="replayLogRows"
      @toggle-result="toggleResultOverlay"
      @go-results="$emit('go-results')"
      @select-log-row="selectReplayLogRow"
    >
      <template #battle-stage>
        <replay-duel
          :left-fighter="buildReplayFighter(state.currentBattle.snapshots.left.mushroomId, {
            nameText: getMushroom(state.currentBattle.snapshots.left.mushroomId)?.name[state.lang] || state.currentBattle.snapshots.left.mushroomId,
            healthText: activeReplayState?.left.currentHealth + ' / ' + activeReplayState?.left.maxHealth,
            statsText: loadoutStatsText(state.currentBattle.snapshots.left.loadout),
            speechText: activeSpeech?.side === 'left' ? activeSpeech.narration : '',
            speechParts: activeSpeech?.side === 'left' ? activeSpeech.parts : [],
            portraitId: state.currentBattle.snapshots.left.portraitId || state.currentBattle.snapshots.left.activePortrait || 'default',
            imagePath: state.currentBattle.snapshots.left.imagePath,
            loadout: state.currentBattle.snapshots.left.loadout
          })"
          :right-fighter="buildReplayFighter(state.currentBattle.snapshots.right.mushroomId, {
            nameText: getMushroom(state.currentBattle.snapshots.right.mushroomId)?.name[state.lang] || state.currentBattle.snapshots.right.mushroomId,
            healthText: activeReplayState?.right.currentHealth + ' / ' + activeReplayState?.right.maxHealth,
            statsText: loadoutStatsText(state.currentBattle.snapshots.right.loadout),
            speechText: activeSpeech?.side === 'right' ? activeSpeech.narration : '',
            speechParts: activeSpeech?.side === 'right' ? activeSpeech.parts : [],
            portraitId: state.currentBattle.snapshots.right.portraitId || state.currentBattle.snapshots.right.activePortrait || 'default',
            imagePath: state.currentBattle.snapshots.right.imagePath,
            loadout: state.currentBattle.snapshots.right.loadout
          })"
          :render-artifact-figure="renderArtifactFigure"
          :get-artifact="getArtifact"
          :acting-side="activeEvent?.actorSide || ''"
          :active-event="activeEvent"
          :active-replay-state="activeReplayState"
          :replay-index="state.replayIndex"
          :status-text="battleStatusText"
          :lang="state.lang"
          :replay-speed="state.replaySpeed || 1"
          :speed-boost="longBattleSpeedBoost || 1"
          @set-speed="$emit('set-speed', $event)"
        />
      </template>
    </core-replay-screen>
  `
};
