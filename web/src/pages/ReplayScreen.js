import { defineAsyncComponent } from 'vue/dist/vue.esm-bundler.js';
import { ReplayDetailScreen } from '@microwavedev/backpack-game-core/vue/pages';

const ReplayDuel = defineAsyncComponent(() => (
  import('../components/ReplayDuel.js').then((module) => module.ReplayDuel)
));

export const ReplayScreen = {
  name: 'ReplayScreen',
  components: { ReplayDetailScreen },
  props: [
    'state', 't', 'formatDelta',
    'activeEvent', 'activeSpeech', 'battleStatusText', 'replayFinished',
    'activeReplayState', 'visibleReplayEvents', 'longBattleSpeedBoost',
    'buildReplayFighter', 'getMushroom', 'loadoutStatsText',
    'renderArtifactFigure', 'getArtifact'
  ],
  emits: ['go-results', 'set-speed'],
  computed: {
    replayDuelComponent() {
      return ReplayDuel;
    },
    normalizedText() {
      return {
        ...this.t,
        profileCurrency: this.t.profileCurrency || this.t.spore,
        progressionCurrency: this.t.progressionCurrency || this.t.mycelium
      };
    }
  },
  methods: {
    snapshotMushroomId(snapshot) {
      return snapshot?.characterId || snapshot?.mushroomId || null;
    }
  },
  template: `
    <ReplayDetailScreen
      :state="state"
      :t="normalizedText"
      :format-delta="formatDelta"
      :active-event="activeEvent"
      :active-speech="activeSpeech"
      :battle-status-text="battleStatusText"
      :replay-finished="replayFinished"
      :active-replay-state="activeReplayState"
      :visible-replay-events="visibleReplayEvents"
      :long-battle-speed-boost="longBattleSpeedBoost"
      :build-replay-fighter="buildReplayFighter"
      :get-character="getMushroom"
      :loadout-stats-text="loadoutStatsText"
      :render-artifact-figure="renderArtifactFigure"
      :get-artifact="getArtifact"
      :replay-duel-component="replayDuelComponent"
      :get-snapshot-character-id="snapshotMushroomId"
      profile-reward-key="spore"
      progression-reward-key="mycelium"
      progression-reward-icon="🍄"
      @go-results="$emit('go-results')"
      @set-speed="$emit('set-speed', $event)"
    />
  `
};
