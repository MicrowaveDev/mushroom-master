import { OnboardingScreen as CoreOnboardingScreen } from '@microwavedev/backpack-game-core/vue/pages';

export const OnboardingScreen = {
  name: 'MushroomOnboardingScreen',
  components: { CoreOnboardingScreen },
  props: ['state', 't', 'portraitPosition'],
  emits: ['go'],
  computed: {
    labels() {
      return {
        title: this.t.onboardingTitle,
        steps: [
          { key: 'character', title: this.t.onboardingStep1, description: this.t.onboardingStep1Sub },
          { key: 'loadout', title: this.t.onboardingStep2, description: this.t.onboardingStep2Sub },
          { key: 'battle', title: this.t.onboardingStep3, description: this.t.onboardingStep3Sub }
        ],
        previewCaption: this.t.onboardingStep1Sub,
        continue: this.t.continue
      };
    }
  },
  template: `
    <core-onboarding-screen
      :characters="state.bootstrap.mushrooms"
      :locale="state.lang"
      :labels="labels"
      :portrait-position="portraitPosition"
      @continue="$emit('go', 'characters')"
    />
  `
};
