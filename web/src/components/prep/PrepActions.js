export const PrepActions = {
  name: 'PrepActions',
  props: ['state', 't'],
  emits: ['signal-ready', 'abandon'],
  template: `
    <div class="prep-actions">
      <div v-if="state.gameRun.mode === 'challenge'" class="prep-opponent-status">
        <span v-if="state.opponentReady" class="prep-opponent-ready">{{ t.opponentReady }}</span>
        <span v-else class="prep-opponent-waiting">{{ t.waitingForOpponent }}</span>
      </div>
      <button class="primary prep-ready-btn" :disabled="state.actionInFlight" @click="$emit('signal-ready')">{{ state.actionInFlight ? t.readying : t.ready }}</button>
      <button class="ghost" @click="$emit('abandon')">{{ t.abandonRun }}</button>
    </div>
  `
};
