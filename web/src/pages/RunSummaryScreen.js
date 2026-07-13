import { RunSummaryScreen as CoreRunSummaryScreen } from '@microwavedev/backpack-game-core/vue';

export const RunSummaryScreen = {
  name: 'MushroomRunSummaryScreen',
  components: { CoreRunSummaryScreen },
  props: ['state', 't', 'getMushroom', 'portraitPosition'],
  emits: ['go-home', 'load-replay'],
  computed: {
    summary() {
      const run = this.state.gameRunSummary || null;
      if (!run) return null;

      const viewerId = this.state.bootstrap?.player?.id;
      const viewer = run.players?.find((player) => player.playerId === viewerId) || null;
      const mushroom = viewer?.mushroomId ? this.getMushroom(viewer.mushroomId) : null;
      let outcomeKey = 'abandoned';
      if (run.endReason === 'max_rounds' && (viewer?.livesRemaining || 0) > 0) outcomeKey = 'win';
      if (run.endReason === 'max_losses') outcomeKey = 'loss';
      const outcomeLabel = outcomeKey === 'win'
        ? this.t.runOutcomeWin
        : outcomeKey === 'loss'
          ? this.t.runOutcomeLoss
          : this.t.runOutcomeAbandoned;

      return {
        title: this.t.gameSummaryTitle,
        outcome: { key: outcomeKey, label: outcomeLabel },
        character: mushroom ? {
          id: mushroom.id,
          name: mushroom.name[this.state.lang],
          imageSrc: mushroom.imagePath,
          imageAlt: mushroom.name[this.state.lang],
          imageStyle: { objectPosition: this.portraitPosition(mushroom.id) }
        } : null,
        stats: [
          { key: 'wins', label: this.t.wins, value: viewer?.wins || 0 },
          { key: 'losses', label: this.t.lossesShort, value: viewer?.losses || 0 },
          { key: 'rounds', label: this.t.roundsCompleted, value: viewer?.completedRounds || 0 }
        ],
        roundsTitle: this.t.rounds,
        rounds: (run.rounds || [])
          .filter((round) => round.playerId === viewerId && round.battleId)
          .sort((a, b) => a.roundNumber - b.roundNumber)
          .map((round) => ({
            key: round.id,
            battleId: round.battleId,
            tone: round.outcome || 'unknown',
            numberLabel: `${this.t.round} ${round.roundNumber}`,
            outcomeLabel: round.outcome === 'win'
              ? this.t.outcomeWin
              : round.outcome === 'loss'
                ? this.t.outcomeLoss
                : this.t.outcomeDraw
          })),
        homeLabel: this.t.home
      };
    }
  },
  template: `
    <core-run-summary-screen
      :summary="summary"
      @home="$emit('go-home')"
      @open-round="$emit('load-replay', $event)"
    />
  `
};
