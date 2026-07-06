import { PrepActions as CorePrepActions } from '@microwavedev/backpack-game-core/vue/components';

export const PrepActions = {
  name: 'PrepActions',
  components: { CorePrepActions },
  props: ['state', 't'],
  emits: ['signal-ready', 'abandon'],
  computed: {
    labels() {
      return {
        ready: this.t?.ready,
        readying: this.t?.readying,
        abandon: this.t?.abandonRun,
        opponentReady: this.t?.opponentReady,
        opponentWaiting: this.t?.waitingForOpponent
      };
    }
  },
  template: `
    <CorePrepActions
      :show-opponent-status="state.gameRun.mode === 'challenge'"
      :opponent-ready="!!state.opponentReady"
      :action-in-flight="!!state.actionInFlight"
      :labels="labels"
      @ready="$emit('signal-ready')"
      @abandon="$emit('abandon')"
    />
  `
};
