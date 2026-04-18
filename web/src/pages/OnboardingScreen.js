export const OnboardingScreen = {
  name: 'OnboardingScreen',
  props: ['state', 't'],
  emits: ['go'],
  template: `
    <section class="onboarding-screen">
      <div class="panel onboarding-card">
        <h2 class="onboarding-title">{{ t.onboardingTitle }}</h2>
        <div class="onboarding-body">
          <ol class="onboarding-steps">
            <li class="onboarding-step"><span class="onboarding-step-num">1</span><div><strong>{{ t.onboardingStep1 }}</strong><p>{{ t.onboardingStep1Sub }}</p></div></li>
            <li class="onboarding-step"><span class="onboarding-step-num">2</span><div><strong>{{ t.onboardingStep2 }}</strong><p>{{ t.onboardingStep2Sub }}</p></div></li>
            <li class="onboarding-step"><span class="onboarding-step-num">3</span><div><strong>{{ t.onboardingStep3 }}</strong><p>{{ t.onboardingStep3Sub }}</p></div></li>
          </ol>
          <div class="onboarding-preview">
            <div class="onboarding-preview-roster">
              <img v-for="m in state.bootstrap.mushrooms.slice(0, 5)" :key="m.id" :src="m.imagePath" :alt="m.name[state.lang]" class="onboarding-preview-portrait" />
            </div>
            <p class="onboarding-preview-caption">{{ t.onboardingStep1Sub }}</p>
          </div>
        </div>
        <button class="primary" @click="$emit('go', 'characters')">{{ t.continue }}</button>
      </div>
    </section>
  `
};
