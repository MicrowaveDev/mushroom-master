import { SettingsScreen as CoreSettingsScreen } from '@microwavedev/backpack-game-core/vue/pages';
import {
  normalizeTutorialPreferences,
  scheduleTutorialReplay
} from '@microwavedev/backpack-game-core/modules/tutorial';

export const SettingsScreen = {
  name: 'MushroomSettingsScreen',
  components: { CoreSettingsScreen },
  props: ['state', 't'],
  emits: ['save-settings'],
  computed: {
    labels() {
      return {
        title: this.t.settings,
        language: this.t.language,
        reducedMotion: this.t.reducedMotion,
        battleSpeed: this.t.battleSpeed,
        tutorialReplay: this.t.tutorialReplay,
        tutorialReplayHint: this.t.tutorialReplayHint,
        mobileActionsMode: this.t.mobileActionsMode,
        mobileActionsAuto: this.t.mobileActionsAuto,
        mobileActionsAlways: this.t.mobileActionsAlways,
        mobileActionsSide: this.t.mobileActionsSide,
        mobileActionsMenu: this.t.mobileActionsMenu,
        save: this.t.save
      };
    }
  },
  methods: {
    updateLocale(value) {
      this.state.lang = value;
    },
    updateReducedMotion(value) {
      this.state.bootstrap.settings.reducedMotion = value;
    },
    updateBattleSpeed(value) {
      this.state.bootstrap.settings.battleSpeed = value;
    },
    updateMobileActionsMode(value) {
      this.state.mobileHomeActionsMode = value;
    },
    updateTutorialReplay(value) {
      const current = normalizeTutorialPreferences(this.state.bootstrap.settings.tutorial);
      this.state.bootstrap.settings.tutorial = value
        ? scheduleTutorialReplay(current)
        : { ...current, replayPending: false };
    }
  },
  template: `
    <core-settings-screen
      :settings="state.bootstrap.settings"
      :locale="state.lang"
      :mobile-actions-mode="state.mobileHomeActionsMode"
      :tutorial-replay-pending="Boolean(state.bootstrap.settings.tutorial?.replayPending)"
      :labels="labels"
      @update:locale="updateLocale"
      @update:reduced-motion="updateReducedMotion"
      @update:battle-speed="updateBattleSpeed"
      @update:mobile-actions-mode="updateMobileActionsMode"
      @update:tutorial-replay-pending="updateTutorialReplay"
      @save="$emit('save-settings')"
    />
  `
};
